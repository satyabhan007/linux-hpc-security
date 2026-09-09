# HPC Cluster Architecture & Slurm — The Amateur's Guide

> A hospital operating-theatre bookings desk. Surgeons (users) request a
> room, a team, and two hours. The desk (Slurm) sequences everyone by
> urgency, fairness, and what fits the gaps. You do not walk in and grab
> a theatre.

---

## 1. The parts of a cluster

| Role | Job |
|---|---|
| **login / head nodes** | you SSH here to edit, compile, submit — **never compute here** |
| **compute nodes** | the muscle; jobs run here, allocated exclusively or shared |
| **scheduler / controller** | `slurmctld` — decides what runs where and when |
| **shared storage** | `/home` (small, backed up), `/scratch` (big, fast, purged) — Module 10 |
| **interconnect** | the fast fabric MPI runs over — Module 9 |
| **accounting DB** | `slurmdbd` + MySQL — usage history, fairshare, `sacct` |

A **batch scheduler** (usually **Slurm**) is the operating system of the
whole thing: you describe a job, it queues, and it runs when the
resources are free and it's your turn.

```bash
#!/bin/bash
#SBATCH -p compute -N 4 --ntasks-per-node=48 -t 02:00:00
#SBATCH --job-name solve --output %x-%j.out
#SBATCH --mem=0                      # all memory on the node
module load openmpi/5.0 fftw
srun ./my_mpi_app                    # srun launches the ranks under Slurm
```

`sbatch job.sh` → queued. `squeue -u $USER`, `scontrol show job <id>`,
`sacct -j <id>` to inspect. `scancel <id>` to kill.

---

## 2. Partitions, QOS, and the two scheduling passes

- **Partition** = a queue over a set of nodes (`debug`, `compute`,
  `gpu`, `largemem`) with limits (max walltime, max nodes/user).
- **QOS** = a layer on top for priority, preemption, and extra limits
  (`--qos=high`, `--qos=preemptible`).

The scheduler runs two passes each cycle:

1. **Priority pass** — sort pending jobs by priority; start the ones
   that fit; the first that doesn't fit gets a **reservation** (the
   earliest time its resources free up).
2. **Backfill pass** — start a lower-priority job *now* **if it will
   finish before the reservation time**, so it can't delay the top job.

**Analogy — boarding a plane.** First class boards first (priority), but
the gate agent waves a quick standby passenger into an empty seat *if*
they'll be seated before the group that seat is held for (backfill).

> **This is why an honest, tight `--time` gets you in sooner.** A short
> job slots into gaps; a "24:00:00 just in case" job never backfills.

(Lab: `step1_slurm_backfill.py`.)

---

## 3. Fairshare — keeping a shared machine fair

Each account has a **target share** of the cluster. Your job priority
**rises** when you're under your share and **falls** when you're over,
and recent usage **decays** over a half-life. Total priority is a
weighted sum:

```
priority = w_age·age + w_fair·fairshare + w_partition·part
         + w_qos·qos + w_jobsize·size + w_tres·tres
```

`sprio -j <id>` shows the breakdown. "My colleague's jobs always start
first" is usually fairshare working: they ran little last week, you ran
a lot, and it's rebalancing over the half-life — not per job.

---

## 4. MPI: how a parallel job actually talks

**MPI** = N **ranks** (processes), each with an integer ID, communicating
by **messages**.

- **Point-to-point**: `MPI_Send` / `MPI_Recv` (and non-blocking
  `MPI_Isend`/`MPI_Irecv`).
- **Collectives**: `MPI_Bcast`, `MPI_Reduce`, `MPI_Allreduce`,
  `MPI_Alltoall` — everyone participates. **This is where scaling
  dies**: `Allreduce` cost grows with rank count and rides the network
  (Module 9). Good implementations use a **ring** or **tree** algorithm
  whose bandwidth term doesn't grow with P. (Lab: `step2_mpi_ring.py`.)
- **PMIx** is how Slurm and the MPI runtime bootstrap thousands of ranks
  quickly (`srun --mpi=pmix`).

**Binding matters.** `srun --cpu-bind=cores --distribution=block:block`
plus a correct `OMP_NUM_THREADS` so ranks and their threads land on the
right cores and NUMA node (Module 12). Bad binding silently halves
performance.

---

## 5. Topology-aware placement

Slurm's `topology/tree` plugin knows which **leaf switch** each node
hangs off. For a communication-heavy job it packs the nodes under as few
leaf switches as possible, keeping traffic local instead of climbing to
the spine. (Lab: `step3_topology_placement.py`.)

---

## 6. The control plane must not fall over

| Daemon | Role | Care |
|---|---|---|
| `slurmctld` | the scheduler | run a **backup** controller + shared `StateSaveLocation` |
| `slurmdbd` + MariaDB | accounting, fairshare history | back it up; it's not in the hot path but fairshare needs it |
| `munge` | auth between daemons | **clock skew > a few minutes breaks everything** — run chrony |
| `slurmd` (per node) | starts jobs, enforces cgroups | `sinfo -R` shows drained/down nodes with reasons |

Prologue/epilogue scripts do per-job health checks (bad node →
auto-drain) and cleanup (kill stray processes, drop caches). **NHC**
(Node Health Check) is the standard tool.

> A whole partition going `down` at once is almost always munge / clock
> skew, then the controller's disk (StateSave full), then the network —
> **not** the nodes.

---

## 7. Run the labs

```bash
python3 hpc/step1_slurm_backfill.py        # the priority + backfill passes
python3 hpc/step2_mpi_ring.py              # ring Allreduce: correct, and P-independent bandwidth
python3 hpc/step3_topology_placement.py    # best-fit placement under leaf switches
```

Next: **`fabric/`** — the wires that make those MPI collectives fast.
