# Kernel & Performance Tuning — Deep Dive: Production Scenarios

---

## Scenario 1 — One node runs STREAM at 88% while its siblings hit 96%

**Walk the list, cheapest check first.**
```bash
cpupower frequency-info | grep -E 'governor|current'      # stuck on powersave?
turbostat --show Core,Busy%,Bzy_MHz,PkgWatt,CoreTmp -i 1  # throttling? low freq?
cat /sys/kernel/mm/transparent_hugepage/enabled           # THP=always -> compaction stalls
grep -c . /proc/irq/*/smp_affinity_list ; ps -eLo psr,comm | sort | uniq -c | sort -rn | head
dmidecode -t 17 | grep -E 'Speed|Configured'              # a DIMM at a lower speed
numactl -H                                                 # SNC/NPS BIOS setting differs?
```

**Findings, in rough order of frequency.**
1. Governor left on `powersave` (image drift, or `tuned` not applied).
2. THP compaction — `THP=always` on this node, `never` on the rest.
3. A stray daemon (monitoring agent, a scanner) pinned to a compute
   core, colliding with a rank.
4. C6 wakeups — `intel_idle.max_cstate` not set in kernel args here.
5. One DIMM negotiated to a lower speed → STREAM drops ~1/6.

Four of those five are one-line fixes; #5 is a reseat/replace. Bake the
first four into the Warewulf image (Module 7) and enforce with the
OpenSCAP scan / a `tuned` verify.

---

## Scenario 2 — Hybrid MPI+OpenMP job: half the expected performance

**Symptom.** 2 ranks/node × 24 threads on a 2×24-core node; runs ~1.9×
slower than a colleague's identical job.

**Diagnose.**
```bash
srun --cpu-bind=verbose ... true 2>&1 | head
grep Cpus_allowed_list /proc/self/status
numactl --show ; numastat -p $(pgrep -n solver)
env | grep -E 'OMP_NUM_THREADS|OMP_PLACES|OMP_PROC_BIND'
```

**Findings.**
- No `--cpu-bind` → the 24 threads of rank 0 spread across *both*
  sockets; memory first-touched on socket 0 is now half-remote →
  `numa_miss` huge.
- Or `OMP_PROC_BIND` unset → threads migrate every scheduler tick,
  trashing L2/L3 locality.

**Fix.**
```bash
srun --mpi=pmix -N2 --ntasks-per-node=2 --cpus-per-task=24 \
     --cpu-bind=cores --distribution=block:block --hint=nomultithread \
     env OMP_NUM_THREADS=24 OMP_PROC_BIND=close OMP_PLACES=cores \
         OMP_DISPLAY_ENV=true ./solver
```

Rank 0 → socket 0 cores + socket 0 memory; rank 1 → socket 1. First
-touch in the parallel region keeps every page local.

---

## Scenario 3 — A latency-critical service has periodic 2 ms hiccups

**Context.** A market-data / control-loop process on a shared node; p50
is 15 µs, p99.9 is 2 ms with no correlation to load.

**Hunt the jitter.**
```bash
# what's stealing the CPU from the hot thread?
perf sched record -- sleep 10 ; perf sched latency --sort max | head
# off-CPU (Module 5)
offcputime-bpfcc -p PID 10
# THP compaction events
grep thp /proc/vmstat ; cat /sys/kernel/mm/transparent_hugepage/enabled
# timer/RCU/kworker on the isolated cores?
ps -eLo psr,comm | awk '$1==5'
```

**Typical culprits.** THP `khugepaged` compaction on the hot core;
`kworker`/RCU callbacks on a core that *isn't* isolated;
`numa_balancing` migrating pages; a C6 exit adding ~50 µs.

**Fix — the isolation recipe.**
```
# kernel cmdline
isolcpus=nohz,domain,managed_irq,4-23 nohz_full=4-23 rcu_nocbs=4-23 \
intel_idle.max_cstate=1 processor.max_cstate=1 idle=poll \
transparent_hugepage=never numa_balancing=disable
```
Plus: pin the app to cores 4–23, keep the OS + IRQs on 0–3
(`irqbalance` off, manual `/proc/irq/*/smp_affinity`), `chrt -f` the hot
thread, and pre-fault + `mlock` its memory. `idle=poll` costs a lot of
power — use it only where the microseconds matter.

---

## Scenario 4 — A job on a shared node starved its neighbours

**Symptom.** Two jobs on one node; job A requested 4 cores, job B
requested 44. Job B is 3× slower than when it had the node alone. `top`
shows job A using ~30 cores.

**Cause.** `slurm.conf` had `SelectTypeParameters=CR_Core` (no cgroup
enforcement) or `TaskPlugin` missing `task/cgroup`. Core *counts* were
tracked but not *enforced*, so job A's OpenMP spawned 32 threads and the
kernel scheduler happily ran them.

**Fix.**
```
SelectType=select/cons_tres
SelectTypeParameters=CR_Core_Memory
TaskPlugin=task/cgroup,task/affinity
ProctrackType=proctrack/cgroup
# cgroup.conf
ConstrainCores=yes
ConstrainRAMSpace=yes
ConstrainDevices=yes
```
Now job A is confined to a 4-core cpuset and `memory.max`; its extra
threads time-share those 4 cores and it hits its own memory cap. (Lab:
`step2_cgroups_v2.py` models this.)

---

## Scenario 5 — After "tuning", the benchmark got *worse*

**What happened.** Someone applied `latency-performance` (`idle=poll`,
turbo pinned, C-states off) to *throughput* compute nodes. HPL dropped
4%: with C-states disabled and `idle=poll`, idle siblings burned power
budget and the running cores couldn't turbo as high; the extra heat
also nudged thermal limits.

**Lesson.** Latency tuning and throughput tuning are opposites:
- **Latency** (tightly-coupled MPI, control loops): shallow C-states,
  fixed frequency, isolated cores, `idle=poll` — predictable, more
  power.
- **Throughput** (embarrassingly parallel, batch): let turbo work,
  `performance` governor but C-states enabled, `throughput-performance`
  profile.

Always benchmark before/after with the Module 4 methodology, on the same
nodes, and revert anything that regresses.

---

## A compute-node tuning baseline (bake into the image)

```
# /etc/tuned/hpc-compute/tuned.conf  (or the stock hpc-compute profile)
[cpu]
governor=performance
energy_perf_bias=performance
min_perf_pct=100
[vm]
transparent_hugepages=never
[sysctl]
kernel.numa_balancing=0
kernel.sched_autogroup_enabled=0
vm.zone_reclaim_mode=0
vm.swappiness=10
vm.dirty_ratio=10
vm.dirty_background_ratio=3
kernel.nmi_watchdog=0
```

Kernel cmdline for the compute image:
`intel_idle.max_cstate=1 skew_tick=1 nohz_full=<app cores>
rcu_nocbs=<app cores> transparent_hugepage=never audit=0`
(drop `audit=0` if a STIG requires auditd — Module 3).
