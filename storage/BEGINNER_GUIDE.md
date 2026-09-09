# Parallel Storage — The Amateur's Guide

> A library checkout with 50 counters instead of 1. Everyone still sees
> one catalogue (the namespace), but the actual books come from whichever
> counters hold your chapters — 50× the throughput at the door.

---

## 1. Why one NFS server isn't enough

2,000 nodes reading a dataset at once will flatten a single file server.
A **parallel filesystem** — **Lustre**, **BeeGFS**, IBM Storage Scale
(GPFS), DAOS, VAST, WEKA — spreads one namespace across many storage
servers so aggregate bandwidth scales with hardware. Clients talk to
**all** servers at once; a big file is **striped** across many disks and
read in parallel.

Typical cluster layout:

| Mount | Backing | Backed up? | Purge? |
|---|---|---|---|
| `/home` | small NFS | yes | no |
| `/scratch` or `/work` | Lustre/BeeGFS | **no** | **yes** (30–90 days) |
| `/apps` | NFS or read-only Lustre | yes | no |

> Treating `/scratch` as permanent is how people lose a month of runs.
> Stage in → run → copy results out.

---

## 2. Lustre anatomy

| Component | Holds |
|---|---|
| **MDS / MDT** (metadata server / target) | the directory tree, filenames, permissions, **and the layout** (which OSTs a file lives on) |
| **OSS / OST** (object storage server / target) | the actual file **data**, as objects |
| **client** | presents a normal POSIX mount; talks to MDS for metadata, then straight to OSSes for data |
| **MGS** | management config server (small) |

Opening a file: client asks the **MDS** → gets the **layout** (which
OSTs, stripe size) → all subsequent read/write goes **directly**
client ↔ OSS.

**Analogy.** The MDS is the library index desk; the OSTs are the stacks.
You ask the desk *once* where a book's chapters are shelved, then walk
straight to those aisles. If everyone queues at the one index desk
(metadata-heavy workload), the stacks sit idle and the line goes out the
door.

---

## 3. Striping

- **stripe count** = how many OSTs a file is spread across.
- **stripe size** = bytes written to one OST before moving to the next.

```bash
lfs setstripe -c 8 -S 4M bigfile     # 8 OSTs, 4 MiB chunks
lfs getstripe bigfile
lfs setstripe -c 1 -S 1M smallfiles/ # directory default for lots of tiny files
```

Aggregate bandwidth for one file ≈ `min(stripe_count, #clients, #OSTs)
× per-OST bandwidth`. So:

- **Never leave a multi-TB shared file at stripe_count = 1** — it's
  capped at one OST's speed *and* it fills that one OST (ENOSPC while
  `df` shows free space).
- Tiny files: 1 stripe. No benefit to spreading, and more metadata.
- Rule of thumb: a few stripes per GB, up to ~16–48 for very large
  shared files.

(Lab: `step1_lustre_stripe.py`.)

---

## 4. The number-one outage: the metadata storm

Thousands of ranks each doing `open` + `stat` + `create` on many small
files — or a recursive `ls -l` / `find` / `du` over millions of files on
a **login node** — saturates the **single MDS**.

Symptoms: every user's `ls` hangs for 30 s, jobs stall in I/O wait
(D-state, Module 1), the cluster "feels down". **Data bandwidth is
fine** — it's the index desk that's on fire.

**Fixes:**
- Teach users: don't `ls -l` a 5-million-file directory (colour `ls`
  `stat()`s every entry!). Use `lfs find`, not `find`.
- Pack small files into archives (`tar`, HDF5, a single shared file with
  **MPI-IO**).
- **DNE** (Distributed Namespace) — multiple MDTs, sharding directories.
- **DoM** (Data-on-MDT) — tiny files stored on fast MDT flash.
- A scratch **purge policy** so directories never reach millions of
  entries.

(Lab: `step3_metadata_storm.py` models the MDS as a queue.)

---

## 5. Access pattern is everything

Parallel filesystems **love** large, aligned, sequential I/O (≥ 1 MiB,
aligned to stripe size) and **hate** small random I/O and **false
sharing** (many ranks writing different offsets of the *same* stripe →
lock contention).

Patterns, best to worst:
1. **One shared file, MPI-IO collective buffering** — scales to huge
   rank counts.
2. **File-per-process** — fine at hundreds of ranks; a metadata storm at
   100,000.
3. **Many ranks appending to one log** — lock contention.
4. **Random 4 KiB updates** — worst case.

**Analogy.** Moving house with a truck (large sequential) vs a bicycle
doing 10,000 one-item trips (small random) — and the bicycle also has to
check the address list before every trip.

**IOR** benchmarks the data path; **mdtest** benchmarks metadata.
(Lab: `step2_ior_throughput.py`.)

---

## 6. Modern Lustre features worth knowing

| Feature | What it does |
|---|---|
| **PFL** (Progressive File Layout) | few stripes for the first MBs, many for large files — automatically |
| **DoM** (Data-on-MDT) | small files live on MDT flash — kills the small-file penalty |
| **DNE** | multiple MDTs — shard metadata load |
| **OST pools** | dedicate a set of OSTs (e.g. flash) to a project or hot data |
| **jobstats** | per-Slurm-job I/O accounting on the servers |

**BeeGFS** trades some of Lustre's scale for much easier operation.
**GPFS/Storage Scale** is feature-rich and licensed. **DAOS/VAST/WEKA**
are flash-native and reshape these rules.

---

## 7. Run the labs

```bash
python3 storage/step1_lustre_stripe.py     # pick a stripe layout, model BW + OST-fill risk
python3 storage/step2_ior_throughput.py    # throughput vs transfer size + access pattern
python3 storage/step3_metadata_storm.py    # MDS as a queue; DNE / lfs find as the fix
```

Next: **`containers/`** — making a run reproduce, and getting a
containerised MPI job onto this filesystem and fabric.
