# HPC Cluster Architecture & Slurm — Interview Q&A

---

## Architecture

**Q: What runs on a login node vs a compute node?**
Login: editing, compiling, job submission, light pre/post-processing —
shared, never heavy compute. Compute: the actual jobs, usually allocated
exclusively or with cgroup-enforced shares.

**Q: Name the core Slurm daemons.**
`slurmctld` (controller/scheduler, with an optional backup),
`slurmd` (one per compute node, launches jobs, enforces cgroups),
`slurmdbd` (accounting, talks to MySQL/MariaDB), and `munge` (shared
-secret auth between all of them).

**Q: What does munge do and what breaks it?**
Creates/validates authentication credentials between Slurm daemons using
a shared key. Breaks on key mismatch or **clock skew** beyond a few
minutes — run chrony/NTP everywhere.

---

## Scheduling

**Q: Priority pass vs backfill pass?**
Priority: order pending jobs, start those that fit, reserve resources
for the top job that doesn't. Backfill: start lower-priority jobs early
*only if* they finish before the reservation, so they can't delay the
top job.

**Q: Why does a shorter `--time` help my job start sooner?**
Backfill can only slot your job into a gap if it can *prove* your job
ends before the reserved resources are needed. Over-requesting walltime
makes you ineligible for those gaps.

**Q: What is a partition? A QOS?**
Partition = a named queue over a set of nodes with limits (walltime,
node caps). QOS = an overlay adding priority weight, preemption
behaviour, and its own limits, selectable per job (`--qos`).

**Q: How is job priority computed (multifactor)?**
A weighted sum of: age (time queued), fairshare (usage vs share),
partition, QOS, job size, and TRES factors. `sprio` shows the
breakdown; weights are `PriorityWeight*` in `slurm.conf`.

**Q: Explain fairshare and its half-life.**
Each account has a target share. Priority rises when under-share, falls
when over. Usage decays with `PriorityDecayHalfLife` so heavy users sink
temporarily and recover — it balances groups over that window, not per
job.

**Q: Preemption — what forms?**
QOS-based or partition-based: a higher-priority job can `SUSPEND`
(freeze + keep memory), `REQUEUE`, `CANCEL`, or `GANG` time-slice a
lower-priority job to reclaim its nodes.

**Q: `srun` vs `sbatch` vs `salloc`?**
`sbatch` submits a batch script. `salloc` gets an interactive
allocation (a shell with resources). `srun` launches a job step (the
parallel task) inside an allocation — it's also the MPI launcher.

**Q: What is `select/cons_tres` and why does it matter?**
The node-selection plugin that allocates *consumable* trackable
resources (cores, memory, GPUs) at sub-node granularity, so multiple
jobs can share a node with cgroup enforcement. `select/linear` allocates
whole nodes only.

---

## MPI

**Q: What is an MPI rank?**
One process in the parallel job, with a unique integer ID
(`MPI_Comm_rank`) within a communicator; ranks exchange data by
messages.

**Q: Point-to-point vs collective operations?**
P2P: `MPI_Send`/`Recv` between two ranks. Collective: all ranks in a
communicator participate — `Bcast`, `Reduce`, `Allreduce`, `Alltoall`,
`Barrier`. Collectives are the scaling bottleneck.

**Q: Why does `MPI_Allreduce` limit scaling, and how is it mitigated?**
Naive Allreduce moves O(P) data through one path. Ring/tree algorithms
cut the message count to ~2(P−1) of size n/P so the bandwidth term is
~P-independent; `MPI_Iallreduce` lets you overlap it with compute;
in-network reduction (SHARP, Module 9) offloads it to the switch.

**Q: Blocking vs non-blocking, and why prefer non-blocking for halos?**
Blocking `Send`/`Recv` can deadlock and forces serialisation.
`Isend`/`Irecv` + `Waitall` lets you post the boundary exchange, compute
the interior, then wait — overlapping communication with computation.

**Q: What is PMIx?**
Process Management Interface (exascale) — the API Slurm and the MPI
runtime use to bootstrap ranks (wire-up, key exchange) efficiently at
large scale. `srun --mpi=pmix`.

**Q: MPI + OpenMP hybrid — how do you set ranks and threads on a
48-core, 2-socket node?**
Typically 2 ranks/node (one per socket, or per NUMA domain) ×
`OMP_NUM_THREADS=24`, or 4×12. `--cpus-per-task`, `--cpu-bind=cores`,
`OMP_PROC_BIND=close`, `OMP_PLACES=cores`. Threads × ranks must equal
cores.

---

## Operations

**Q: How do you take a node out for maintenance without killing jobs?**
`scontrol update nodename=cpuNNN state=drain reason="..."` — running jobs
finish, no new jobs land. `state=resume` when done. `state=down` is
immediate and kills jobs.

**Q: `sinfo -R` — what does it show?**
Nodes in `drain`/`down`/`fail` states **with their reason strings**
(from NHC, the epilog, or an admin) — the operator's to-fix list.

**Q: What is NHC?**
Node Health Check — a script run by `slurmd` (`HealthCheckProgram`) on
an interval and at job start/end, verifying memory size, mounts, IB/GPU
health, scratch writability; on failure it drains the node.

**Q: A whole partition is DOWN. First three checks?**
munge + clock sync (chrony), then the controller's
`StateSaveLocation` disk, then the management network — a synchronised
fleet failure is a shared-cause failure.

**Q: `sacct` vs `squeue` vs `scontrol`?**
`squeue` = current queue. `scontrol show job/node/...` = live detail of
one object. `sacct` = historical accounting from `slurmdbd` (finished
jobs, exit codes, resource usage, efficiency).

**Q: How do you check a finished job's efficiency?**
`seff <jobid>` (CPU + memory efficiency), or `sacct -j <id> -o
Elapsed,TotalCPU,MaxRSS,ReqMem,AllocCPUS`. Low CPU efficiency ⇒
imbalance / I/O wait / wrong thread count.

**Q: Slurm alternatives?**
PBS Pro / OpenPBS, IBM Spectrum LSF, Grid Engine (SGE/UGE/Altair),
Kubernetes + Volcano/Kueue for containerised HPC. Slurm is the de-facto
default in research HPC.
