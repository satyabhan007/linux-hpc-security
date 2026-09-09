# eBPF & Observability — The Amateur's Guide

> Instead of shutting the factory to install a permanent camera (a kernel
> module) or guessing from the output pile (logs), you clip a tiny,
> pre-approved sensor onto one machine while it runs — and unclip it when
> you're done.

---

## 1. What eBPF is

A way to load a small program **into the running kernel** that fires on
an event — a syscall, a function entry, a packet, a tracepoint —
collects data, and hands it to userspace. No kernel patch, no module, no
reboot, and (crucially) **it cannot crash or hang the kernel**.

It is how modern tools answer *"what is the kernel actually doing right
now?"* with near-zero overhead: Cilium (networking), Falco (security),
Parca/Pixie (profiling), and the whole bcc/bpftrace toolkit.

```bash
# every file opened, system-wide, live, by which command:
bpftrace -e 'tracepoint:syscalls:sys_enter_openat {
    printf("%-16s %s\n", comm, str(args->filename)); }'
```

---

## 2. The verifier — why your program gets rejected

The kernel runs your code only after **statically proving it is safe**.
The verifier walks *every possible path* and rejects:

- unbounded loops (bounded loops OK since kernel 5.3)
- out-of-bounds memory access
- dereferencing a pointer without a NULL check
- reading uninitialised stack / registers
- more than ~1M instructions processed
- touching kernel memory you weren't explicitly handed

**Analogy — a customs officer who checks every branch of your suitcase**
before you board. Not "looks fine" — opens every compartment in every
possible packing order. Nothing questionable gets on the plane, but you
can only pack what the rules clearly permit.

This is the deal: the compiler (`clang -target bpf`) and your code stay
inside what the verifier can reason about, and in exchange your code
runs in kernel context safely. (Lab: `step1_verifier_sim.py`.)

---

## 3. Talking to userspace: maps and the ring buffer

eBPF programs are event handlers with no `printf` to a terminal. They
communicate through **maps**:

| Map type | Use |
|---|---|
| **hash** | keep state between events (per-PID start timestamps) |
| **per-CPU array** | lock-free counters / scratch |
| **LRU hash** | bounded state that evicts oldest |
| **histogram** (array of buckets) | latency distributions |
| **ring buffer** (`BPF_MAP_TYPE_RINGBUF`, 5.8+) | stream ordered events to userspace |

The ring buffer replaced the older per-CPU perf buffer: one shared
MPSC buffer, ordered, efficient, with a **reserve → commit** protocol so
a half-written record is never visible, and a **drop counter** when the
reader falls behind. (Lab: `step2_ring_buffer.py`.)

**Analogy.** Maps are the labelled pigeonholes on the office wall: the
kernel-side worker drops notes in, the userspace reader empties them on
a schedule. The ring buffer is the pneumatic tube for messages that
must arrive in order, *now*.

---

## 4. Where you can attach (most to least stable)

| Hook | Notes |
|---|---|
| **tracepoint** | static, kernel-maintained, **stable ABI** — prefer these |
| **fentry / fexit** | BPF trampoline on any function, faster than kprobes, needs BTF |
| **kprobe / kretprobe** | dynamic, attach anywhere — but the symbol can vanish next release |
| **uprobe / uretprobe** | userspace functions (libc, your binary) |
| **LSM** | security decisions (allow/deny) |
| **XDP / tc** | packet processing, earliest/least overhead |
| **perf_event** | sampling profilers (`perf`-style) |

---

## 5. CO-RE — "compile once, run everywhere"

The old bcc model shipped LLVM to every host and compiled the program
against *that kernel's* headers at load time — slow, fragile, needs a
toolchain in prod. **CO-RE** fixes it: the program references struct
fields through **BTF** (kernel type info), and **libbpf** relocates the
field offsets at load time. One compiled binary runs across kernel
versions. This is why Cilium/Falco/Parca ship a single binary that just
loads.

---

## 6. The tools that resolve most "the box feels slow" tickets

| Tool | Answers |
|---|---|
| `execsnoop` | every process exec'd, with args and parent |
| `opensnoop` | every file open, which process, success/fail |
| `biolatency` | block-I/O latency histogram |
| `runqlat` | scheduler run-queue latency (how long tasks wait for CPU) |
| `offcputime` | *where* a process is blocked when it's not on CPU (lock? I/O? page fault?) |
| `tcpretrans`, `tcplife`, `tcpconnect` | TCP retransmits, connection lifetimes |
| `profile` | CPU stack sampling → flamegraph, system-wide |
| `funclatency`, `argdist` | latency / argument distributions of any function |

For HPC: per-rank syscall latency to find stragglers, `offcputime` for
the "my job did nothing for 8 seconds" mystery (usually a lock, a page
-fault storm, or a filesystem stall), `tcpretrans` on the management
net. (Lab: `step3_latency_hist.py` builds a `biolatency`-style histogram.)

---

## 7. Run the labs

```bash
python3 ebpf/step1_verifier_sim.py   # why the verifier accepts/rejects a program
python3 ebpf/step2_ring_buffer.py    # reserve/commit ring buffer with drop counting
python3 ebpf/step3_latency_hist.py   # a log2 latency histogram, p50/p99 from buckets
```

Next: **`ansible/`** — turning "I fixed it by hand on that node" into a
repeatable fact across the fleet.
