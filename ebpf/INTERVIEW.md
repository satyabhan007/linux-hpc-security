# eBPF & Observability — Interview Q&A

---

## Fundamentals

**Q: What is eBPF in one sentence?**
A safe, verified virtual machine in the Linux kernel that runs
small event-driven programs attached to hooks (syscalls, functions,
tracepoints, packets), used for observability, networking, and security
without kernel modules.

**Q: How is safety guaranteed?**
The in-kernel **verifier** statically analyses every path before load,
rejecting unbounded loops, out-of-bounds/unchecked-pointer access,
uninitialised reads, and programs over the instruction-complexity limit.
If it can't prove safety, the program doesn't run.

**Q: Name three things the verifier rejects.**
Unbounded loops, dereferencing a possibly-NULL pointer without a check,
reading uninitialised stack, exceeding ~1M analysed instructions,
accessing memory outside a map's `value_size`.

**Q: eBPF vs a kernel module — trade-offs?**
Module: full power, can crash/panic the kernel, needs signing + matching
kernel, taints the kernel. eBPF: sandboxed, no reboot, portable
(CO-RE), but restricted to what the verifier allows and to defined
helper functions.

---

## Maps & data flow

**Q: How does an eBPF program get data to userspace?**
Via **maps** (hash, array, per-CPU array, LRU, histogram) that userspace
reads by fd, and the **ring buffer** for streaming ordered events.
There's no stdio in eBPF.

**Q: Ring buffer vs perf buffer?**
Perf buffer is per-CPU (events can arrive out of order across CPUs, and
memory is reserved per-CPU). The ring buffer (5.8+) is a single shared
MPSC buffer: ordered events, better memory efficiency, `reserve`/`commit`
so partial records are never seen.

**Q: Why a per-CPU array map for counters?**
No locking — each CPU updates its own slot; userspace sums them. Avoids
cache-line contention on a hot counter.

**Q: What's a BPF hash map keyed by PID typically used for?**
Storing per-process state between two events — e.g. the entry timestamp
of a syscall, subtracted at the return probe to get latency.

---

## Attach points

**Q: tracepoint vs kprobe — which do you prefer and why?**
Tracepoint: kernel-maintained, stable ABI, won't break on upgrade.
kprobe: attaches to any symbol dynamically, but the symbol can be
renamed, inlined away, or change signature between kernels. Prefer
tracepoints; use kprobes when there's no tracepoint.

**Q: fentry/fexit vs kprobe/kretprobe?**
fentry/fexit use a BPF trampoline — lower overhead, direct access to
typed arguments — but require BTF and a recent kernel. Functionally
similar attach point, faster.

**Q: What is XDP?**
eXpress Data Path — an eBPF hook at the earliest point in the driver
(before `skb` allocation). Used for DDoS drop, load balancing
(Katran), and fast forwarding. Actions: `XDP_DROP`, `XDP_PASS`,
`XDP_TX`, `XDP_REDIRECT`.

**Q: What are LSM BPF hooks for?**
Attaching eBPF to Linux Security Module hooks to make allow/deny
decisions (a programmable MAC layer) — used by KRSI / some runtime
security tools.

---

## CO-RE / BTF

**Q: What problem does CO-RE solve?**
Portability. The old bcc approach compiled the program on each host
against that kernel's headers (needs LLVM in prod, fragile). CO-RE
compiles once; libbpf relocates struct field offsets at load time using
**BTF** type info, so one binary runs across kernels.

**Q: What is BTF?**
BPF Type Format — compact debug/type info for kernel (and program)
data structures, shipped as `/sys/kernel/btf/vmlinux` when
`CONFIG_DEBUG_INFO_BTF=y`. CO-RE relocations and fentry need it.

---

## Practical

**Q: A process is "doing nothing" for seconds mid-job. Which tool?**
`offcputime` — it captures the stack at the moment a task goes off-CPU
and the duration, so you see whether it's blocked on a futex (lock),
`io_schedule` (disk/FS), page fault, or a `sleep`.

**Q: Tasks are slow to start running even though CPU is free-ish. Tool?**
`runqlat` — run-queue latency histogram. High values = scheduler
oversubscription or `cpu.max` throttling.

**Q: You need block-device latency. Full trace or histogram?**
`biolatency` (histogram) by default — `biosnoop` (every I/O) can itself
be heavy on a busy device. Histogram shows the p99 tail, which is
usually the point.

**Q: How do you find every process opening a specific file, live?**
`opensnoop -n name` or a bpftrace one-liner on
`tracepoint:syscalls:sys_enter_openat` filtered by `str(args->filename)`,
printing `comm`, `pid`, `ppid`, `uid`.

**Q: What privilege does loading a tracing eBPF program need?**
`CAP_BPF` + `CAP_PERFMON` (or root). Unprivileged eBPF is normally
disabled by a hardening sysctl.

**Q: A kretprobe on a hot function slowed the box. Why, and the fix?**
Every call now runs your handler + a trampoline; on a function called
millions of times/sec that's real CPU. Fix: attach more narrowly,
switch to `fentry`, sample instead of trace-all, or use a tracepoint.

**Q: How do you check what eBPF features a given kernel supports?**
`bpftool feature probe`, check kernel version, and
`ls /sys/kernel/btf/vmlinux` for BTF. Ring buffer ≥ 5.8, bounded loops
≥ 5.3, fentry ≥ ~5.5 with BTF.

**Q: Name three production systems built on eBPF and what they do.**
Cilium (K8s networking / kube-proxy replacement / policy), Falco or
Tetragon (runtime security via syscall monitoring), Parca / Pixie /
Grafana Beyla (continuous profiling & auto-instrumentation).
