# auditd ruleset for privileged-command monitoring

Companion lab to Chapter 8 (intrusion detection: auditd & eBPF-based
sensors). A scoped `audit.rules` file that watches specific,
security-relevant actions — privileged command execution, sensitive file
writes, and auth configuration changes — instead of tracing every syscall
(the anti-pattern Chapter 8 warns against: over-collection buries the
signal you actually need).

## Files

- `audit.rules` — a real, loadable `auditd` ruleset. Each rule is tagged
  with a `-k` key so events can be found quickly with `ausearch -k <key>`,
  and every rule is commented with which threat/control it addresses.
- `apply-rules.sh` — validates and (optionally) loads `audit.rules` onto a
  running system. Defaults to **validate-only**; `--apply` is required to
  actually load the rules with `auditctl -R`.
- `search-examples.sh` — example `ausearch` invocations against the keys
  defined in `audit.rules`, for use during an actual investigation.

## What this ruleset watches, and why

| Rule | Threat model | Chapter |
|---|---|---|
| `execve` of `sudo`/`su` | Privilege-escalation attempt tracking | Ch 8, Ch 10 |
| Writes to `/etc/shadow`, `/etc/passwd`, `/etc/sudoers` | Tampering with auth/privilege config | Ch 8 |
| Writes to `/etc/ssh/sshd_config` | Unauthorized SSH hardening rollback | Ch 8, Ch 1 |
| `execve` of `auditctl`/`service auditd` | Attempts to disable auditing itself | Ch 8 |
| Loading a kernel module (`init_module`/`finit_module`) | Kernel-level persistence / rootkit installation | Ch 4, Ch 8 |

This is deliberately scoped — it is NOT "watch everything under /etc" or
"log every execve." Chapter 8's real test applies: every rule here maps to
a specific, nameable attacker technique.

## Real workflow this lab mirrors

```bash
# Validate syntax without loading:
auditctl -R audit.rules --dry-run   # (on distros whose auditctl supports it)
# or, more portably, just review the file — augenrules also validates on load:
augenrules --check

# Load the rules (persisted across reboots via /etc/audit/rules.d/):
sudo cp audit.rules /etc/audit/rules.d/lab-privileged-monitoring.rules
sudo augenrules --load

# Search collected events by key during an investigation:
ausearch -k priv_cmd -ts today
ausearch -k auth_tamper -ts recent
```

## Safety

- `apply-rules.sh` defaults to validating the ruleset only; it requires
  `--apply` to actually call `auditctl -R`, and it never disables or
  replaces the running `auditd` configuration outside that explicit path.
- No rule in `audit.rules` blocks or denies anything — auditd here is
  purely a detection/logging layer, not an enforcement layer.
