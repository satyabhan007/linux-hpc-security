#!/usr/bin/env bash
# apply-rules.sh — validate, and optionally load, audit.rules.
#
# Defaults to validate-only (checks the file is syntactically sane and
# lists the rules it would load). Pass --apply to actually install and
# load the ruleset via augenrules.
#
# Usage:
#   ./apply-rules.sh [--apply]

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
rules_file="${script_dir}/audit.rules"
target_name="lab-privileged-monitoring.rules"
apply=false

if [ "$#" -gt 0 ] && [ "$1" = "--apply" ]; then
  apply=true
fi

if [ ! -f "${rules_file}" ]; then
  echo "Rules file not found: ${rules_file}" >&2
  exit 1
fi

echo "== Rules that would be loaded from ${rules_file} =="
grep -Ev '^\s*(#|$)' "${rules_file}"

if [ "${apply}" = false ]; then
  echo
  echo "Dry run only. To install and load these rules for real, run:"
  echo "  sudo cp ${rules_file} /etc/audit/rules.d/${target_name}"
  echo "  sudo augenrules --load"
  echo "(pass --apply to this script to run those commands automatically)"
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Applying rules requires root — re-run with sudo." >&2
  exit 1
fi

for tool in augenrules auditctl; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "'${tool}' not found — install the audit package to apply this ruleset." >&2
    exit 1
  fi
done

dest_dir="/etc/audit/rules.d"
mkdir -p "${dest_dir}"
cp "${rules_file}" "${dest_dir}/${target_name}"
echo "Installed ${dest_dir}/${target_name}"

augenrules --load
echo "Rules loaded. Verify with: auditctl -l"
