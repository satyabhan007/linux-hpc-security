#!/usr/bin/env bash
# build-and-load.sh — compile webapp.te into a loadable SELinux policy
# module and (optionally) load it.
#
# Defaults to a dry run: builds the .pp module and prints the load command
# without running it. Pass --load to actually call `semodule -i`.
#
# Usage:
#   ./build-and-load.sh [--load]

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
module_name="webapp"
te_file="${script_dir}/${module_name}.te"
work_dir="$(mktemp -d)"
load=false

cleanup() {
  rm -rf "${work_dir}"
}
trap cleanup EXIT

if [ "$#" -gt 0 ] && [ "$1" = "--load" ]; then
  load=true
fi

for tool in checkmodule semodule_package; do
  if ! command -v "${tool}" >/dev/null 2>&1; then
    echo "'${tool}' not found — install the selinux-policy-devel / policycoreutils package to build this module." >&2
    echo "(This script only shows the workflow; nothing was built.)" >&2
    exit 0
  fi
done

mod_file="${work_dir}/${module_name}.mod"
pp_file="${work_dir}/${module_name}.pp"

echo "Compiling ${te_file} ..."
checkmodule -M -m -o "${mod_file}" "${te_file}"

echo "Packaging ${mod_file} ..."
semodule_package -o "${pp_file}" -m "${mod_file}"

echo "Built policy package: ${pp_file}"

if [ "${load}" = true ]; then
  if ! command -v semodule >/dev/null 2>&1; then
    echo "'semodule' not found — cannot load the package on this host." >&2
    exit 1
  fi
  echo "Loading module with: semodule -i ${pp_file}"
  semodule -i "${pp_file}"
else
  echo "Dry run only. To load this module for real, run:"
  echo "  semodule -i ${pp_file}"
  echo "(pass --load to this script to run that command automatically)"
fi
