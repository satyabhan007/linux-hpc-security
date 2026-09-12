#!/usr/bin/env bash
# configure-kdump.sh — check/report kdump readiness on a host: is the
# crashkernel memory region reserved, and is the kdump service enabled.
# Companion to Ch11 (debugging production kernel panics & oopses): "enable
# kdump BEFORE a panic, not after" — this script's purpose is to make that
# check part of a fleet-wide onboarding/audit step rather than tribal
# knowledge.
#
# Usage:
#   ./configure-kdump.sh            # report readiness only (safe, read-only)
#   sudo ./configure-kdump.sh --enable   # attempt to enable the kdump service
set -euo pipefail

mode="${1:-report}"

echo "== crashkernel reservation (kernel command line) =="
if grep -qo 'crashkernel=[^ ]*' /proc/cmdline; then
  grep -o 'crashkernel=[^ ]*' /proc/cmdline
else
  echo "no crashkernel= parameter found on the kernel command line" >&2
  echo "add one via your bootloader config (e.g. GRUB_CMDLINE_LINUX) and reboot" >&2
fi

echo
echo "== kdump service status =="
if command -v systemctl >/dev/null 2>&1; then
  systemctl is-enabled kdump 2>/dev/null || echo "kdump service not found/enabled"
  systemctl is-active kdump 2>/dev/null || echo "kdump service not active"
else
  echo "systemctl not found; check your distro's kdump init mechanism directly" >&2
fi

echo
echo "== existing captured vmcores under /var/crash =="
if [[ -d /var/crash ]]; then
  find /var/crash -maxdepth 1 -mindepth 1 -type d 2>/dev/null || echo "(none found)"
else
  echo "/var/crash does not exist yet (no captures so far, or kdump not configured)"
fi

if [[ "$mode" == "--enable" ]]; then
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "must run as root to enable the kdump service" >&2
    exit 1
  fi
  echo
  echo "== enabling kdump service =="
  systemctl enable --now kdump
fi
