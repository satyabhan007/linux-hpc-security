# Ansible Automation — Interview Q&A

---

## Model

**Q: How does Ansible connect and run tasks?**
Over SSH (WinRM for Windows), pushing small Python modules to a temp
dir on the target, executing them, parsing JSON back, deleting them.
No persistent agent.

**Q: playbook / play / task / role / collection?**
Playbook = a YAML file of plays. Play = hosts + tasks. Task = one module
call. Role = a reusable directory of tasks/templates/defaults/handlers.
Collection = a distributable bundle of roles + modules + plugins.

**Q: What are facts and when are they gathered?**
Auto-discovered host data (`ansible_*`: OS, CPU count, interfaces, NUMA,
mounts). Gathered by the `setup` module at play start unless
`gather_facts: false`; can be cached.

---

## Idempotency

**Q: Define idempotency for an Ansible task.**
Running it again when the system is already in the desired state makes
no change and reports `ok`, not `changed`.

**Q: Why is `command:` usually not idempotent, and how do you fix it?**
It has no state model — it always executes and reports `changed`. Fix
with `creates:`/`removes:` (skip if a path exists/absent), `when:` on a
registered check, or `changed_when:`/`failed_when:` to define the truth.

**Q: `command` vs `shell` — when do you need `shell`?**
`shell` runs through `/bin/sh`, so pipes, redirects, globs, and env
expansion work. `command` doesn't (safer). Use `shell` only when you
need a shell feature; still guard it.

**Q: What does `check_mode` (`--check`) do, and what breaks it?**
Dry run — modules report what they *would* change. `command`/`shell`
skip by default in check mode (so downstream `when:` on their result
fails); set `check_mode: false` or provide a `changed_when` that works
without running.

---

## Variables & precedence

**Q: Full precedence, low to high (the parts that matter).**
role defaults < inventory group_vars/all < group_vars/group <
host_vars < play vars < task vars < `include_vars` < `set_fact` /
registered vars < `-e` extra-vars.

**Q: `-e` extra-vars — where does it rank?**
Highest. It overrides everything, including `set_fact`. Grep automation
wrappers for stray `-e`.

**Q: Two sibling groups both set `x`. Which wins?**
The group loaded last — alphabetical by group name (with `ansible_group_priority`
as a tiebreaker). Avoid it; set the var once.

**Q: `vars` vs `defaults` in a role?**
`defaults/main.yml` = lowest precedence (meant to be overridden).
`vars/main.yml` = high precedence (hard to override — use sparingly).

**Q: How do you see a host's resolved variables?**
`ansible-inventory --host <name> --yaml` (or `--list`).

---

## Execution control

**Q: `serial` — what and why?**
Limits how many hosts a play touches at once (`serial: 5`, `"20%"`, or a
list `[1, 10, "50%"]` for widening waves). Used for rolling updates so
you never take the whole fleet down at once.

**Q: `strategy: linear` vs `free`?**
`linear` (default): every host must finish task N before any host starts
task N+1 (a barrier). `free`: each host races through the play
independently — much faster on a large, heterogeneous fleet.

**Q: `max_fail_percentage` vs `any_errors_fatal`?**
`max_fail_percentage`: abort the play if more than X% of hosts *in the
current serial batch* fail. `any_errors_fatal: true`: one failure
anywhere aborts the whole play immediately.

**Q: How do handlers work, and a gotcha?**
Notified by a task's `changed` result, run once, at the *end* of the
play (or at a `meta: flush_handlers`). Gotcha: if the play aborts before
handlers flush, a notified restart never happens — use `--force-handlers`
or `flush_handlers` at a safe point.

**Q: `delegate_to` and `run_once` — a use case?**
`run_once: true` + `delegate_to: "{{ groups['slurmctl'][0] }}"` to drain
a node in Slurm from the controller, not from the node being patched.

**Q: `until` / `retries` / `delay`?**
Loop a task until a condition on its `register`ed result is true, up to
`retries` times, waiting `delay` seconds — the health-check gate in a
rolling update.

---

## Scale & performance

**Q: Playbook takes 3 hours on 2,000 hosts. First four fixes?**
Raise `forks` (5 → 80), switch `strategy` to `free`, enable SSH
pipelining + `ControlPersist`, and cache/minimise fact gathering. Also
collapse per-package tasks into one list.

**Q: What does SSH pipelining do?**
Executes the module over the existing SSH session without an extra
SFTP/scp step to write the module file — fewer round trips. Needs
`requiretty` off in sudoers.

**Q: Fact caching — backends and when to use?**
`jsonfile`, `redis`, `memcached`. Use `gathering = smart` +
`fact_caching` so re-runs and multi-play runs don't re-gather. Set a
timeout so stale facts don't bite.

---

## Testing & structure

**Q: How do you test a role?**
**Molecule**: spin a container/VM, run `converge`, then run it again and
assert **idempotence** (zero `changed`), then `verify.yml` (asserts /
`oscap` / testinfra). Plus `ansible-lint` and `yamllint` in CI.

**Q: `ansible-vault` — what for?**
Encrypting secrets at rest in the repo (`vault` files, or per-var with
`!vault`). Better: pull secrets from an external store (HashiCorp Vault,
AWS SM) at runtime via a lookup.

**Q: Ansible vs Terraform — one line.**
Terraform provisions infrastructure (declarative, stateful, cloud
resources); Ansible configures machines and orchestrates procedures
(push, mostly stateless, imperative-ish tasks toward a declared state).
They compose: Terraform makes the VMs, Ansible configures them.

**Q: Why prefer `template:` over multiple `lineinfile:`?**
One authoritative source for the whole file, a meaningful diff, trivially
idempotent, and no ordering/regex fragility. `lineinfile` is for editing
a file you don't own the whole of.

**Q: How do you make an `sshd_config` change safe?**
`template:` with `validate: /usr/sbin/sshd -t -f %s` so a bad file never
lands, and a `reloaded` (not `restarted`) handler so current sessions
survive a mistake.
