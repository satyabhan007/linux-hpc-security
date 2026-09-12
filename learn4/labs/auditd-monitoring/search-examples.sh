#!/usr/bin/env bash
# search-examples.sh — example ausearch invocations for the keys defined in
# audit.rules, ready to use during an actual investigation. Printed, not
# executed automatically, since ausearch requires a live audit log and root.
#
# Usage:
#   ./search-examples.sh

set -euo pipefail

cat <<'EOF'
Example ausearch commands for keys defined in audit.rules:

  # Privileged command executions (sudo/su) today:
  ausearch -k priv_cmd -ts today

  # Auth/privilege configuration file tampering, most recent:
  ausearch -k auth_tamper -ts recent

  # SSH hardening config changes:
  ausearch -k ssh_config_tamper -ts recent

  # Attempts to disable auditing itself:
  ausearch -k audit_tamper -ts recent

  # Kernel module load/unload events:
  ausearch -k kmod_load -ts recent

  # Full report across all keys defined by this ruleset, for a specific day:
  for key in priv_cmd auth_tamper ssh_config_tamper audit_tamper kmod_load; do
    echo "== ${key} =="
    ausearch -k "${key}" -ts 2026-03-14 00:00:00 -te 2026-03-14 23:59:59
  done
EOF
