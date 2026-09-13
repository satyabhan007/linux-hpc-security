#!/usr/bin/env bash
# verify-cgroup-limits.sh — print live cgroups v2 accounting for
# batch-jobs.slice, so you can confirm the limits in batch-jobs.slice are
# actually being enforced (Ch4's "the real test": can you point at the
# exact controller file that shows what happened).
#
# Usage:
#   ./verify-cgroup-limits.sh
set -euo pipefail

slice_path="/sys/fs/cgroup/batch-jobs.slice"

if [[ ! -d "$slice_path" ]]; then
  echo "slice cgroup not found at ${slice_path}" >&2
  echo "is batch-jobs.slice installed and active? try: systemctl status batch-jobs.slice" >&2
  exit 1
fi

echo "== cpu.max (quota period) =="
cat "${slice_path}/cpu.max"

echo
echo "== cpu.stat (watch nr_throttled / throttled_usec) =="
cat "${slice_path}/cpu.stat"

echo
echo "== memory.current / memory.high / memory.max =="
echo -n "current: "; cat "${slice_path}/memory.current"
echo -n "high:    "; cat "${slice_path}/memory.high"
echo -n "max:     "; cat "${slice_path}/memory.max"

echo
echo "== memory.events (watch high / max / oom counts) =="
cat "${slice_path}/memory.events"

echo
echo "== io.max =="
if [[ -f "${slice_path}/io.max" ]]; then
  cat "${slice_path}/io.max"
else
  echo "(io controller not delegated/enabled on this host)"
fi
