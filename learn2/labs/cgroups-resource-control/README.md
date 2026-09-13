# cgroups v2 resource control — a real batch-jobs slice

Companion lab for Ch4 (cgroups v2 & resource control at scale).

## Files

- **`batch-jobs.slice`** — a systemd slice unit expressing the exact
  cpu/memory/io/pids limits from Ch4: `CPUQuota`/`CPUWeight` for CPU,
  `MemoryHigh` below `MemoryMax` (soft throttle before hard OOM-kill, per
  Ch4's `memory.high` vs `memory.max` scenario), `IOWeight`, and `TasksMax`
  as a fork-bomb blast-radius control.
- **`apply-cgroup-limits.sh`** — installs the slice unit under
  `/etc/systemd/system/`, reloads systemd, and optionally launches a given
  command inside the slice via `systemd-run --slice=... --scope`.
- **`verify-cgroup-limits.sh`** — reads back the live cgroups v2 controller
  files (`cpu.max`, `cpu.stat`, `memory.current`/`.high`/`.max`,
  `memory.events`, `io.max`) for the slice, so you can confirm the limits
  are actually enforced rather than just declared.

## Usage

```
sudo ./apply-cgroup-limits.sh -- ./my_batch_job.sh
./verify-cgroup-limits.sh
```

## What to look for

- `cpu.stat`'s `nr_throttled`/`throttled_usec` climbing while average CPU%
  looks low is the Ch4 "cpu.max throttling mystery" scenario in the wild —
  the job bursts to quota early in each period, then throttles.
- `memory.events`' `high` counter incrementing without a corresponding `oom`
  means `MemoryHigh` is doing its job: throttling and reclaiming before the
  hard `MemoryMax` boundary is ever reached.

## Notes on validation

This lab installs a real systemd unit and reads real `/sys/fs/cgroup`
controller files — it requires a systemd host with cgroups v2 (the unified
hierarchy) mounted, root privileges, and is not runnable inside a
permission-restricted CI sandbox. Both shell scripts are syntax-checked
(`bash -n`) and hand-reviewed against `shellcheck`-style conventions
(`set -euo pipefail`, quoted expansions, no unused variables) as part of
this repository's CI.
