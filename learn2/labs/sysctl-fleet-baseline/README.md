# sysctl fleet baseline — Ansible role + drift check

Companion lab for Ch13 (sysctl tuning at fleet scale).

## Files

- **`ansible/playbook.yml`** + **`ansible/roles/sysctl_baseline/`** — a role
  that renders `/etc/sysctl.d/99-fleet-baseline.conf` from one templated
  source of truth (`defaults/main.yml`), reloads sysctl via a handler, and
  runs `sysctl --system --dry-run` to catch conflicting definitions before
  they land. This is Ch13's "fleet-wide sysctl baseline in config
  management" scenario, runnable.
- **`ansible/inventory.ini`** — an example inventory group (placeholder
  hostnames — replace with your fleet).
- **`baseline/expected-sysctls.json`** — the same key/value baseline,
  expressed as JSON, consumed by `drift-check.sh`.
- **`drift-check.sh`** — compares live `sysctl -n <key>` values against
  `baseline/expected-sysctls.json` and exits non-zero on any mismatch. This
  is Ch13's "catching sysctl drift with a CI check" scenario, runnable
  standalone (cron, CI, or ad hoc) with zero non-stdlib dependencies.

## Usage

```
# apply the baseline fleet-wide
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml

# check for drift on any host, any time
./drift-check.sh
```

## Why both an Ansible role AND a plain JSON+shell drift check

The Ansible role is the enforcement path (make it so); the JSON+shell drift
check is a dependency-light detection path that can run anywhere `python3`
and `sysctl` exist — including a lightweight periodic check that does not
require an Ansible control node. Both read from logically the same
baseline, kept in sync by hand here (in a real fleet, generate one from the
other).

## Notes on validation

`ansible/**/*.yml` is linted with `yamllint` (relaxed profile, matching this
repo's CI). `baseline/expected-sysctls.json` is validated with
`python -m json.tool`. `drift-check.sh` passes `bash -n` and was
functionally tested against this host's live sysctl values (it correctly
reported real drift for `vm.swappiness`, `net.ipv4.tcp_max_syn_backlog`, and
`kernel.panic` during authoring, since this sandbox's defaults do not match
the example baseline — expected, and exactly what the script is for).
