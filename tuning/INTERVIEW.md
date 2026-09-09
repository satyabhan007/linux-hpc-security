# Kernel & Performance Tuning — Interview Q&A

---

## NUMA

**Q: What is NUMA and roughly what does remote access cost?**
Non-Uniform Memory Access: on a multi-socket node each CPU has its own
memory controller. Local RAM ~90 ns; remote (other socket) ~140 ns plus
shared inter-socket link contention. A memory-bound thread on the wrong
node can lose 30–50%.

**Q: What is "first touch" allocation?**
Linux allocates a physical page on the NUMA node of the CPU that first
*writes* to it (not at `malloc`). So you must initialise data in the
same parallel region (same thread affinity) that will later use it, or
one thread touching everything puts all pages on one node.

**Q: `numactl` options you'd use for a single-socket job?**
`numactl --cpunodebind=0 --membind=0 ./app` — run on node 0's CPUs and
allocate only from node 0's memory. `--interleave=all` spreads pages
round-robin (good for a big shared array accessed by all sockets).

**Q: How do you confirm a NUMA problem?**
`numastat -p <pid>` — high `numa_miss` / `other_node`. Also `perf stat -e
node-loads,node-load-misses` and `lstopo` to see the layout.

**Q: What is `vm.zone_reclaim_mode` and why 0 for HPC?**
When set, the kernel reclaims pages from the local node before
allocating remotely — which can cause latency spikes and unnecessary
reclaim on a box with plenty of RAM elsewhere. HPC sets it `0`.

**Q: What is Sub-NUMA Clustering (SNC) / NPS?**
A BIOS option that splits one physical socket into 2–4 NUMA nodes to
expose the on-die memory-controller locality. Improves bandwidth-bound
codes that are NUMA-aware; can hurt codes that assume one node per
socket.

---

## Hugepages / TLB

**Q: Why do hugepages help?**
The TLB has a fixed, small number of entries. A 2 MiB page maps 512×
more memory per entry than a 4 KiB page, so a large working set causes
far fewer TLB misses and page-table walks. 1 GiB pages more still.

**Q: THP vs explicit hugepages?**
THP (Transparent Huge Pages): kernel auto-promotes 4K→2M in the
background. Convenient but `khugepaged` compaction causes latency
spikes. Explicit hugepages (`hugetlbfs`, `vm.nr_hugepages`): reserved up
front, deterministic — preferred for DBs and big HPC arrays, often with
`THP=never`.

**Q: THP settings?**
`/sys/kernel/mm/transparent_hugepage/enabled` = `always` / `madvise` /
`never`; `.../defrag` controls compaction aggressiveness. Latency
-sensitive systems use `madvise` or `never`.

**Q: How would you measure whether TLB misses are your bottleneck?**
`perf stat -e dTLB-load-misses,dTLB-loads,iTLB-load-misses` (miss ratio),
or `perf stat -e cycle_activity.stalls_mem_any` and the CPU's
page-walk-cycles event.

---

## cgroups v2

**Q: `cpu.max` vs `cpu.weight`?**
`cpu.max "QUOTA PERIOD"` = a hard ceiling (`50000 100000` = half a CPU).
`cpu.weight` (1–10000, default 100) = proportional share of whatever CPU
is left *under contention*; ignored when the CPU isn't contended.

**Q: `memory.max` vs `memory.high`?**
`memory.max` = hard limit; exceeding it (after reclaim) triggers a
cgroup OOM kill. `memory.high` = soft limit; crossing it throttles the
cgroup and aggressively reclaims, but doesn't kill. Sites often set
`high` below `max` as a warning band.

**Q: How does Slurm confine a job to its allocation?**
`TaskPlugin=task/cgroup` + `ProctrackType=proctrack/cgroup` +
`select/cons_tres`. `cgroup.conf` `ConstrainCores/RAMSpace/Devices=yes`
puts the job in a cpuset + `memory.max` + device allowlist. Without it,
`-c` and `--mem` are advisory.

**Q: A job requested 4 cores but spawns 32 threads. With cgroup
enforcement, what happens?**
The 32 threads are confined to the 4-core cpuset and time-share them —
the job just runs slowly, it can't steal cores from neighbours. Memory
beyond `memory.max` → cgroup OOM of that job only.

**Q: cgroups v1 vs v2 for resource control — why v2?**
Unified hierarchy (one tree, not one per controller), proper memory
accounting including page cache and kernel memory, `io` controller that
actually works with `blk-mq`, and cleaner delegation.

---

## Scheduler / frequency / idle

**Q: CPU governors — `performance` vs `powersave` vs `schedutil`?**
`performance`: max frequency always (predictable latency, more power).
`powersave`: with `intel_pstate`, scales with load (variable latency).
`schedutil`: scheduler-driven scaling (modern default). HPC latency
jobs pin `performance`.

**Q: What are C-states and why disable deep ones for latency?**
Idle power states; deeper (C6) saves more power but takes microseconds
to exit. For latency-critical or tightly-coupled work, limit to C1
(`intel_idle.max_cstate=1`) or `idle=poll` (never idle — big power cost).

**Q: `isolcpus`, `nohz_full`, `rcu_nocbs` — what does each do?**
`isolcpus`: keep the scheduler's load balancer off these cores (only
explicitly-pinned tasks run there). `nohz_full`: stop the periodic timer
tick on these cores when one task is running (removes ~1 kHz of jitter).
`rcu_nocbs`: move RCU callback processing off these cores to a
housekeeping core.

**Q: Why turn `irqbalance` off on compute nodes?**
It periodically re-distributes IRQ affinity, which can land device
interrupts on your app cores mid-job. Disable it and pin IRQs to
housekeeping cores manually via `/proc/irq/*/smp_affinity`.

**Q: What is `kernel.numa_balancing` and when do you disable it?**
Automatic NUMA balancing periodically unmaps pages to detect access
patterns and migrate pages/tasks. For an already-pinned job it's pure
overhead and jitter — set to `0`.

---

## Approach

**Q: Latency tuning vs throughput tuning — how do they differ?**
Latency: fixed frequency, shallow C-states, isolated cores, `idle=poll`,
`THP=never` — predictable, power-hungry. Throughput: let turbo and
C-states work, `throughput-performance`/`hpc-compute` profile — maximise
total work, tolerate variance.

**Q: You applied a tuning profile and the benchmark regressed. What
now?**
Revert it. Re-measure with the same methodology (Module 4): same nodes,
pinned frequency recorded, ≥ 5 runs, median + spread. Change one knob at
a time and keep only what demonstrably helps outside the noise band.

**Q: `tuned` — what is it and which profiles matter for HPC?**
A daemon that applies bundles of sysctls, governor, C-state, THP, and
I/O-scheduler settings. `hpc-compute`, `latency-performance`,
`throughput-performance`. `tuned-adm active` / `tuned-adm verify`.

**Q: How do you make tuning stick across a stateless fleet?**
Bake it into the Warewulf image (Module 7): a `tuned` profile + a
`sysctl.d` drop-in + the kernel cmdline in the image's boot config, then
verify with `tuned-adm verify` and the OpenSCAP scan on every image
build.
