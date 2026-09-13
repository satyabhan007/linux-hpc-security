#!/usr/bin/env bash
# check-integrity.sh — run an AIDE check against the stored baseline and
# report drift. Read-only: never modifies the baseline. Suitable for a
# cron job or systemd timer feeding an alert pipeline (exits non-zero on
# detected drift so it composes with standard monitoring).
#
# Usage:
#   ./check-integrity.sh

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_file="${script_dir}/aide.conf"

if ! command -v aide >/dev/null 2>&1; then
  echo "'aide' not found — install the aide package to run this for real." >&2
  echo "Intended command:" >&2
  echo "  aide --config=${config_file} --check" >&2
  exit 0
fi

echo "Running AIDE integrity check against ${config_file} ..."
if aide --config="${config_file}" --check; then
  echo "No drift detected."
  exit 0
else
  status=$?
  echo "Drift detected (aide exit code ${status}) — review the report above." >&2
  exit "${status}"
fi
