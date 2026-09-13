# Part 4 · labs — runnable configs

> Standard tools, at production depth. Every file here is validated in CI
> (`.github/workflows/lab-tests.yml`).

Landing alongside chapters 2–16: an OpenSCAP scan-and-remediate pipeline
(SSG content + generated Ansible fix playbook), a custom SELinux policy
module with an audit2allow workflow, an auditd ruleset for privileged-command
monitoring, an AIDE file-integrity baseline, and a CVE-to-risk-score example
combining CVSS with exposure data.

## Labs

- [`openscap-remediation/`](openscap-remediation/) — scan a host against an
  XCCDF profile, generate an Ansible remediation playbook from the failed
  rules, review it, then apply it idempotently (dry-run by default).
  Companion to Chapter 1 and Chapter 13.
- [`selinux-policy/`](selinux-policy/) — a custom `.te` type-enforcement
  policy module confining an illustrative web application, built with the
  real `checkmodule`/`semodule_package`/`semodule` toolchain, plus the
  `audit2allow` workflow for turning real AVC denials into a reviewed
  (never auto-loaded) policy draft. Companion to Chapter 3.
- [`auditd-monitoring/`](auditd-monitoring/) — a scoped `audit.rules`
  ruleset for privileged-command execution, auth-file tampering, SSH
  config rollback, audit-disabling attempts, and kernel module loading —
  each rule mapped to a specific threat. Companion to Chapter 8.
- [`aide-integrity/`](aide-integrity/) — a scoped AIDE file-integrity
  baseline covering binaries, boot files, and auth configs, with a
  baseline-init script that refuses to silently overwrite an existing
  baseline. Companion to Chapter 9.
- [`cve-risk-scoring/`](cve-risk-scoring/) — a zero-dependency Python tool
  combining CVSS base score, EPSS-style exploitation probability, and
  exposure/reachability context into one composite risk score, ranking
  findings by real risk instead of raw CVSS. Companion to Chapter 12.

Every lab's own README explains the real-world workflow it mirrors and the
safety defaults (dry-run/idempotent behavior) built into its scripts.
