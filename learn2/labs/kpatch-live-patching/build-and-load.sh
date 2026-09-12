#!/usr/bin/env bash
# build-and-load.sh — build a kpatch module from a source-level patch
# against the currently running kernel, then load it. Companion to Ch12
# (live kernel patching): builds and loads example-fix.patch, illustrating
# a fix that IS livepatch-eligible (function-level logic change, no
# in-memory data structure layout change — see Ch12's L4 anti-pattern
# table for the class of fix that is NOT eligible).
#
# Usage:
#   sudo ./build-and-load.sh [patch-file]
#
# Requires: kpatch-build, a matching kernel-devel/kernel-headers package for
# the running kernel, and a build toolchain (gcc, make). Not runnable in a
# bare sandbox without those installed — read this for the workflow shape.
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
patch_file="${1:-${script_dir}/example-fix.patch}"
running_kernel="$(uname -r)"
module_name="kpatch-example-fix"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "kpatch-build and kpatch load require root" >&2
  exit 1
fi

if [[ ! -f "$patch_file" ]]; then
  echo "patch file not found: ${patch_file}" >&2
  exit 1
fi

if ! command -v kpatch-build >/dev/null 2>&1; then
  echo "kpatch-build not found; install the 'kpatch' package for your distro" >&2
  echo "(see https://github.com/dynup/kpatch for build dependencies)" >&2
  exit 1
fi

echo "== building ${module_name} against kernel ${running_kernel} =="
kpatch-build \
  -t vmlinux \
  -s "/usr/src/kernels/${running_kernel}" \
  -n "$module_name" \
  "$patch_file"

built_module="${module_name}.ko"
if [[ ! -f "$built_module" ]]; then
  echo "expected ${built_module} was not produced" >&2
  exit 1
fi

echo "== loading ${built_module} into the running kernel =="
kpatch load "$built_module"

echo "== active patches =="
kpatch list
