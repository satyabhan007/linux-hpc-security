# Parallel Storage — Deep Dive: Production Scenarios

---

## Scenario 1 — `ls` hangs cluster-wide

**Symptom.** Every user reports `ls`, `bash` tab-completion, and job
startup hanging for 20–60 s. `top` on the MDS shows load 300, CPU busy
in `ll_md_*` threads.

**Diagnose.**
```bash
# on a client
lctl get_param mdc.*.stats                      # req_waittime, req_active climbing
lfs df -h ; lfs df -i                            # is an MDT full / inode-exhausted?
# on the MDS
lctl get_param mdt.*.md_stats
lctl get_param mdt.*.job_stats | sort -k... | head   # which JOBID is hammering it?
```

**Root cause.** A user ran `du -sh /scratch/project` (30 million files)
on a login node, or a job did `open`/`stat` on 4,000 small
files × 8,000 ranks at once. `mdt.*.job_stats` names the culprit
(Slurm JOBID).

**Immediate.** Kill/renice the offending process; if it's a job,
`scontrol hold`/`scancel`. Ask users to stop `du`/`find`/`ls -l` on huge
trees.

**Structural.**
- **DNE**: add MDTs, stripe big directories (`lfs setdirstripe -c 4`).
- **DoM**: `lfs setstripe -E 64K -L mdt -E ...` so tiny files skip the
  OSTs.
- Login-node protection: `nice`/cgroup limits on interactive shells,
  and an alias steering `find`→`lfs find`.
- Quotas on **inodes**, not just blocks — small-file sprawl exhausts
  inodes long before space.

---

## Scenario 2 — Writes fail with ENOSPC, but `df` shows 20% free

**Symptom.** `lfs df` overall: 20% free. But jobs fail writing a large
file.

**Cause.** `lfs df` per-OST shows **one OST at 100%**. A job set
`stripe_count=1` (or the default was 1) on a 40 TB file, so all 40 TB
landed on a single OST while the other 47 sit half-empty.

**Fix.**
```bash
lfs df -h | sort -k5 -h                       # find the full/imbalanced OST
lfs setstripe -c 8 -S 4M /scratch/            # sane directory default
lfs setstripe -E 1G -c 1 -E 100G -c 8 -E -1 -c 24 /scratch/big/   # PFL
# rebalance: migrate objects off the full OST
lfs find /scratch -O <ost_index> -size +10G -print0 | \
  xargs -0 -n1 lfs migrate -c 8
lctl set_param osp.<fsname>-OST<full>-osc-*.max_create_count=0     # stop new allocs there
```

**Prevent.** A default PFL layout on `/scratch`, and monitoring on
per-OST `%full` with an alert at 85% and a hard "disable creates" at
95%.

---

## Scenario 3 — IOR shows 30 GB/s, the real job gets 2 GB/s

**Symptom.** Acceptance IOR (one shared file, 4 MiB aligned, collective)
hits spec. A production job doing checkpoints crawls.

**Diagnose the job's actual I/O.**
```bash
# Lustre job stats attribute I/O to the SLURM JOBID
lctl get_param obdfilter.*.job_stats | awk '/job_id/{...}'
# Darshan (link or LD_PRELOAD) -> per-file, per-access-size histogram
export DARSHAN_LOGPATH=...
```

**Findings.**
- The job writes **file-per-process, 8 KiB records**, 4,096 ranks → tiny
  unaligned I/O + a create storm.
- Or: `stripe_count=1` on the shared checkpoint file.
- Or: `fsync()` after every record.

**Fix.** Switch to MPI-IO collective writes (`romio` hints:
`cb_buffer_size=16M`, `romio_cb_write=enable`), align records to stripe
size, buffer in memory and write ≥ 1 MiB, stripe the file across 16–32
OSTs, `fsync` once at the end. HDF5/ADIOS2/PnetCDF do most of this for
you.

---

## Scenario 4 — Lustre client evictions

**Symptom.** Jobs die with `bad file descriptor` / `-108 (ESHUTDOWN)`;
`dmesg` on the node: `Lustre: ...: This client was evicted by ...`.

**Causes.**
- A **network blip** on the storage fabric (Module 9) — the server
  didn't hear the client's ping within `obd_timeout` and evicted it.
- The **client was too slow to return a lock** (memory pressure, a
  D-state storm) → server revokes and evicts.
- Server-side failover/recovery where the client didn't reconnect in the
  recovery window.

**Fix / mitigate.** Fix the fabric flakiness first. Tune `obd_timeout` /
`at_min` / `at_max` (adaptive timeouts) if the fabric has known
latency. Ensure NHC drains a node that logs repeated evictions. Keep
client and server Lustre versions compatible.

---

## Scenario 5 — Choosing between Lustre and BeeGFS for a new cluster

| Factor | Lustre | BeeGFS |
|---|---|---|
| Peak scale / throughput | very high (exascale sites) | high, slightly less headroom |
| Operational complexity | high — LNet, quotas, DNE, recovery tuning | notably lower — simpler daemons, easy client |
| Small-file / metadata | needs DNE + DoM tuning | metadata scales by adding metadata servers, generally friendlier |
| Support | community + DDN/others (commercial) | ThinkParQ commercial; community for basics |
| Hardware | flexible; ldiskfs or ZFS OSTs | flexible |
| Sweet spot | large national/enterprise HPC, max performance | mid-size clusters, teams wanting less ops burden |

**GPFS/Storage Scale** if you want an integrated, supported, licensed
product with strong features (AFM, snapshots, tiering). **DAOS / VAST /
WEKA** if the workload is small-file / metadata / mixed and you can go
all-flash.

---

## Operating checklist

```bash
lfs df -h ; lfs df -i                         # space + inodes, per target
lctl get_param 'osc.*.rpc_stats' 'llite.*.stats'
lctl get_param obdfilter.*.job_stats mdt.*.job_stats   # per-job I/O
lfs quota -u $USER /scratch                    # block AND inode usage
lctl get_param 'ldlm.namespaces.*.pool.granted'  # lock pressure
lnetctl net show ; lnetctl peer show          # LNet health
```

Monitor: per-OST `%full` and imbalance, MDS `req_waittime`, client
eviction count, LNet errors, and per-job I/O so you can name the job
that's hurting everyone.
