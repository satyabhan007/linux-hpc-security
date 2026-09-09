# Kernel & Performance Tuning — The Amateur's Guide

> A road car adjusts everything for comfort and economy, automatically
> and invisibly. A race car is stiff, loud, always in the power band,
> and every setting is bolted to one value — because surprises cost lap
> time. Tuning a compute node is converting the first into the second.

---

## 1. Why the defaults are wrong for you

Out of the box Linux is tuned for a laptop: CPUs drop into deep sleep to
save battery, the scheduler is free to migrate any thread to any core,
transparent hugepages defrag in the background, interrupts land wherever.
Every one of those is a **latency surprise** for a compute node or a
low-latency service.

Tuning is making the machine **boring on purpose**: pinned, awake,
predictable. The single biggest lever is one command:

```bash
tuned-adm profile hpc-compute      # or: latency-performance / network-latency
tuned-adm active                   # what's applied now
```

That flips ~two dozen knobs at once (governor, C-states, THP, kernel
scheduler tunables, `numa_balancing`, sysctl). The rest of this module is
*what it's actually doing* and *when to go further by hand*.

---

## 2. NUMA — keep each worker next to its own pantry

A 2-socket node has **two memory controllers**. RAM attached to your
socket is **local** (~90 ns). RAM on the other socket is **remote**
(~140 ns) *and* every remote access crosses a shared inter-socket link.
A memory-bound thread on socket 0 pounding memory that lives on socket 1
can lose **30–50%** of its bandwidth — and slow every other remote
thread down too, because they all share that link.

```bash
lscpu | grep NUMA                     # which CPUs are on which node
numactl -H                            # node distances, free MiB per node
numactl --cpunodebind=1 --membind=1 ./app
numastat -p $(pgrep app)              # numa_miss / numa_foreign = trouble
```

**First-touch.** Linux allocates a page on the node of the CPU that
**first writes** it — not the one that `malloc`'d it. So initialise data
in the *same* parallel region that later reads it, or a single init
thread parks the whole array on one socket and half your threads go
remote.

> **Analogy.** Two kitchens in one restaurant. A chef working from the
> far pantry crosses the floor for every ingredient and collides with
> the other chef in the doorway. Keep each chef beside their own pantry.

(Lab: `step1_numa_placement.py` — models the bandwidth you lose to
remote access and link contention.)

---

## 3. cgroups v2 — a fuse box per workload

cgroups v2 is how you carve a node **without VMs**:

| Control | Meaning |
|---|---|
| `cpu.max "QUOTA PERIOD"` | hard ceiling — at most QUOTA µs of CPU per PERIOD µs (`50000 100000` = 0.5 CPU) |
| `cpu.weight` | proportional share (default 100) of whatever is left, **only under contention** |
| `memory.max` / `memory.high` | hard cap / soft throttle-and-reclaim |
| `io.max` | block-device bandwidth / IOPS cap |
| `pids.max` | fork-bomb guard |

Slurm's cgroup plugin uses exactly these, so a job that asked for 4 cores
and 16 GiB **physically cannot** use 8 cores, and if it leaks memory it
hits **its own** `memory.max` and gets an OOM-kill scoped to that job —
its neighbours never notice. `systemd` exposes the same as `CPUQuota=`,
`MemoryMax=`, `IOWeight=`.

> **Analogy.** Fuse boxes per apartment. One tenant overloading their
> circuit trips *their* fuse, not the building main.

(Lab: `step2_cgroups_v2.py` — `cpu.max` ceilings, `cpu.weight`
water-filling under contention, and the `ok → reclaim → oom` memory path.)

---

## 4. Hugepages — multiply your TLB reach

The CPU caches virtual→physical translations in the **TLB** (a few
thousand entries). With 4 KiB pages, a 16 GiB working set needs ~4
million translations — the TLB thrashes and every miss is a page-table
walk (~4 dependent memory accesses).

A **2 MiB** hugepage covers 512× the memory per TLB entry; a **1 GiB**
page, 512× more again.

| Working set | 4K-page slowdown | 2M-page slowdown |
|---|---|---|
| 8 MiB | ~1.0× | ~1.0× |
| 512 MiB | ~1.9× | ~1.0× |
| 4 GiB | ~3.0× | ~1.0× |

- **Explicit hugepages** (`vm.nr_hugepages`, `hugetlbfs`, MPI `--mca`) —
  predictable; used by databases and big scientific arrays.
- **Transparent Huge Pages** (THP) does it automatically, but its
  background `khugepaged` compaction causes periodic p99 latency spikes.
  Databases (Oracle, Postgres, JVMs) and many HPC shops set THP to
  `madvise` or `never`.

(Lab: `step3_hugepages_tlb.py` — TLB reach and the large-working-set
penalty, 4K vs 2M vs 1G.)

---

## 5. Killing jitter (the reason a 512-rank job runs at the speed of its slowest rank)

| Source | Fix |
|---|---|
| Deep C-states (µs wakeups) | `intel_idle.max_cstate=1`, `cpupower idle-set -D 0` (costs power) |
| Frequency scaling | `cpupower frequency-set -g performance`; pin turbo if you need determinism |
| Threads migrating / OS noise | `isolcpus`, `nohz_full`, `rcu_nocbs` on app cores; OS + kernel threads + IRQs on a housekeeping core |
| IRQ spray | `irqbalance` off; set `/proc/irq/*/smp_affinity` by hand |
| NUMA balancing page migration | `kernel.numa_balancing=0` for pinned jobs |
| THP compaction | THP `never` on latency-critical nodes |
| `kswapd` reclaim | leave memory headroom; `vm.swappiness=1` |

Measure jitter directly with `cyclictest` or a spin-loop, and **always
re-run the Module 4 benchmarks before/after** so a "tuning" change that
actually regresses is caught.

---

## 6. Run the labs

```bash
python3 tuning/step1_numa_placement.py   # bandwidth lost to remote memory + link contention
python3 tuning/step2_cgroups_v2.py       # cpu.max, cpu.weight, memory.max OOM path
python3 tuning/step3_hugepages_tlb.py    # TLB reach: 4K vs 2M vs 1G pages
```

Next: **`linux-security/`** — the kernel's own guardrails (LSMs, seccomp,
capabilities, namespaces as a boundary) that decide what a tuned,
fast process is actually *allowed* to do.
