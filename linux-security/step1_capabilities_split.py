#!/usr/bin/env python3
"""
Linux Security · Step 1 — POSIX capabilities: root, split into ~40 pieces.

"root" (uid 0) is really a bundle of distinct privileges. Capabilities
let a process hold only the ones it needs:

  CAP_NET_BIND_SERVICE   bind ports < 1024
  CAP_NET_RAW            raw sockets (ping, tcpdump)
  CAP_SYS_ADMIN          the junk drawer — mount, setns, many others
  CAP_DAC_OVERRIDE       bypass file read/write/execute permission bits
  CAP_SYS_PTRACE         ptrace/read another process's memory
  CAP_SETUID/CAP_SETGID  change uid/gid
  CAP_SYS_MODULE         load kernel modules
  CAP_CHOWN, CAP_KILL, CAP_SYS_TIME, ...

This models:
  * the per-thread capability sets and the rules that gate what a
    process ends up with after execve()
  * the bounding set as a hard ceiling
  * "what does this service actually need" vs "it runs as full root"
"""

ALL_CAPS = {
    "CAP_CHOWN", "CAP_DAC_OVERRIDE", "CAP_DAC_READ_SEARCH", "CAP_FOWNER",
    "CAP_KILL", "CAP_SETGID", "CAP_SETUID", "CAP_SETPCAP", "CAP_NET_BIND_SERVICE",
    "CAP_NET_RAW", "CAP_NET_ADMIN", "CAP_SYS_CHROOT", "CAP_SYS_PTRACE",
    "CAP_SYS_ADMIN", "CAP_SYS_MODULE", "CAP_SYS_TIME", "CAP_SYS_NICE",
    "CAP_SYS_RESOURCE", "CAP_MKNOD", "CAP_AUDIT_WRITE", "CAP_BPF", "CAP_PERFMON",
}


def caps_after_execve(file_perm, file_inherit, file_effective_bit,
                      thr_perm, thr_inherit, thr_ambient, bounding):
    """Simplified capset transition on a non-setuid execve of a program
    that itself carries file capabilities (setcap).

      P'(permitted)   = (P(inheritable) & F(inheritable))
                        | (F(permitted) & bounding)
                        | P(ambient)
      P'(effective)   = P'(permitted)              if F(effective) bit
                        else P(ambient)
      P'(inheritable) = P(inheritable)   (unchanged)
      P'(ambient)     = P(ambient) & P'(permitted) & P'(inheritable)
    """
    new_perm = ((thr_inherit & file_inherit)
                | (file_perm & bounding)
                | thr_ambient)
    new_eff = set(new_perm) if file_effective_bit else set(thr_ambient)
    new_ambient = thr_ambient & new_perm & thr_inherit
    return new_perm, new_eff, new_ambient


def attack_surface(held):
    """Very rough 'how much of root do you hold' score, weighted so the
    dangerous caps dominate."""
    weight = {"CAP_SYS_ADMIN": 25, "CAP_SYS_MODULE": 20, "CAP_SYS_PTRACE": 12,
              "CAP_DAC_OVERRIDE": 10, "CAP_DAC_READ_SEARCH": 8, "CAP_SETUID": 10,
              "CAP_SETGID": 8, "CAP_NET_ADMIN": 8, "CAP_BPF": 6, "CAP_SYS_TIME": 4,
              "CAP_NET_RAW": 4, "CAP_NET_BIND_SERVICE": 1, "CAP_CHOWN": 3,
              "CAP_KILL": 2, "CAP_SETPCAP": 15}
    full = sum(weight.get(c, 2) for c in ALL_CAPS)
    have = sum(weight.get(c, 2) for c in held)
    return round(100 * have / full, 1)


def main():
    # A web server that binds :443 and drops a raw-socket health check.
    needs = {"CAP_NET_BIND_SERVICE", "CAP_NET_RAW"}

    print("Running the web server as full root:")
    root_score = attack_surface(ALL_CAPS)
    print(f"  holds ALL {len(ALL_CAPS)} caps -> attack surface {root_score}%")

    print("\nRunning it with only what it needs (setcap / AmbientCapabilities=):")
    least_score = attack_surface(needs)
    print(f"  holds {sorted(needs)} -> attack surface {least_score}%")
    assert least_score < 5.0, least_score
    assert root_score == 100.0

    # A CVE gives the attacker code-exec in the process. What can they do?
    print("\nPost-exploitation reach (attacker has code-exec in the process):")
    for name, held in [("as root", ALL_CAPS), ("least-priv", needs)]:
        can_load_module = "CAP_SYS_MODULE" in held
        can_read_any_file = held & {"CAP_DAC_OVERRIDE", "CAP_DAC_READ_SEARCH"}
        can_ptrace_others = "CAP_SYS_PTRACE" in held
        print(f"  {name:>10}: load kernel module={can_load_module}  "
              f"read any file={bool(can_read_any_file)}  "
              f"ptrace other procs={can_ptrace_others}")
    assert "CAP_SYS_MODULE" not in needs
    assert not (needs & {"CAP_DAC_OVERRIDE", "CAP_DAC_READ_SEARCH"})

    # execve() capability math: a program with NO file caps, run by a
    # process with NO ambient caps, comes out with NOTHING (this is why
    # "set caps on the thread then exec a helper" silently loses them,
    # and why ambient caps were added in 4.3).
    bounding = set(ALL_CAPS)
    p, e, a = caps_after_execve(
        file_perm=set(), file_inherit=set(), file_effective_bit=False,
        thr_perm={"CAP_NET_BIND_SERVICE"}, thr_inherit=set(),
        thr_ambient=set(), bounding=bounding)
    print("\nexecve of a plain helper from a process holding CAP_NET_BIND_SERVICE"
          " (no inheritable, no ambient):")
    print(f"  permitted after exec = {sorted(p) or '{} (LOST)'}")
    assert p == set(), "non-ambient, non-file caps do not survive execve"

    # Now with ambient set correctly (systemd AmbientCapabilities=):
    p2, e2, a2 = caps_after_execve(
        file_perm=set(), file_inherit=set(), file_effective_bit=False,
        thr_perm={"CAP_NET_BIND_SERVICE"}, thr_inherit={"CAP_NET_BIND_SERVICE"},
        thr_ambient={"CAP_NET_BIND_SERVICE"}, bounding=bounding)
    print("  ...with inheritable+ambient set: permitted =", sorted(p2))
    assert p2 == {"CAP_NET_BIND_SERVICE"} and e2 == {"CAP_NET_BIND_SERVICE"}

    # Bounding set as a ceiling: even a file cap outside the bounding set
    # is dropped.
    p3, _, _ = caps_after_execve(
        file_perm={"CAP_SYS_MODULE"}, file_inherit=set(),
        file_effective_bit=True, thr_perm=set(), thr_inherit=set(),
        thr_ambient=set(), bounding=bounding - {"CAP_SYS_MODULE"})
    assert "CAP_SYS_MODULE" not in p3, "bounding set removed it"
    print("\n  bounding set drops CAP_SYS_MODULE even though the file grants it.")

    print("\nPASS — least privilege cuts post-exploit reach ~95%; ambient caps and the"
          " bounding set behave as the kernel specifies.")


if __name__ == "__main__":
    main()
