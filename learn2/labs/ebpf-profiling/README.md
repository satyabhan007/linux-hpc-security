# eBPF / perf profiling — scheduler & syscall latency

Companion labs for Ch1 (scheduler internals), Ch5 (perf & eBPF profiling in
production), and Ch9 (syscall tracing & auditing).

## Files

- **`sched_latency.bt`** — a `bpftrace` script that histograms
  wakeup-to-running scheduling latency system-wide, using the
  `sched:sched_wakeup{,_new}` and `sched:sched_switch` tracepoints. Run it
  under real load; a long tail on an otherwise idle-looking box points at a
  runqueue-imbalance or CPU-affinity problem (Ch1/Ch10), not an application
  bug.

  ```
  sudo bpftrace sched_latency.bt
  # Ctrl-C to print the histogram
  ```

- **`syscall_latency.bt`** — a `bpftrace` script that histograms per-syscall
  latency and counts calls by syscall ID, using the
  `raw_syscalls:sys_enter`/`sys_exit` tracepoints. Answers "which syscall is
  slow, and how often is it called" without the overhead of `strace -T`.

  ```
  sudo bpftrace syscall_latency.bt          # system-wide
  sudo bpftrace syscall_latency.bt -c nginx # trace one command
  ```

- **`opensnoop_example.py`** — a minimal BCC (BPF Compiler Collection)
  program tracing `openat()` calls system-wide (or filtered to one command),
  reporting latency and success/failure per open. Documented as a reference
  implementation: it requires the `bcc` Python bindings and kernel BPF
  support (see the file's docstring for install pointers) and is not meant
  to run in a bare sandbox — read it for the pattern, not to execute here.

## Why bpftrace, not perf, for these two

Both scripts answer a narrower, faster question than a full
`perf record -a -g` stack-sampling pass (Ch5): "how long between X and Y,
histogrammed" — exactly the shape of question eBPF tracepoints are built
for, at near-zero overhead compared to `strace`.

## Validating without a live kernel

`bpftrace --dry-run <file>.bt` parses and attempts to attach every probe,
then exits — the fastest way to confirm a script is syntactically valid
before running it against a real workload. Both `.bt` files here were
syntax-validated against `bpftrace` v0.25 during authoring (probe names,
tracepoint field access, and map/histogram usage all parse cleanly); actual
attachment requires root/CAP_BPF and a live kernel tracing subsystem, which
a CI sandbox typically does not grant.
