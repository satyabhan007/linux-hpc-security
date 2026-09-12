#!/usr/bin/env bash
# scan-and-remediate.sh — illustrative scan -> review -> remediate workflow.
#
# Defaults to a dry run (ansible-playbook --check --diff). Pass --apply to
# make real changes, and --limit <pattern> to scope to a canary ring first
# (see Chapter 7: security patching pipelines).
#
# Usage:
#   ./scan-and-remediate.sh [--apply] [--limit PATTERN] [--inventory FILE]

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
playbook="${script_dir}/remediate.yml"
inventory="localhost,"
limit=""
apply=false

usage() {
  echo "Usage: $0 [--apply] [--limit PATTERN] [--inventory FILE]" >&2
  exit 1
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --apply)
      apply=true
      shift
      ;;
    --limit)
      [ "$#" -ge 2 ] || usage
      limit="$2"
      shift 2
      ;;
    --inventory)
      [ "$#" -ge 2 ] || usage
      inventory="$2"
      shift 2
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      ;;
  esac
done

cmd=(ansible-playbook -i "${inventory}" "${playbook}")

if [ -n "${limit}" ]; then
  cmd+=(--limit "${limit}")
fi

if [ "${apply}" = false ]; then
  echo "== DRY RUN (pass --apply to make real changes) =="
  cmd+=(--check --diff)
else
  echo "== APPLYING remediation =="
fi

if ! command -v ansible-playbook >/dev/null 2>&1; then
  echo "'ansible-playbook' not found — install ansible-core to run this lab for real." >&2
  echo "Intended command:" >&2
  printf '  %s\n' "${cmd[*]}" >&2
  exit 0
fi

printf 'Running: %s\n' "${cmd[*]}"
"${cmd[@]}"
