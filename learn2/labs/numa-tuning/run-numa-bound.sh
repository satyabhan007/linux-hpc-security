#!/usr/bin/env bash
# run-numa-bound.sh — launch a command CPU- and memory-bound to a single
# NUMA node, printing topology first. Companion to Ch3 (NUMA topology &
# NUMA-aware tuning): pairs CPU affinity with an explicit memory policy, the
# fix for Ch3's "taskset-without-membind trap" scenario.
#
# Usage:
#   ./run-numa-bound.sh <node> -- <command> [args...]
#   ./run-numa-bound.sh 0 -- ./latency_sensitive_app --port 8080
set -euo pipefail

node="${1:?usage: run-numa-bound.sh <node> -- <command> [args...]}"
shift

if [[ "${1:-}" == "--" ]]; then
  shift
fi

if [[ $# -eq 0 ]]; then
  echo "no command given to bind" >&2
  exit 1
fi

if ! command -v numactl >/dev/null 2>&1; then
  echo "numactl not found; install the numactl package to use this script" >&2
  exit 1
fi

echo "== numactl --hardware =="
numactl --hardware

echo
echo "== launching on node ${node} (cpu+mem bound): $* =="
exec numactl --cpunodebind="${node}" --membind="${node}" -- "$@"
