# eBPF & Observability — Deep Dive: Production Scenarios

---

## Scenario 1 — "One rank in a 512-rank job is 3× slower, randomly"

**Symptom.** A tightly-coupled MPI job's wall time varies 2–3× between
otherwise-identical runs. Profilers show one rank late to every
`MPI_Allreduce`.

**Investigate on the suspect node while a job runs.**
```bash
# where is that rank's time going when it's NOT on CPU?
offcputime-bpfcc -p $(pgrep -f solver | head -1) 10

# syscall latency for the rank
funclatency-bpfcc -p PID 'vfs_read'
funclatency-bpfcc 't:syscalls:sys_enter_futex'   # lock contention?

# block I/O behind it
biolatency-bpfcc 5 2
biosnoop-bpfcc | grep solver
```

**Findings that actually turn up.**
- `offcputime` shows seconds in `io_schedule` → a filesystem stall
  (Module 10 metadata storm, or a slow OST).
- Huge `futex` time → lock contention inside the app or an MPI progress
  thread fighting the compute threads for a core (binding bug, Module
  12).
- `biolatency` bimodal with a millisecond tail → a failing local disk or
  swap being touched.
- `tcpretrans` firing → a marginal fabric link (Module 9); the run that
  routed across it is the slow one.

eBPF gets you this **without** stopping the job or installing an agent.

---

## Scenario 2 — Node's load is high, `top` shows nothing obvious

```bash
execsnoop-bpfcc -T                 # a cron job / monitoring agent forking a storm?
runqlat-bpfcc 5 3                  # tasks waiting a long time for CPU => oversubscription
runqlen-bpfcc 5 3
profile-bpfcc -F 99 -adf 10 > out.folded && flamegraph.pl out.folded > cpu.svg
```

**Typical resolution.** `execsnoop` reveals a misconfigured node-health
-check or a security scanner re-forking every second; or `runqlat` shows
the node is running 2× more threads than cores (someone's job spawned
`OMP_NUM_THREADS=128` on a 64-core node — a binding/env bug).

---

## Scenario 3 — Which process keeps touching a file it shouldn't

**Ask.** "Something rewrites `/etc/resolv.conf` / keeps opening
`/dev/kmsg` / is scanning `/proc` — who?"

```bash
opensnoop-bpfcc -n '' | grep resolv.conf
bpftrace -e 'tracepoint:syscalls:sys_enter_openat /str(args->filename) == "/etc/resolv.conf"/ {
    printf("%s pid=%d ppid=%d uid=%d\n", comm, pid, curtask->real_parent->pid, uid);
}'
```

Static, stable tracepoint; exact culprit with parent and UID in one
line. The pre-eBPF answer was `auditd` rules + log-diving, or `strace`
on a guess.

---

## Scenario 4 — Runtime security on a shared cluster

**Goal.** Detect: a job spawning a shell from an MPI rank, writing to
`/etc`, loading a kernel module, or making an outbound connection from a
compute node.

**Tooling.** **Falco** (eBPF driver) with rules, or **Tetragon**
(Cilium), or hand-rolled bpftrace for a narrow case:

```bash
bpftrace -e '
tracepoint:syscalls:sys_enter_execve
/ strncmp(str(args->filename), "/bin/sh", 7) == 0 ||
  strncmp(str(args->filename), "/bin/bash", 9) == 0 /
{ printf("SHELL %s by pid %d (%s) uid %d\n", str(args->filename), pid, comm, uid); }

tracepoint:syscalls:sys_enter_init_module
{ printf("MODULE LOAD by pid %d (%s) uid %d\n", pid, comm, uid); }'
```

Ship events to the SIEM. This complements auditd (Module 2), catching
things at syscall granularity with far less overhead than a full audit
ruleset.

---

## Scenario 5 — kube-proxy iptables is the bottleneck (edge / login-node k8s)

**Symptom.** Service resolution latency grows with the number of
services; `iptables-save` is 40k lines; conntrack table pressure.

**Fix.** Cilium in **kube-proxy-replacement** mode: service load
balancing, NAT, and network policy move to eBPF at the tc/XDP layer.
`O(1)` map lookups instead of a linear iptables chain walk, plus XDP
drop for policy denies before the packet enters the stack.

---

## Costs and limits (the honest part)

- **Verifier complexity ceiling.** Big programs with many branches hit
  the ~1M-instruction analysis limit; split into tail-called sub
  -programs.
- **Per-hook overhead is real.** A `kretprobe` on a very hot function
  (`vfs_read` on a busy fileserver) *does* cost measurable CPU. Sample,
  or use `fentry` (cheaper trampoline), or attach narrowly.
- **`CAP_BPF` / privilege.** Loading most programs needs `CAP_BPF` +
  `CAP_PERFMON` (or root). Unprivileged eBPF is largely disabled
  (`kernel.unprivileged_bpf_disabled=1`) — a hardening default (Module
  2) you keep.
- **Kernel version.** Ring buffer needs 5.8, `fentry`/BTF needs ~5.5+
  and `CONFIG_DEBUG_INFO_BTF=y`. Old enterprise kernels backport
  unevenly — check `bpftool feature`.
- **Full capture vs sampling.** `biosnoop` (every I/O) vs `biolatency`
  (a histogram) — on a busy system the histogram is the right default.

---

## Quick reference

```bash
bpftool prog list                       # loaded eBPF programs
bpftool map list                        # maps and their sizes
bpftool feature probe | grep -i btf     # does this kernel have BTF?
cat /sys/kernel/btf/vmlinux | wc -c     # BTF present?
ls /sys/kernel/debug/tracing/events/    # available tracepoints
bpftrace -l 'tracepoint:*'              # list attach points bpftrace can see
```
