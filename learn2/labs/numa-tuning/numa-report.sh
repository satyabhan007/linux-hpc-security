#!/usr/bin/env bash
# numa-report.sh — per-process NUMA hit/miss report. Companion to Ch3: shows
# whether a process's memory accesses are landing local (numa_hit) or
# remote (numa_foreign/numa_miss), the diagnostic step in Ch3's "new HPC
# node, mysterious 30% slowdown" scenario.
#
# Usage:
#   ./numa-report.sh <pid>
set -euo pipefail

pid="${1:?usage: numa-report.sh <pid>}"

if [[ ! -d "/proc/${pid}" ]]; then
  echo "no such process: ${pid}" >&2
  exit 1
fi

if ! command -v numastat >/dev/null 2>&1; then
  echo "numastat not found; install the numactl package to use this script" >&2
  exit 1
fi

echo "== numastat -p ${pid} (per-node memory breakdown) =="
numastat -p "${pid}"

echo
echo "== numastat -c ${pid} (compact view) =="
numastat -c "${pid}"

echo
echo "high numa_foreign/numa_miss relative to numa_hit means this process's"
echo "memory is landing on a different node than the CPUs running it -- see"
echo "Ch3 for numactl --cpunodebind/--membind as the fix."
