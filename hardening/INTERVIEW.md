# Security Hardening — Interview Q&A

---

## Baselines

**Q: CIS Benchmark vs DISA STIG — difference?**
Same idea (a hardened-configuration standard). CIS is industry-consensus
and voluntary, with Level 1 (safe) / Level 2 (defense-in-depth)
profiles. A STIG is DISA's standard for DoD systems, contractually
required, tied to an accreditation. STIG findings map to NIST 800-53.

**Q: What's a hardening "profile" or "tailoring"?**
A subset/modification of a benchmark for your context — disabling rules
that break required apps, changing parameters (min password length),
each with a documented justification.

---

## SSH

**Q: Order of the top-5 sshd_config hardening settings.**
`PermitRootLogin no`, `PasswordAuthentication no` (keys only),
`AllowGroups`/`AllowUsers` allowlist, `MaxAuthTries` ≤ 3–4, modern
`Ciphers`/`KexAlgorithms`/`MACs` (drop CBC, 3des, sha1, arcfour).

**Q: `PermitRootLogin prohibit-password` — is that enough?**
No — it still allows a root login via SSH key. Scanners flag it. Use
`no` and make people escalate with `sudo`.

**Q: `sshd_config` parsing order?**
First-match-wins for most keywords; unset keywords take their compiled
defaults; `Match` blocks override the global section for the matched
connections only.

**Q: How does SSH auth actually get decided — sshd or PAM?**
`sshd_config` gates transport-level policy (which methods, which
users/groups). PAM (`/etc/pam.d/sshd`) runs the account/auth/session
stacks: lockout (`pam_faillock`), password quality, MFA, session limits.
Both must agree.

**Q: What is `AuthenticationMethods publickey,keyboard-interactive`?**
Requires *both* factors in sequence (key AND OTP) — this is how you do
MFA over SSH.

---

## Privilege / sudo

**Q: Why is `sudo vi` dangerous?**
`:!sh` (or `:shell`) spawns a root shell from inside the editor. Same
for `less`/`more` (`!sh`), `find -exec`, `awk 'BEGIN{system()}'`,
`tar --to-command`, `git` (pager, `-c core.pager`), `systemctl` (pager),
`env`, `python -c`. See GTFOBins.

**Q: `NOPASSWD` — when is it acceptable?**
Only for non-interactive automation on tightly-scoped commands, ideally
from a dedicated account. Never for editors, shells, package managers,
or anything with a wildcard.

**Q: SUID vs SGID vs sticky bit?**
SUID: run with the file owner's UID (e.g. `passwd`). SGID on a file: run
with the group; on a directory: new files inherit the dir's group.
Sticky on a dir (`/tmp`): only the file owner can delete their files.
`find / -perm -4000 -type f` audits SUID.

**Q: Linux capabilities — how do they relate to SUID root?**
Capabilities split root's power into ~40 units (`CAP_NET_BIND_SERVICE`,
`CAP_SETUID`, `CAP_SYS_ADMIN`…). A binary with
`setcap cap_net_bind_service=+ep` can bind :80 without being SUID root —
smaller blast radius. `getcap -r /`.

**Q: What is `pam_faillock`?**
The modern account-lockout module (replaced `pam_tally2`). Configured in
`/etc/security/faillock.conf` (`deny`, `unlock_time`, `fail_interval`);
`faillock --user x --reset` clears it.

---

## MAC

**Q: DAC vs MAC?**
Discretionary: the resource owner controls access (chmod). Mandatory: a
system-wide policy the owner cannot override — contains a compromised
process regardless of file modes.

**Q: SELinux modes?**
`Enforcing` (deny + log), `Permissive` (allow + log — for debugging
policy), `Disabled` (no labels, needs a relabel to re-enable). `getenforce`,
`setenforce 1`, `SELINUX=` in `/etc/selinux/config`.

**Q: How do you fix an SELinux denial *without* disabling it?**
Read the AVC (`ausearch -m avc` / `sealert`), then: flip a boolean
(`setsebool -P`), fix a label
(`semanage fcontext` + `restorecon`), add a port
(`semanage port`), or build a minimal module (`audit2allow -M`). Disabling
is never the fix.

**Q: SELinux type enforcement — one sentence.**
Every process runs in a *domain* and every object has a *type*; the
policy is an allowlist of (domain, type, class, permission) tuples —
anything not explicitly allowed is denied.

---

## Kernel / network sysctls

**Q: What does `kernel.yama.ptrace_scope` do?**
Restricts which processes can `ptrace` others. `1` = only a parent can
trace its child (blocks a compromised process from dumping another's
memory / injecting). `2` = admin only, `3` = disabled entirely.

**Q: `rp_filter`?**
Reverse-path filtering: drop a packet if the route back to its source
address wouldn't go out the interface it arrived on. Anti-spoofing.
`1` = strict, `2` = loose (needed for asymmetric/multi-homed routing).

**Q: `kernel.randomize_va_space` values?**
`0` off, `1` randomise stack/mmap/VDSO, `2` also randomise the heap
(brk) — full ASLR, the standard setting.

**Q: `kernel.kptr_restrict`?**
Hides kernel pointers in `/proc` and logs (`2` = always). Stops leaking
KASLR offsets to unprivileged users.

---

## Detection & integrity

**Q: What should auditd watch at minimum?**
Writes to `/etc/passwd|shadow|sudoers(.d)`, `execve` by root with
`auid>=1000`, `ptrace`, `mount`, module load, time changes, and
permission/xattr changes. Then make rules immutable (`-e 2`) and ship
off-box.

**Q: AIDE / Tripwire — what and what's the catch?**
File integrity monitoring: hash a baseline, diff periodically. Catch:
the database must live off-box (or on read-only media), or an attacker
just updates it after tampering.

**Q: What is `auditd` backlog and why care?**
A kernel buffer of audit events waiting for `auditd`. If it fills,
events are lost or (depending on `failure` mode / `backlog_wait_time`)
syscalls stall. Size it (`-b 8192`) and monitor
`audit_backlog_wait_time_actual`.

---

## Process / verification

**Q: How do you keep a fleet at its hardened baseline over time?**
Bake hardening into the image, enforce config with Ansible (idempotent),
scan on a schedule with OpenSCAP, alert on regressions, and gate all
config changes through review. Drift is continuous; the answer is
automation, not a one-time pass.

**Q: You inherit 500 unmanaged servers. First three hardening moves?**
1. Inventory + baseline scan (OpenSCAP with the CIS profile) to know
   where you stand. 2. SSH: keys-only, no root, allowlist, MFA on
   jump hosts. 3. Centralise logs/auditd and patch management. Then
   remediate by CAT/level in waves.

**Q: "It's more secure to change the SSH port from 22" — true?**
Marginally reduces brute-force log noise from untargeted bots; it is
not a security control (a port scan finds it in seconds). Do it if you
like quieter logs; don't count it as hardening.
