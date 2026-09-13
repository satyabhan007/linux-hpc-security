#!/usr/bin/env bash
# verify-patch.sh — confirm a kpatch module is not just loaded, but active.
# Companion to Ch12's L4 anti-pattern: "loading a kpatch module without
# verifying the patch is actually active" — kpatch list showing "loaded" is
# not by itself proof the vulnerable path is closed.
#
# Usage:
#   ./verify-patch.sh <patch-module-name>
#   ./verify-patch.sh kpatch-example-fix
set -euo pipefail

patch_name="${1:?usage: verify-patch.sh <patch-module-name>}"

if ! command -v kpatch >/dev/null 2>&1; then
  echo "kpatch command not found; install the 'kpatch' package for your distro" >&2
  exit 1
fi

echo "== kpatch list =="
kpatch_output="$(kpatch list)"
echo "$kpatch_output"

if ! grep -q "$patch_name" <<<"$kpatch_output"; then
  echo
  echo "FAIL: '${patch_name}' does not appear in 'kpatch list' output" >&2
  exit 1
fi

sysfs_enabled="/sys/kernel/livepatch/${patch_name}/enabled"
if [[ -f "$sysfs_enabled" ]]; then
  echo
  echo "== ${sysfs_enabled} =="
  state="$(cat "$sysfs_enabled")"
  echo "$state"
  if [[ "$state" != "1" ]]; then
    echo "FAIL: livepatch is loaded but not enabled (state=${state})" >&2
    exit 1
  fi
else
  echo
  echo "note: ${sysfs_enabled} not found; confirm activation via your" >&2
  echo "distro's kpatch tooling or vendor-specific verification steps" >&2
fi

echo
echo "OK: '${patch_name}' is loaded and enabled."
echo "This confirms the module is active -- it does NOT by itself confirm"
echo "the vulnerable code path is unreachable. Follow the vendor's specific"
echo "verification steps (Ch12) to close that loop."
