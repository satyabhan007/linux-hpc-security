# OpenSCAP scan-and-remediate pipeline

A minimal, runnable version of the pipeline described in Chapter 1 (DISA STIG
automation) and Chapter 13 (compliance-as-code with OpenSCAP): scan a host
against SCAP content, generate an Ansible remediation playbook **from the
scan results**, review it, then apply it idempotently.

This lab does not ship the full upstream SSG content (it is tens of
thousands of lines per platform and lives in the `scap-security-guide`
package) — it ships a small, illustrative XCCDF profile fragment
(`profile-fragment.xml`) so you can see the shape of a real rule, plus a
hand-written Ansible playbook (`remediate.yml`) representing the kind of
output `oscap xccdf generate fix` produces, trimmed to a safe, idempotent
subset of controls you can actually read end to end.

## Files

- `profile-fragment.xml` — an XCCDF fragment with two illustrative rules
  (SSH root login, password minlen) in the same structure as real SCAP
  Security Guide content.
- `remediate.yml` — an Ansible playbook applying a small, safe, **idempotent**
  subset of hardening controls (SSH hardening, password quality, auditd
  presence). Every task uses `check_mode`-safe modules and reports
  `changed` only when a real change is needed.
- `scan-and-remediate.sh` — a wrapper script showing the real end-to-end
  workflow: scan → review → dry-run remediate → apply. Defaults to
  **dry-run** (`--check`) and requires an explicit `--apply` flag to make
  real changes.

## Real workflow this lab mirrors

```bash
# 1. Scan a host against a real STIG/CIS profile (requires the
#    scap-security-guide package to be installed on the target):
oscap xccdf eval \
  --profile xccdf_org.ssgproject.content_profile_stig \
  --results scan-results.xml --report scan-report.html \
  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml

# 2. Generate an Ansible remediation playbook FROM the failed rules only:
oscap xccdf generate fix --fix-type ansible --result-id "" \
  scan-results.xml > generated-remediate.yml

# 3. Review the generated playbook (never apply unread automation), then
#    dry-run it:
ansible-playbook -i inventory.ini generated-remediate.yml --check --diff

# 4. Apply for real, ideally against a canary ring first (Chapter 7):
ansible-playbook -i inventory.ini generated-remediate.yml --limit canary
```

`scan-and-remediate.sh` in this directory automates steps 3-4 against the
lab's own `remediate.yml`, so you can see the dry-run/apply split without
needing a live SCAP-scanned host.

## Safety

- `remediate.yml` never disables a service, deletes a file, or changes a
  password — every task hardens a configuration value idempotently.
- `scan-and-remediate.sh` defaults to `--check` (dry-run). Real changes
  require `--apply` explicitly.
