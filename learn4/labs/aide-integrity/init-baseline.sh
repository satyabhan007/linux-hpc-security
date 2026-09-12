#!/usr/bin/env bash
# init-baseline.sh — initialize an AIDE baseline from aide.conf.
#
# Must be run on a freshly provisioned, known-good host BEFORE it takes
# production traffic (Chapter 9: a baseline built after compromise bakes
# the compromise in as "normal"). Refuses to overwrite an existing
# baseline unless --force is passed.
#
# Usage:
#   ./init-baseline.sh [--force] [--out-dir DIR]

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
config_file="${script_dir}/aide.conf"
out_dir="${script_dir}/baseline-store"
force=false

while [ "$#" -gt 0 ]; do
  case "$1" in
    --force)
      force=true
      shift
      ;;
    --out-dir)
      [ "$#" -ge 2 ] || { echo "Usage: $0 [--force] [--out-dir DIR]" >&2; exit 1; }
      out_dir="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

baseline_file="${out_dir}/aide.db.gz"

if [ -f "${baseline_file}" ] && [ "${force}" = false ]; then
  echo "A baseline already exists at ${baseline_file}." >&2
  echo "Refusing to overwrite it — an existing baseline built after this" >&2
  echo "host went into service could already reflect a compromise." >&2
  echo "Pass --force only if you are certain this host is currently known-good." >&2
  exit 1
fi

if ! command -v aide >/dev/null 2>&1; then
  echo "'aide' not found — install the aide package to run this for real." >&2
  echo "Intended command:" >&2
  echo "  aide --config=${config_file} --init" >&2
  exit 0
fi

mkdir -p "${out_dir}"

echo "Initializing AIDE baseline from ${config_file} ..."
aide --config="${config_file}" --init

new_db="/var/lib/aide/aide.db.new.gz"
if [ -f "${new_db}" ]; then
  cp "${new_db}" "${baseline_file}"
  echo "Baseline copied to ${baseline_file}."
  echo "Now move this file off-host (or onto read-only media) so a later"
  echo "compromise of this host cannot rewrite its own baseline."
else
  echo "Expected output ${new_db} not found — check the aide --init output above." >&2
  exit 1
fi
