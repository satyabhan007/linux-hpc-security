#!/usr/bin/env bash
# Part 3 lab — sacctmgr seed script
#
# Builds the account hierarchy, QOS tiers, and fairshare weights that the
# accompanying slurm.conf.fragment's AllowAccounts= lines reference.
# Companion to Chapters 1, 8, and 11.
#
# Requires a real slurmdbd reachable via `sacctmgr`. Safe to re-run: every
# "add" is guarded by a check for the object already existing, so this
# script converges rather than failing on a second run.

set -euo pipefail

run() {
  echo "+ sacctmgr $*"
  sacctmgr -i "$@"
}

account_exists() {
  sacctmgr show account "$1" --noheader --parsable2 2>/dev/null | grep -q "^$1|"
}

qos_exists() {
  sacctmgr show qos "$1" --noheader --parsable2 2>/dev/null | grep -q "^$1|"
}

# ---------------------------------------------------------------------
# QOS tiers (Chapter 8)
# ---------------------------------------------------------------------
if ! qos_exists normal; then
  run add qos normal set Priority=0 Flags=EnforceUsageThreshold
fi

if ! qos_exists preemptible; then
  run add qos preemptible set Priority=10 Flags=RequiresReservation \
    MaxWall=2-00:00:00
fi

if ! qos_exists debug; then
  run add qos debug set Priority=200 MaxWall=00:30:00 MaxJobsPerUser=2
fi

# ---------------------------------------------------------------------
# Accounts (Chapter 11) — two departments with different negotiated
# fairshare allocations (RawShares), each with a nested "grant" project
# sub-account so per-grant GPU-hour reporting (Chapter 11) is possible.
# ---------------------------------------------------------------------
if ! account_exists physics; then
  run add account physics Description="Physics Dept" Organization=university \
    fairshare=150 qos=normal,preemptible,debug
fi

if ! account_exists physics_grant42; then
  run add account physics_grant42 Description="Physics - Grant 42 (NSF)" \
    Parent=physics fairshare=50 qos=normal,preemptible
fi

if ! account_exists chemistry; then
  run add account chemistry Description="Chemistry Dept" Organization=university \
    fairshare=100 qos=normal,preemptible,debug
fi

# ---------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------
run add user alice Account=physics_grant42 DefaultAccount=physics_grant42
run add user bob    Account=chemistry       DefaultAccount=chemistry

echo "Seed complete. Verify with: sacctmgr show account,qos,user format=Account,User,Share,QOS"
