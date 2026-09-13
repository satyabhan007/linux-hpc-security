#!/usr/bin/env bash
# drift-check.sh — compare live sysctl values against the fleet baseline
# JSON, exiting non-zero on any mismatch. Companion to Ch13 (sysctl tuning
# at fleet scale): "catching sysctl drift with a CI check" is one of Ch13's
# core scenarios — this is a runnable version of that check, meant to run
# periodically (cron/CI) against every fleet host.
#
# Usage:
#   ./drift-check.sh                                  # use the default baseline
#   ./drift-check.sh /path/to/expected-sysctls.json    # use a different baseline
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
baseline_file="${1:-${script_dir}/baseline/expected-sysctls.json}"

if [[ ! -f "$baseline_file" ]]; then
  echo "baseline file not found: ${baseline_file}" >&2
  exit 2
fi

drift_found=0

while IFS=$'\t' read -r key expected; do
  actual="$(sysctl -n "$key" 2>/dev/null || echo "__MISSING__")"
  if [[ "$actual" != "$expected" ]]; then
    echo "DRIFT: ${key} expected='${expected}' actual='${actual}'"
    drift_found=1
  fi
done < <(python3 -c '
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
for k, v in data.items():
    print(f"{k}\t{v}")
' "$baseline_file")

if [[ "$drift_found" -eq 1 ]]; then
  echo "sysctl drift detected against ${baseline_file}" >&2
  exit 1
fi

echo "no sysctl drift detected against ${baseline_file}"
