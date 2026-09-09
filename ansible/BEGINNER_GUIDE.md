# Ansible Automation at Scale — The Amateur's Guide

> A recipe written as "the cake should end up frosted", not "spread
> frosting". If the cake is already frosted, that step does nothing —
> so you can hand the kitchen the same recipe every morning and only the
> un-done steps happen.

---

## 1. What Ansible is

Describe the **desired state** of machines in YAML; Ansible makes it so
over SSH, with **no agent** to install. Terms:

- **playbook** — a YAML file: one or more **plays**
- **play** — maps a set of **hosts** to a list of **tasks**
- **task** — one call to a **module** (`package`, `copy`, `systemd`,
  `template`, `user`, `lineinfile`, `command`…)
- **role** — a reusable bundle of tasks + templates + defaults + handlers
- **inventory** — the list of hosts and how they're grouped
- **facts** — auto-gathered data about each host (`ansible_*`)

Run it; each task reports `ok` (already correct), `changed` (it fixed
something), `failed`, or `skipped`, per host.

---

## 2. Inventory and where variables come from

```ini
[login]
login0[1:2]

[cpu]
cpu[001:200]

[gpu]
gpu[001:016]

[compute:children]
cpu
gpu
```

Variables can be set in ~22 places. The ones you must know, **low → high
priority**:

```
role defaults
  < group_vars/all
  < group_vars/<group>          (parent groups before child groups)
  < host_vars/<host>
  < play vars:
  < -e "key=value"  (extra-vars — ALWAYS wins)
```

**Analogy — a dress code.** Firm-wide default, then department override,
then team, then your manager's note for today. A direct instruction from
the CEO for one meeting (`-e`) beats everything — for that meeting only.

(Lab: `step1_inventory_graph.py` resolves this precedence.)

---

## 3. Idempotency — the property that makes re-runs safe

Running the playbook again should change **nothing** and report no
`changed`. State-modelled modules (`package`, `user`, `copy`,
`template`, `systemd`, `mount`) check current state first — they're
idempotent by design.

The traps are `command` and `shell`: they run **every time** and report
`changed` unless you guard them.

```yaml
- name: initialise the database once
  ansible.builtin.command: /opt/app/db-init
  args:
    creates: /var/lib/app/.initialised     # skip if this path exists
# alternatives:
#   register: a check, then  when: check.rc != 0
#   changed_when: "'created' in result.stdout"
#   failed_when: false
```

**Analogy.** "The door should be locked" is safe to repeat. "Turn the
key clockwise" is not — repeated, it *unlocks* a locked door. A bare
`shell:` task is the second kind until you add `creates:` or `when:`.

(Lab: `step2_idempotency_check.py`.)

---

## 4. Handlers and rolling changes

A **handler** runs once at the end of a play, **only if notified** —
"the config file changed, so restart the service" without a restart when
nothing changed.

For fleet changes you never want everything at once:

```yaml
- hosts: compute
  serial: "20%"                 # roll in waves of 20%
  max_fail_percentage: 5        # abort the whole play if a wave goes bad
  tasks:
    - name: drain the node in Slurm
      command: scontrol update nodename={{ inventory_hostname }} state=drain reason=patch
    - import_role: { name: os_patch }
    - ansible.builtin.reboot:
    - name: wait for node_exporter to answer
      uri: { url: "http://{{ inventory_hostname }}:9100/metrics" }
      register: r
      until: r.status == 200
      retries: 30
      delay: 10
    - command: scontrol update nodename={{ inventory_hostname }} state=resume
```

(Lab: `step3_rolling_update.py`.)

---

## 5. Making it fast at 2,000 hosts

Ansible's defaults are tuned for ~5 hosts. At fleet scale:

| Setting | Default | Set to |
|---|---|---|
| `forks` | 5 | 50–100 |
| `strategy` | `linear` (all hosts wait at every task) | `free` (fast hosts race ahead) |
| SSH pipelining | off | `pipelining = True` |
| `ControlPersist` | short | `ssh_args = -o ControlPersist=300s` |
| fact gathering | full, every run | `gather_subset: [min]` + fact caching (Redis/jsonfile) |
| per-package tasks | one task each | `package: name: [list]` in one task |

"The playbook takes 3 hours" is almost always: `forks: 5`, full fact
gathering, linear strategy, and 40 separate `yum install` tasks. Fixing
those four routinely gets it to 15 minutes.

---

## 6. Structure and testing

```
site.yml
inventory/prod/hosts.ini  inventory/prod/group_vars/  host_vars/
roles/
  slurm_compute/  lustre_client/  hardening/  monitoring/
    tasks/main.yml  templates/  defaults/main.yml  handlers/main.yml
    molecule/default/  { converge.yml, verify.yml }   # test: converge + idempotence
requirements.yml            # pinned collections
ansible.cfg
```

Test roles with **molecule** (converge, then converge again and assert
**zero changed** = idempotent). Run from **AWX/AAP** or a CI runner with
a locked `requirements.yml`.

---

## 7. Run the labs

```bash
python3 ansible/step1_inventory_graph.py       # group chain + variable precedence
python3 ansible/step2_idempotency_check.py      # which tasks converge on run 2
python3 ansible/step3_rolling_update.py         # serial waves + failure ceiling + health gate
```

The standard cluster combo: **image for the base** (Module 7), **Ansible
for the last mile and day-2**.
