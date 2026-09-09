# Parallel Storage — Interview Q&A

---

## Architecture

**Q: Why can't a single NFS server serve a large cluster's `/scratch`?**
One server = one set of NICs, one CPU, one disk subsystem — a hard
bandwidth and IOPS ceiling. A parallel filesystem spreads one namespace
across many servers so aggregate performance scales with hardware, and
clients stripe a file across many of them in parallel.

**Q: Lustre components — MDS/MDT vs OSS/OST vs MGS?**
MDS/MDT: metadata server + its backing target — the namespace,
filenames, permissions, and each file's *layout*. OSS/OST: object
storage server + target — the file *data*. MGS: small management/config
server. Client: presents POSIX, talks to MDS then directly to OSSes.

**Q: What happens on `open()` in Lustre?**
The client queries the MDS, which returns the file's layout (which OSTs,
stripe size). All subsequent read/write goes client↔OSS directly; the
MDS is out of the data path.

**Q: `/home` vs `/scratch` — how do they differ operationally?**
`/home`: small, backed up, often NFS, quota-tight, not for job I/O.
`/scratch`: large, fast parallel FS, **not backed up**, subject to a
purge policy. You stage data in, compute, copy results out.

---

## Striping

**Q: stripe count vs stripe size?**
Stripe count = number of OSTs the file spans. Stripe size = bytes
written to one OST before wrapping to the next (must be a multiple of
1 MiB in Lustre).

**Q: What caps single-file bandwidth?**
`min(stripe_count, number_of_writers, number_of_OSTs) × per-OST
bandwidth`. `stripe_count=1` caps a file at one OST regardless of how
many clients read it.

**Q: Why is `stripe_count=1` on a 40 TB shared file a bug?**
It's limited to one OST's throughput, and all 40 TB lands on one OST —
which fills or overflows it, producing ENOSPC even though the filesystem
overall has free space.

**Q: How would you stripe (a) 10,000 tiny config files, (b) a 2 TB
shared restart file?**
(a) `stripe_count=1` (or Data-on-MDT) — spreading tiny files just adds
metadata and RPCs. (b) `stripe_count` 16–32, `stripe_size` 4M, so many
OSTs and many client processes read it in parallel.

**Q: What is Progressive File Layout (PFL)?**
A composite layout: few stripes for the first N MiB, more as the file
grows (`lfs setstripe -E 1G -c 1 -E 100G -c 8 -E -1 -c 32`). Small files
stay cheap; large files auto-widen. Good default for `/scratch`.

**Q: What is Data-on-MDT (DoM)?**
Small files (below a threshold) are stored on the MDT's fast flash
instead of the OSTs, removing the OST round-trip and lock overhead for
the small-file case.

---

## Metadata

**Q: What is a "metadata storm" and what's the symptom?**
Many clients doing `open`/`stat`/`create`/`unlink` (or a recursive
`ls -l`/`find`/`du` on millions of files) saturating the single MDS.
Symptom: every `ls` hangs for tens of seconds, jobs stall in D-state,
but data bandwidth is unaffected.

**Q: Why does `ls -l` on a huge directory hang a login node?**
A long listing issues a `stat()` per entry (and colour `ls` stats even
without `-l`). Millions of `stat()`s flood the MDS; everyone else's
metadata ops queue behind it.

**Q: `ls`/`find` vs `lfs find` on Lustre — why the latter?**
`lfs find` queries the MDS efficiently (fewer round-trips, can filter by
OST/stripe/size server-side) instead of doing a `stat()` per entry like
POSIX `find`.

**Q: What is DNE?**
Distributed Namespace Environment — multiple MDTs. DNE1 places whole
directories on different MDTs; DNE2 stripes a single directory across
MDTs (`lfs setdirstripe -c N`), sharding metadata load.

**Q: Which quota dimension exhausts first with small files?**
Inodes. A user with a block quota to spare can still hit the **inode**
quota by creating millions of tiny files. `lfs quota` shows both.

---

## Access patterns & benchmarks

**Q: Best I/O pattern for 4,000 ranks writing one dataset?**
One shared file via MPI-IO with collective buffering, large
stripe-aligned transfers (≥ 1 MiB), striped across many OSTs, one
`fsync` at the end. File-per-process explodes metadata at that scale;
shared-append and small random writes cause lock contention.

**Q: Why does misaligned or small I/O kill parallel-FS performance?**
Sub-stripe writes cause read-modify-write on the boundary object and
lock contention when multiple ranks touch the same stripe; per-RPC
overhead dominates for small transfers, so effective bandwidth
collapses.

**Q: IOR vs mdtest — what does each measure?**
IOR: data-path throughput (GB/s) under controlled transfer size,
file mode (shared vs FPP), and MPI-IO mode. mdtest: metadata rates
(creates/stats/unlinks per second) — a different bottleneck (the MDS).

**Q: IOR benchmark says 30 GB/s but the job gets 2 GB/s. Where do you
look?**
The job's actual pattern: file-per-process at huge scale (metadata),
`stripe_count=1` on the shared file, tiny unaligned records, or
`fsync` per record. Darshan or `obdfilter.*.job_stats` shows it.

---

## Operations

**Q: What is a Lustre client eviction?**
The server forcibly disconnects a client that didn't respond in time
(network blip, or the client too slow to return a lock). The job sees
I/O errors. Fix the fabric flakiness; tune adaptive timeouts; drain
nodes that repeatedly evict.

**Q: `lfs df` shows 20% free but writes fail with ENOSPC. Cause?**
One OST is 100% full (imbalanced striping — a big `stripe_count=1`
file). Migrate objects off it, set a PFL default, and disable creates on
the full OST until rebalanced.

**Q: Lustre vs BeeGFS — when would you pick BeeGFS?**
When you want most of the performance with markedly lower operational
complexity — simpler daemons, easy client install, friendlier metadata
scaling — for a mid-size cluster or a team without dedicated storage
engineers.

**Q: How do you attribute I/O load to a specific job?**
Lustre **jobstats**: `lctl get_param obdfilter.*.job_stats` and
`mdt.*.job_stats` tag I/O with the `SLURM_JOB_ID` (via
`lctl set_param jobid_var=SLURM_JOB_ID`), so you can name the job
hammering the filesystem.

**Q: What's the danger of putting `/scratch` behind the same fabric as
MPI, and the fix?**
A parallel-I/O burst can saturate shared links and add latency to MPI
collectives. Fix: a dedicated storage fabric, or QoS/traffic classes
separating storage from compute traffic.
