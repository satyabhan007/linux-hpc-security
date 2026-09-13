# AIDE file-integrity baseline

Companion lab to Chapter 9 (file integrity monitoring & host-based
intrusion prevention). A real, scoped `aide.conf` covering
security-critical paths only (binaries, configs, auth files — not the whole
filesystem, which would bury real alerts in churn from logs/tmp), plus a
script that inits a baseline correctly: **before** the host takes
production traffic, and stored somewhere the monitored host cannot rewrite.

## Files

- `aide.conf` — a scoped AIDE ruleset watching `/usr/bin`, `/usr/sbin`,
  `/etc` (excluding high-churn logs), and `/boot`, each with a rule group
  appropriate to how often that path legitimately changes.
- `init-baseline.sh` — initializes the AIDE database from `aide.conf` and
  copies the result to a separate, read-only-intended location — mirroring
  Chapter 9's fix for "the baseline the compromised host can rewrite is not
  a baseline." Refuses to silently overwrite an existing baseline.
- `check-integrity.sh` — runs an AIDE check against the stored baseline and
  reports drift, exiting non-zero if any is found (suitable for a cron job
  or systemd timer feeding an alert pipeline).

## Real workflow this lab mirrors

```bash
# On a freshly provisioned, known-good host — BEFORE production traffic:
aide --config=aide.conf --init
mv aide.conf.d/aide.db.new.gz /var/lib/aide/aide.db.gz

# Copy the baseline off-host (or onto read-only media) so a later
# compromise of THIS host cannot rewrite its own baseline:
scp /var/lib/aide/aide.db.gz integrity-store:/baselines/$(hostname)/aide.db.gz

# On a schedule (cron/systemd timer), check for drift:
aide --config=aide.conf --check
```

## Safety

- `init-baseline.sh` refuses to overwrite an existing baseline file unless
  `--force` is passed, so it cannot be accidentally re-run against an
  already-provisioned (and possibly already-compromised) host and silently
  re-baseline over evidence of tampering.
- `check-integrity.sh` is read-only — it never modifies the baseline; only
  `init-baseline.sh` (run once, at provisioning time) does.
