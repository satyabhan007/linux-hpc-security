# Security Hardening — Deep Dive: Production Scenarios

---

## Scenario 1 — Compromise via a "harmless" sudo rule

**The rule.** `%deploy ALL=(ALL) NOPASSWD: /usr/bin/systemctl *`

**The attack.** A CI token for a `deploy`-group account leaks.

```bash
sudo systemctl status                # opens the pager (less) as root
!/bin/sh                             # shell escape -> root
# or, no pager:
sudo systemctl link /tmp/evil.service && sudo systemctl enable --now evil
```

**Fix.** Exact unit names, no wildcard, kill the pager:

```
Cmnd_Alias DEPLOY_SVC = /usr/bin/systemctl restart app.service, \
                        /usr/bin/systemctl status app.service
%deploy ALL=(root) NOPASSWD: DEPLOY_SVC
Defaults!DEPLOY_SVC env_keep -= "SYSTEMD_PAGER"
Defaults!DEPLOY_SVC env_reset
```

**Prevention.** A CI check that greps `sudoers.d/` for `*`, `ALL`,
`NOPASSWD.*(vi|vim|less|more|man|find|awk|tar|git|env|python|perl)`, and
fails the pipeline. `sudo -l` output diffed on every host.

---

## Scenario 2 — SSH brute force succeeds after "we disabled root login"

**Symptom.** `PermitRootLogin no` is set, yet an attacker gets a shell.

**Root cause.** `PasswordAuthentication yes` was still set for regular
users, and a service account (`jenkins`, `oracle`, `postgres`) had a
weak password and shell access. Also `PermitRootLogin prohibit-password`
(not `no`) still allows a root *key*.

**Fix.**
```
PermitRootLogin no
PasswordAuthentication no
AuthenticationMethods publickey
AllowGroups interactive-users            # service accounts NOT in it
```
Service accounts: `usermod -s /usr/sbin/nologin`, `passwd -l`, and no
`~/.ssh/authorized_keys`. Add `pam_faillock` (deny=5, unlock_time=900)
and `fail2ban`/`sshguard` as depth, not as the primary control.

---

## Scenario 3 — SELinux is "off" across the fleet and nobody knows why

**Symptom.** `getenforce` → `Permissive` (or `Disabled`) on 300 nodes.
Git blame on the Ansible role shows `selinux: state=permissive` added
"temporarily" 8 months ago to unblock a deploy.

**The right handling of the original problem:**
```bash
# reproduce the denial, then build a minimal policy
ausearch -m avc -ts recent
ausearch -m avc -ts recent | audit2allow -m myapp > myapp.te
ausearch -m avc -ts recent | audit2allow -M myapp   # compiles myapp.pp
semodule -i myapp.pp
# common alternatives that avoid a custom module:
setsebool -P httpd_can_network_connect on
semanage fcontext -a -t httpd_sys_content_t '/srv/app(/.*)?'
restorecon -Rv /srv/app
semanage port -a -t http_port_t -p tcp 8443
```

**Fleet fix.** Set `SELINUX=enforcing` in the image, `enforcing=1` in
kernel args, and an OpenSCAP rule (Module 3) that fails the build if any
node reports not-enforcing. Roll enforcing back on in waves (Module 6)
with `semodule -l` diffs and a rollback plan.

---

## Scenario 4 — auditd is running but the SOC has no useful data

**Symptom.** During an incident, `ausearch` returns almost nothing
relevant. `auditctl -l` shows only the distro defaults.

**Fix — a real ruleset** (`/etc/audit/rules.d/hardening.rules`,
excerpt, mapped to a framework):

```
-w /etc/passwd -p wa -k identity
-w /etc/sudoers -p wa -k scope
-w /etc/sudoers.d/ -p wa -k scope
-w /etc/ssh/sshd_config -p wa -k sshd
-a always,exit -F arch=b64 -S execve -F euid=0 -F auid>=1000 -F auid!=-1 -k rootcmd
-a always,exit -F arch=b64 -S ptrace -k tracing
-a always,exit -F arch=b64 -S mount -k mounts
-a always,exit -F arch=b64 -S setxattr,fsetxattr,removexattr -F auid>=1000 -k perm_mod
-e 2                       # make the config immutable until reboot
```

Ship to the SIEM (`audisp-remote` / rsyslog / a forwarder). Watch the
audit **backlog** (`kernel.audit_backlog_limit`, `audit_backlog_wait_time`)
— a full backlog either drops events or (with `--backlog_wait_time`
misconfigured) can stall syscalls.

---

## Scenario 5 — Hardening broke the cluster

**Symptom.** Applied the full CIS L2 remediation. Now: MPI jobs fail to
launch, `/tmp` fills instantly, NFS mounts are slow, and half the nodes
won't reboot.

**The usual culprits.**
| CIS/STIG rule | HPC breakage | Reconciliation |
|---|---|---|
| `noexec` on `/tmp`, `/dev/shm` | MPI, Python venvs, Spack builds | `exec` on `/tmp` on compute; keep `nosuid,nodev` |
| `fs.suid_dumpable=0` + core pattern | debuggers can't get cores | fine — document it |
| `kernel.unprivileged_userns_clone=0` | Apptainer rootless, `unshare` | allow on compute (Module 11) |
| `hard core 0` limits | same | scoped exception |
| FIPS mode retrofitted | node won't boot / ssh breaks | must be set at install, not after |
| firewalld default-deny | Slurm/MUNGE/NHC ports, RDMA CM | explicit allowlist for the mgmt + fabric subnets |

**Process.** Tailor (Module 3), document each deviation with a
justification, apply in `--check` first, canary on one node, then roll.
"96% compliant with 11 documented exceptions" beats "100% compliant and
the cluster is down".

---

## Baseline hardening role — structure

```
roles/hardening/
  tasks/
    main.yml            # includes the below, gated by tags
    ssh.yml  pam.yml  sudo.yml  sysctl.yml  auditd.yml  aide.yml  fs_mounts.yml
  templates/
    sshd_config.j2  faillock.conf.j2  99-hardening.conf.j2
  handlers/main.yml     # restart sshd (validated!), restart auditd, load sysctl
  molecule/default/     # test converge + idempotence + a verify.yml running oscap
```

`sshd` handler must validate before reload: `sshd -t -f %s` — a bad
config that reloads locks everyone out.
