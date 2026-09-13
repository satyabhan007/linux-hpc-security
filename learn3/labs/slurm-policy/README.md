# Slurm partition / QOS / fairshare policy example

Companion to Chapters 1 and 8 (`learn3/`). A realistic, production-shaped
`slurm.conf` fragment defining a CPU and a GPU partition with a debug/short
queue overlapping both, plus a `sacctmgr` seed script that builds the
account hierarchy, QOS tiers, and fairshare weights those partitions
reference.

## Files

- `slurm.conf.fragment` — the `PartitionName=`, `NodeName=`, and
  priority/backfill scheduler parameters a site would drop into its real
  `slurm.conf`. Not a complete, standalone config (no `ClusterName`,
  `SlurmctldHost`, etc. — see Chapter 16's reference-architecture chapter
  for how this fits into the whole file).
- `sacctmgr_seed.sh` — idempotent-ish `sacctmgr` commands that create two
  department accounts, a preemptible/low-priority QOS, a short debug QOS,
  and set `RawShares` for fairshare, matching the accounts referenced by
  the `slurm.conf` fragment's `AllowAccounts=` lines.

## Try it

These files describe a real cluster's configuration; they are not meant to
be executed against a live `slurmctld`/`slurmdbd` unless you point them at
a real (or test) Slurm installation. Read `slurm.conf.fragment` alongside
[Chapter 1](../../#ch1) and `sacctmgr_seed.sh` alongside
[Chapter 11](../../#ch11) to see exactly which config line implements which
concept.

```bash
# once you have a real slurmdbd running and sacctmgr on PATH:
bash sacctmgr_seed.sh

# then append slurm.conf.fragment's contents into your real slurm.conf
# and restart/reconfigure:
sudo scontrol reconfigure
```
