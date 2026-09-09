#!/usr/bin/env python3
"""
Linux Security · Step 2 — seccomp-bpf: a syscall allowlist as a firewall.

seccomp (SECure COMPuting) filter mode loads a BPF program that the
kernel runs on *every syscall* the thread makes. The program returns an
action:

  SECCOMP_RET_ALLOW    let it through
  SECCOMP_RET_ERRNO    fail it with a chosen errno (e.g. EPERM) - app keeps running
  SECCOMP_RET_TRAP     send SIGSYS (userspace handler / crash)
  SECCOMP_RET_KILL     kill the thread/process immediately
  SECCOMP_RET_LOG      allow but log (for building a profile)

Design rule: DEFAULT DENY. Allow the ~40-80 syscalls the app genuinely
uses; everything else (a huge attack surface for kernel LPE) is gone.

We model a filter, replay a syscall trace through it, and measure how
much of the kernel's syscall surface we removed.
"""

# x86-64 has ~350 syscalls. A typical network service touches a small set.
LINUX_SYSCALL_COUNT = 350

APP_SYSCALLS = {
    "read", "write", "openat", "close", "fstat", "lseek", "mmap", "mprotect",
    "munmap", "brk", "rt_sigaction", "rt_sigprocmask", "ioctl", "pread64",
    "pwrite64", "access", "pipe2", "select", "sched_yield", "madvise",
    "socket", "connect", "accept4", "sendto", "recvfrom", "sendmsg", "recvmsg",
    "bind", "listen", "getsockname", "getpeername", "setsockopt", "getsockopt",
    "clone3", "execve", "exit", "exit_group", "wait4", "uname", "fcntl",
    "getdents64", "getrandom", "clock_gettime", "epoll_create1", "epoll_ctl",
    "epoll_wait", "futex", "set_robust_list", "prlimit64", "getpid", "gettid",
}

# Syscalls an exploit/tool reaches for that a web server never needs.
DANGEROUS_IF_UNNEEDED = {
    "ptrace", "process_vm_readv", "process_vm_writev",     # read other procs
    "init_module", "finit_module", "delete_module",        # load kernel code
    "kexec_load", "kexec_file_load",                       # boot a new kernel
    "mount", "umount2", "pivot_root", "chroot",            # filesystem escape
    "bpf",                                                 # load BPF (unpriv often off)
    "userfaultfd",                                         # KPTI/LPE primitive
    "keyctl", "add_key",                                   # kernel keyring
    "unshare", "setns",                                    # namespace games
    "perf_event_open",                                     # side channels / LPE
    "personality", "modify_ldt",
}

POLICY = {
    "default": "ERRNO",              # SECCOMP_RET_ERRNO(EPERM)
    "allow": APP_SYSCALLS,
    "kill": {"ptrace", "init_module", "finit_module", "kexec_load",
             "kexec_file_load", "bpf", "userfaultfd"},   # never legitimate here
}


def decide(syscall):
    if syscall in POLICY["kill"]:
        return "KILL"
    if syscall in POLICY["allow"]:
        return "ALLOW"
    return POLICY["default"]          # ERRNO


def main():
    # A recorded trace: normal traffic, then an exploit attempt.
    trace = (
        [("accept4", "normal"), ("recvfrom", "normal"), ("read", "normal"),
         ("openat", "normal"), ("write", "normal"), ("sendto", "normal"),
         ("epoll_wait", "normal"), ("futex", "normal"), ("getrandom", "normal")]
        + [("ptrace", "exploit"), ("process_vm_readv", "exploit"),
           ("userfaultfd", "exploit"), ("init_module", "exploit"),
           ("unshare", "exploit"), ("mount", "exploit")]
    )

    allowed = blocked = killed = 0
    print(f"{'syscall':>18}  {'origin':>8}  {'action':>6}")
    for sc, origin in trace:
        act = decide(sc)
        print(f"{sc:>18}  {origin:>8}  {act:>6}")
        if act == "ALLOW":
            allowed += 1
        elif act == "KILL":
            killed += 1
        else:
            blocked += 1

    # every 'normal' syscall must pass; every 'exploit' syscall must not
    for sc, origin in trace:
        act = decide(sc)
        if origin == "normal":
            assert act == "ALLOW", (sc, act)
        else:
            assert act in ("ERRNO", "KILL"), (sc, act)

    surface_before = LINUX_SYSCALL_COUNT
    surface_after = len(APP_SYSCALLS)
    reduction = 100 * (1 - surface_after / surface_before)
    print(f"\n  kernel syscall surface: {surface_before} -> {surface_after} "
          f"reachable  ({reduction:.0f}% removed)")
    assert reduction > 80

    # ERRNO vs KILL: ERRNO lets a mis-behaving-but-benign library keep
    # running (e.g. it probes for a syscall and handles EPERM); KILL is
    # for syscalls that can only mean compromise.
    assert decide("ptrace") == "KILL"
    assert decide("mount") == "ERRNO"
    assert decide("read") == "ALLOW"
    assert killed >= 3 and blocked >= 2 and allowed == 9

    print("\n  build the allowlist from a SECCOMP_RET_LOG run in staging, then")
    print("  ship it as default-deny. Docker/podman/systemd all wrap this")
    print("  (SystemCallFilter=, --security-opt seccomp=profile.json).")
    print("\nPASS — allowlist passes all real syscalls, blocks/kills every exploit"
          " syscall, and removes 80%+ of the kernel attack surface.")


if __name__ == "__main__":
    main()
