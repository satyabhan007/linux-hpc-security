#!/usr/bin/env bash
# audit2allow-workflow.sh — turn a real AVC denial log into a REVIEWABLE
# policy draft. This script never loads a generated module automatically:
# per Chapter 3's L4 anti-pattern fix, every audit2allow rule must be read
# and narrowed by a human before it becomes real policy.
#
# Usage:
#   ./audit2allow-workflow.sh [LOGFILE]
#
# With no argument, uses the included sample-avc.log (a synthetic example,
# not a real incident).

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log_file="${1:-${script_dir}/sample-avc.log}"

if [ ! -f "${log_file}" ]; then
  echo "Log file not found: ${log_file}" >&2
  exit 1
fi

if ! command -v audit2allow >/dev/null 2>&1; then
  echo "'audit2allow' not found — install policycoreutils-python-utils to run this for real." >&2
  echo "Showing the intended command instead:" >&2
  echo "  audit2allow -m webapp_extra < ${log_file}" >&2
  exit 0
fi

echo "== Drafting a policy module from ${log_file} (DRAFT ONLY — not loaded) =="
draft="$(audit2allow -m webapp_extra < "${log_file}")"
printf '%s\n' "${draft}"

cat <<'EOF'

== This is a DRAFT, not policy ==
Before this becomes a real module:
  1. Read every generated "allow" rule above.
  2. Confirm each one maps to a specific, expected denial — narrow any
     rule broader than what the application actually needs.
  3. Only then compile and load it (see build-and-load.sh in this
     directory for the checkmodule/semodule_package/semodule steps).

This script intentionally stops here and does not compile or load
anything automatically.
EOF
