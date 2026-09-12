#!/usr/bin/env bash
# apply-cgroup-limits.sh — install batch-jobs.slice and, optionally, launch a
# command inside it via systemd-run. Companion to Ch4 (cgroups v2 & resource
# control at scale).
#
# Usage:
#   sudo ./apply-cgroup-limits.sh                  # install the slice only
#   sudo ./apply-cgroup-limits.sh -- ./my_batch.sh # install, then launch
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
slice_unit="batch-jobs.slice"
slice_src="${script_dir}/${slice_unit}"
slice_dest="/etc/systemd/system/${slice_unit}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "this script installs a systemd unit and must run as root" >&2
  exit 1
fi

if [[ ! -f "$slice_src" ]]; then
  echo "cannot find ${slice_src}" >&2
  exit 1
fi

install -m 0644 "$slice_src" "$slice_dest"
systemctl daemon-reload
echo "installed ${slice_dest}"

if [[ $# -gt 0 && "$1" == "--" ]]; then
  shift
fi

if [[ $# -gt 0 ]]; then
  echo "launching '$*' inside ${slice_unit}"
  exec systemd-run --slice="$slice_unit" --scope --wait -- "$@"
fi

echo "slice installed and ready: systemd-run --slice=${slice_unit} --scope -- <command>"
