# Security Hardening — The Amateur's Guide

> A fresh OS is optimised for "works on the first try", not "survives the
> internet". Hardening is the weekend you spend changing the locks after
> you move in.

---

## 1. What hardening is

Systematically removing convenience that an attacker could use:

- turn off services you do not run
- close ports you do not need
- require strong authentication (keys, MFA, lockout)
- grant the *minimum* privilege for each role
- log the things that matter and ship the logs off-box
- make privilege escalation loud and hard

You measure it against a **baseline**: a **CIS Benchmark** (industry
consensus, Level 1 = safe everywhere, Level 2 = defense-in-depth), a
vendor guide, or a **DISA STIG** (Module 3, contractual).

**Analogy — a new house.** The builder left a key under the mat, every
window unlatched, the alarm off "so you can move in". Hardening is the
first weekend: new locks, window latches, alarm wired, and a written
list of who has a key.

---

## 2. The front door: SSH

`/etc/ssh/sshd_config`, highest-value settings:

```
PermitRootLogin no                 # log in as a user, then escalate
PasswordAuthentication no          # keys only
PubkeyAuthentication yes
KbdInteractiveAuthentication no
AllowGroups ssh-users              # allowlist, not "everyone"
MaxAuthTries 3
LoginGraceTime 30
ClientAliveInterval 300
ClientAliveCountMax 2
X11Forwarding no
Ciphers  aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
```

Behind `sshd`, **PAM** stacks the real logic: `pam_faillock` (lockout
after N fails), `pam_pwquality` (complexity), `pam_pwhistory`, plus MFA
modules (`pam_google_authenticator`, `pam_sss` with an OTP).

**Analogy.** `sshd_config` is the bouncer's dress code; PAM is the
bouncer's full checklist — ID, banned list, count of tonight's failed
entries, second factor. Fix the dress code and skip the checklist and
people still get in the side door.

---

## 3. Least privilege: sudo

Never `%ops ALL=(ALL) NOPASSWD: ALL`. Grant exact commands:

```
Cmnd_Alias NGINX_CTL = /usr/bin/systemctl restart nginx, \
                       /usr/bin/systemctl status nginx
%web ALL=(root) NGINX_CTL
Defaults!NGINX_CTL env_keep -= "SYSTEMD_PAGER", !requiretty
```

Every wildcard is a hole. `sudo vi` → `:!sh` → root shell. `sudo less`,
`find`, `awk`, `tar --checkpoint-action=exec`, `systemctl` (its pager!),
`git`, `man` — all escape to a root shell. **GTFOBins** is the catalogue
attackers use; check every binary you grant against it.

**Analogy.** Giving a contractor the master key "to save time" instead
of the one door they're working on. Fine until it isn't — and you'll
never know which contractor copied it.

---

## 4. Mandatory Access Control: SELinux / AppArmor

Normal Unix permissions are **discretionary** — the owner (or a process
running as that owner) can grant access away. **MAC** is a policy the
owner *cannot* override: a compromised web server still cannot read
`/etc/shadow`, even though the file mode "would" allow it if `chmod`'d.

- **SELinux** (RHEL family): label-based, strict. `getenforce`,
  `ausearch -m avc`, `audit2allow` to build a policy module from
  denials, `semanage`/`setsebool` to tune.
- **AppArmor** (Ubuntu/SUSE): path-based, easier to read.

> **Never `setenforce 0` "to fix it".** That disables the one control
> that would contain the next exploit. Fix the label or write a targeted
> policy: `ausearch -m avc -ts recent | audit2allow -M myfix`.

---

## 5. Kernel + network hardening

```
# /etc/sysctl.d/99-hardening.conf
kernel.kptr_restrict = 2
kernel.dmesg_restrict = 1
kernel.yama.ptrace_scope = 1
kernel.randomize_va_space = 2
kernel.unprivileged_bpf_disabled = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
```

Plus a **default-deny** firewall (`nftables`), `auditd` rules mapped to
a framework, **AIDE** file integrity with an off-box database, and
`chattr +i` on files that should never change.

---

## 6. The part everyone forgets: keep verifying

A baseline you set once and never re-scan has already drifted. Fourteen
months of "just this one change" opens holes. Scan on a schedule, gate
config changes through code (Module 6), and treat the perimeter as
already breached — harden the crown jewels accordingly.

---

## 7. Run the labs

```bash
python3 hardening/step1_cis_score.py       # weighted scoring against a baseline
python3 hardening/step2_sshd_audit.py      # parse sshd_config with real precedence
python3 hardening/step3_privesc_paths.py   # enumerate one-hop paths to root
```

Next: **`stigs/`** — the same idea, made contractual and machine-checkable.
