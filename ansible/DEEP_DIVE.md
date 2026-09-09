# Ansible Automation — Deep Dive: Production Scenarios

---

## Scenario 1 — The playbook is "not safe to re-run"

**Symptom.** Every `site.yml` run reports 60 `changed` tasks even when
nothing changed. Nobody trusts `--check`. People run it once and pray.

**Audit for the anti-patterns.**
```bash
grep -rEn 'shell:|command:' roles/ | grep -v 'creates:|removes:|when:|changed_when:'
grep -rn 'ignore_errors: true' roles/          # masks real failures
grep -rn 'lineinfile:' roles/ | wc -l          # often should be template:
```

**Fixes.**
- Every `command`/`shell` gets `creates:`/`removes:`, or `register:` +
  `when:`, or `changed_when:` defining truth.
- Replace stacks of `lineinfile` with a single `template:` of the whole
  file — one source of truth, and the diff is meaningful.
- `service` state via `systemd:` (idempotent), not `command: systemctl`.
- Delete `ignore_errors: true`; use `failed_when:` with a real
  condition.
- Add a molecule test that runs `converge` twice and fails on any
  `changed` the second time.

**Outcome.** A clean run is `ok` everywhere; `changed` means something
genuinely drifted, and the team runs `site.yml` on a schedule.

---

## Scenario 2 — Patch 2,000 nodes on the monthly window

**Constraints.** 4-hour window, jobs running, cannot drain the whole
cluster, must be resumable if it fails at hour 3.

```yaml
- name: rolling OS patch
  hosts: compute
  serial: [ 1, "5%", "20%" ]        # 1 canary, then widening waves
  max_fail_percentage: 3
  any_errors_fatal: false
  order: shuffle                    # don't always hit rack 1 first
  tasks:
    - name: mark drain (let running jobs finish, no new ones)
      command: scontrol update nodename={{ inventory_hostname }} state=drain reason="patch {{ ansible_date_time.date }}"
    - name: wait until the node is idle
      shell: squeue -h -w {{ inventory_hostname }} -t running | wc -l
      register: jobs
      until: jobs.stdout | int == 0
      retries: 120
      delay: 60                     # up to 2h grace per node
    - dnf: { name: '*', state: latest, security: true }
      register: patched
    - reboot:
      when: patched.changed
    - name: node health check (NHC-style)
      command: /usr/sbin/nhc
      changed_when: false
    - command: scontrol update nodename={{ inventory_hostname }} state=resume
```

**Resumability.** Run with `--limit @/var/run/patch.retry` on retry
(Ansible writes the retry file on failure). Fact-cache so a re-run
doesn't re-gather everything. Log per-node status to a file the
dashboard reads.

**Gotcha.** `serial` + `max_fail_percentage` is evaluated *per wave*.
The canary wave of `1` with `max_fail_percentage: 3` means **any** canary
failure (1/1 = 100% > 3%) aborts — which is exactly what you want.

---

## Scenario 3 — Variable precedence bit us

**Symptom.** `gpu003` got the CPU `slurm.conf` because someone set
`slurm_role` in `group_vars/compute` and expected `host_vars/gpu003` to
"obviously" win... which it does — but a `-e slurm_role=` from a
wrapper script was silently overriding *both* on every run.

**Rules to internalise.**
- `-e` (extra-vars) beats **everything**. If a wrapper sets it, nothing
  in the repo can override it. Grep your CI/cron for `-e`.
- Child group beats parent group; `host_vars` beats all group vars.
- Two groups at the same depth: last one loaded wins (alphabetical by
  group name) — avoid setting the same var in sibling groups.
- `ansible-inventory --host gpu003 --yaml` shows the *resolved* vars for
  a host. Use it before debugging by guesswork.
- `set_fact` creates a host fact that outranks inventory vars for the
  rest of the run — powerful and easy to misuse.

(Lab: `step1_inventory_graph.py` makes this concrete.)

---

## Scenario 4 — `sshd` handler locked out the fleet

**What happened.** A role changed `sshd_config`, notified
`restart sshd`, the new config had a typo, `sshd` restarted and failed
to start. 400 nodes, no SSH.

**Fix (permanent).**
```yaml
- name: deploy sshd_config
  template:
    src: sshd_config.j2
    dest: /etc/ssh/sshd_config
    validate: /usr/sbin/sshd -t -f %s      # config is checked BEFORE it's written live
  notify: reload sshd

handlers:
  - name: reload sshd
    service: { name: sshd, state: reloaded }   # reload, not restart; keeps current sessions
```

`validate:` runs the checker against the *staged* file; a bad config
fails the task and never lands. `reloaded` keeps existing connections
alive so a mistake is recoverable.

---

## Scenario 5 — 3-hour run → 12-minute run

**Before:** `forks = 5`, `gather_facts: true` everywhere, `strategy:
linear`, 38 separate `package:` tasks, `git` module cloning the same
repo on every host every run.

**After:**
```ini
# ansible.cfg
[defaults]
forks = 80
gathering = smart
fact_caching = redis
fact_caching_timeout = 7200
strategy = free
[ssh_connection]
pipelining = True
ssh_args = -o ControlMaster=auto -o ControlPersist=300s
```
```yaml
- package: { name: "{{ compute_packages }}", state: present }   # one task, a list
- gather_facts: false                                           # play sets facts it needs
  pre_tasks:
    - setup: { gather_subset: ['!all','network','virtual'] }
```

`strategy: free` alone was ~40% of the win — no barrier at every task,
so a node stuck on a slow mirror doesn't hold up 1,999 others.

---

## Ansible + images: the division of labour

| Concern | Where |
|---|---|
| Base OS, kernel, big packages (MPI, compilers, Lustre client) | Warewulf/container **image** (Module 7) |
| Node identity, `/etc/hosts`, `slurm.conf`, munge key, resolv.conf | Warewulf **runtime overlay** |
| Day-2 config, users/keys, monitoring config, one-off fixes, patch orchestration | **Ansible** |
| Compliance remediation | Ansible (from OpenSCAP, Module 3), then folded into the image |

Rule of thumb: if it should survive a reboot with zero action, it's in
the image or overlay. If it changes often or needs orchestration
(drain → act → verify), it's Ansible.
