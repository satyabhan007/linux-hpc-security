# HPC Cluster Architecture & Slurm — Deep Dive: Production Scenarios

---

## Scenario 1 — "My job has been PENDING for two days"

**Triage.**
```bash
squeue -j <id> -o "%.10i %.8u %.4P %.6D %.10l %R"    # the (Reason) column
scontrol show job <id> | grep -E 'Reason|StartTime|Priority'
sprio -j <id>                                        # priority breakdown
sinfo -p compute -o "%.10P %.5a %.6D %.6t %N"        # nodes idle vs alloc vs down
```

**Reasons and what they mean.**
| Reason | Meaning / fix |
|---|---|
| `Priority` | other jobs are ahead — check `sprio`, fairshare (you're over-share), or reduce `--time`/`-N` |
| `Resources` | not enough free nodes yet — `scontrol show job` `StartTime` is the backfill estimate |
| `ReqNodeNotAvail` | you asked for a feature/partition whose nodes are down/drained (`sinfo -R`) |
| `QOSMaxJobsPerUserLimit` / `AssocMaxNodes` | you hit a QOS/account cap — submit fewer or ask the admins |
| `PartitionTimeLimit` | your `--time` exceeds the partition max |
| `launch failed requeued held` | node/prolog failure — `scontrol release`, check the node |

**The usual fix:** a smaller/shorter job backfills. Over-requesting
walltime is the #1 self-inflicted delay.

---

## Scenario 2 — An entire partition goes DOWN

**Symptom.** `sinfo` shows 200 nodes `down*` within a minute of each
other. Jobs fail with `Communication connection failure`.

**Check shared things first (a synchronised failure ⇒ shared cause).**
```bash
# 1. auth + time
systemctl status munge ; munge -n | unmunge          # on ctld and a node
chronyc tracking ; chronyc sources -v                 # skew > ~5 min breaks munge
# 2. controller health
systemctl status slurmctld ; df -h $(scontrol show config | awk -F= '/StateSaveLocation/{print $2}')
journalctl -u slurmctld --since "-15min"
# 3. network to the nodes
ping -c1 cpu001 ; ssh cpu001 systemctl status slurmd
```

**Root causes, in order of frequency:** munge key mismatch / clock skew
(chrony died, or a leap-second/timezone change), `StateSaveLocation`
disk full, `slurmctld` OOM or crashed with no backup configured, a
management-network switch reboot. Individual hardware faults do **not**
synchronise.

---

## Scenario 3 — A job runs at half speed; binding is wrong

**Symptom.** A 4-node, 48-core-per-node hybrid MPI+OpenMP job runs
~1.9× slower than a colleague's identical job.

**Diagnose.**
```bash
srun --cpu-bind=verbose ... true 2>&1 | head          # print the actual map
# inside the job:
grep Cpus_allowed_list /proc/self/status
numactl --show
env | grep -E 'OMP_NUM_THREADS|OMP_PLACES|OMP_PROC_BIND|MKL'
```

**Findings.**
- `OMP_NUM_THREADS` unset → OpenMP spawns 48 threads *per rank*, 4
  ranks/node → 192 threads on 48 cores. Set threads = cores/ranks-per
  -node.
- No `--cpu-bind` → ranks migrate across sockets, memory ends up remote
  (Module 12).
- MPI progress thread sharing a core with a compute thread.

**Fix.**
```bash
srun --mpi=pmix -N4 --ntasks-per-node=4 --cpus-per-task=12 \
     --cpu-bind=cores --distribution=block:block --hint=nomultithread \
     env OMP_NUM_THREADS=12 OMP_PROC_BIND=close OMP_PLACES=cores ./solver
```

---

## Scenario 4 — Fairshare complaints

**Symptom.** A PI opens a ticket: "Group B's jobs always start before
ours."

**Explain with data.**
```bash
sshare -a -o Account,User,RawShares,NormShares,RawUsage,EffectvUsage,FairShare
sacct -a -S $(date -d '7 days ago' +%F) -X -o Account,Elapsed,AllocCPUS,AllocTRES%40 | \
  awk '...'   # sum CPU-hours per account
```

Usually: Group A burned 3× its share in the last half-life; Group B was
idle. Fairshare is *rebalancing* — it equalises over the decay
half-life (`PriorityDecayHalfLife`), not per job. Options: raise Group
A's `RawShares` if their allocation genuinely grew, shorten the
half-life for faster correction, or add a `qos` with a per-account
running-job cap.

---

## Scenario 5 — Nodes drain themselves mid-job

**Symptom.** `sinfo -R` shows nodes `drained` with reasons like
`Low RealMemory`, `Kill task failed`, `NHC: ib0 down`, `Prolog error`.

**What's happening.** The epilogue/NHC found a problem and drained the
node so no new job lands on it. `Kill task failed` = a job's processes
wouldn't die (D-state on hung storage, Module 10) within
`UnkillableStepTimeout`.

**Handling.**
```bash
sinfo -R -o "%.16N %.60E"                 # nodes + drain reasons
scontrol show node cpu042 | grep -E 'Reason|RealMemory|State'
# after fixing:
scontrol update nodename=cpu042 state=resume
```

Configure NHC to check: memory size, filesystem mounts, IB link state
(`ibstat`), GPU health (`nvidia-smi -q`), scratch writability, and
`munge`. Auto-drain-on-fail keeps bad nodes out of the pool; a dashboard
of `sinfo -R` reasons tells operators what to fix.

---

## `slurm.conf` fragments that matter

```
SchedulerType=sched/backfill
SchedulerParameters=bf_window=4320,bf_resolution=60,bf_max_job_test=2000,default_queue_depth=200
SelectType=select/cons_tres
SelectTypeParameters=CR_Core_Memory
PriorityType=priority/multifactor
PriorityWeightFairshare=100000
PriorityWeightAge=10000
PriorityWeightJobSize=1000
PriorityDecayHalfLife=7-0
PreemptType=preempt/qos
ProctrackType=proctrack/cgroup
TaskPlugin=task/cgroup,task/affinity
TopologyPlugin=topology/tree
HealthCheckProgram=/usr/sbin/nhc
HealthCheckInterval=300
UnkillableStepTimeout=120
```

`select/cons_tres` + `task/cgroup` is what actually confines a job to
its cores and memory (Module 12). Without it, `--mem` and `-c` are
advisory.
