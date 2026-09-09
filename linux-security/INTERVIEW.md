# Linux Security — Interview Q&A

---

## Capabilities

**Q: What are POSIX capabilities?**
A split of the monolithic root privilege into ~40 independent units
(`CAP_NET_BIND_SERVICE`, `CAP_SYS_ADMIN`, `CAP_DAC_OVERRIDE`, …) so a
process can hold only the powers it needs.

**Q: The five capability sets on a thread?**
Permitted (the ceiling of what it may use), Effective (currently
active), Inheritable (preserved across `execve` if the file also has
them inheritable), Bounding (a hard per-process ceiling — you can only
drop from it), Ambient (added in 4.3 so non-file, non-inheritable caps
can survive `execve` for non-setuid programs).

**Q: Why is `CAP_SYS_ADMIN` called "the new root"?**
It gates `mount`, `umount`, `setns`, `pivot_root`, `swapon`, quota, many
`ioctl`s, `bpf` (historically), and dozens more — holding it is close to
full root. Never grant it when a narrower cap exists.

**Q: A container drops all caps but adds `CAP_NET_RAW`. What can it now do that matters?**
Craft raw packets — ARP spoofing / DHCP spoofing on the container
network, ICMP tunnelling, and some scanning. It's why `NET_RAW` is
being removed from the Docker/Kubernetes default set.

**Q: `NoNewPrivileges=yes` — what does it guarantee?**
After it's set, `execve` can never grant the process more privileges —
setuid/setgid bits and file capabilities are ignored for all future
execs. Breaks a whole class of privilege-escalation chains; also breaks
legitimate setuid helpers, so know your service.

---

## seccomp

**Q: seccomp modes?**
`SECCOMP_MODE_STRICT` (only `read`/`write`/`_exit`/`sigreturn` — almost
unusable) and `SECCOMP_MODE_FILTER` (a BPF program per syscall returning
ALLOW / ERRNO / TRAP / KILL_PROCESS / KILL_THREAD / LOG / USER_NOTIF).

**Q: `ERRNO` vs `KILL` action — when each?**
`ERRNO` (return `EPERM`) for syscalls a benign library might probe and
handle — the app limps on and you get logs. `KILL` for syscalls that can
only mean compromise (`ptrace`, `init_module`, `userfaultfd`,
`kexec_load`).

**Q: Why does a seccomp profile break after a base-image bump?**
glibc changes which syscall it uses for the same operation across
versions/arch — `open`→`openat`, `stat`→`newfstatat`,
`clone`→`clone3`, `epoll_wait`→`epoll_pwait2`. The allowlist must be
built on the target platform and cover new equivalents.

**Q: Can a process widen its own seccomp filter later?**
No. Filters are stacked and only ever narrow the set. This is what makes
it safe to apply early in `main()`.

**Q: What is `SECCOMP_RET_USER_NOTIF` for?**
Hand the syscall to a userspace supervisor to allow/deny/emulate —
used by container runtimes to safely emulate `mount`, `mknod`, etc.
without granting the capability.

---

## LSM / SELinux / AppArmor

**Q: LSM stacking — how do DAC and the LSM interact?**
DAC (uid/gid + rwx) is checked first. If DAC denies, that's the answer.
If DAC allows, the LSM hook runs and can still deny. An LSM can only
*further restrict*, never grant.

**Q: SELinux type enforcement in one line.**
Access `subject_type → object_type : class { perm }` is denied unless a
policy `allow` rule explicitly permits it — default deny over labels.

**Q: What is a domain transition?**
On `execve` of a file with the right entrypoint type, the new process
runs in a different (usually more confined) domain — e.g. `init_t`
execs `httpd_exec_t` → runs as `httpd_t`. It's how a service is
confined automatically at start, without a wrapper.

**Q: `Enforcing` vs `Permissive` vs `Disabled`.**
Enforcing: denials are enforced and logged. Permissive: denials are
*logged only* (allowed) — a debugging/policy-development state.
Disabled: no labelling at all — re-enabling later requires a full
filesystem relabel.

**Q: A file has the wrong SELinux context. `chcon` or `semanage fcontext`?**
`semanage fcontext -a -t <type> '<path regex>'` then `restorecon` —
persistent, survives a relabel. `chcon` is a one-off that a
`restorecon`/relabel will revert.

**Q: SELinux vs AppArmor — pick one for a fleet of Ubuntu app servers, justify.**
AppArmor: path-based profiles, ships and is enabled by default on
Ubuntu, profiles are readable and per-binary, lower operational cost.
SELinux: label-based, finer-grained, better for multi-level / strict
separation and RHEL shops, but steeper. For homogeneous Ubuntu app
servers, AppArmor's cost/benefit usually wins.

**Q: Why is `setenforce 0` a serious audit finding?**
It disables *every* type-enforcement decision at once. Any exploit that
was contained by a domain (confined root reading `/etc/shadow`, a
service writing outside its allowed paths) is now free. It also often
means nobody is maintaining the policy.

**Q: What's wrong with `audit2allow -a | semodule -i`?**
It grants whatever the process *attempted*, including things it should
never do (a mislabelled-file access, or an actual attack). Triage each
denial: relabel the file, write a narrow reviewed rule, or fix the app —
don't blanket-allow.

---

## Namespaces & integrity

**Q: Are namespaces a security boundary?**
Partially. They constrain what a process *sees* (pids/net/mnt/user/ipc/
uts/cgroup/time). But user namespaces have been a repeated LPE vector,
and a kernel bug in namespace handling is an escape. Real containment =
namespaces + seccomp + LSM + dropped caps together.

**Q: What does a user namespace give you?**
A UID/GID mapping so a process is root (uid 0) *inside* the namespace
while being an unprivileged uid *outside* — the basis of rootless
containers. `/proc/<pid>/uid_map`, `/etc/subuid`.

**Q: Kernel `lockdown` mode — what does `integrity` block?**
Interfaces that let userspace modify the running kernel: `/dev/mem`,
`/dev/kmem`, unsigned module load, unsigned `kexec`, some MSR writes,
BPF for certain probes, hibernation to an unencrypted swap. Even root is
blocked. `confidentiality` additionally blocks kernel-memory *reads*.

**Q: IMA measurement vs IMA appraisal?**
Measurement: hash every file before use and extend a TPM PCR (for
attestation / audit — detect after the fact). Appraisal: verify a signed
hash (`security.ima` xattr) before allowing execution/open — *prevent*
running modified files.

**Q: How do you demonstrate a node runs only your code, to an auditor?**
Secure Boot + signed kernel/modules (`lockdown=integrity`), IMA
appraisal in enforce mode, and a TPM-backed remote attestation check
that gates the node's access to secrets/storage (Module 15) until its
PCR quote matches a known-good value.

---

## Debug drills

**Q: A container works with `--privileged`, fails without. How do you find the minimum grant?**
Run it unprivileged, collect the failures: `dmesg`/`ausearch -m
SECCOMP,AVC`, `strace -f` for `EPERM`. Map each to the specific
`--cap-add`, seccomp allow, device, or masked-path unmask needed, and
grant only those. Usually it's 1–2 caps + one device, not "everything".

**Q: `systemd-analyze security nginx.service` returns 9.6 "UNSAFE". What now?**
It lists which sandboxing directives are unset. Add the safe wins:
`NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`,
`PrivateTmp`, `PrivateDevices`, `CapabilityBoundingSet=`,
`SystemCallFilter=@system-service`, `RestrictAddressFamilies=`,
`MemoryDenyWriteExecute` (if the app has no JIT). Re-run after each; test.

**Q: `/proc/<pid>/status` shows `Seccomp: 0` for a service you filtered. Why?**
The filter is applied by the runtime *after* fork but the field you're
reading is the main pid before exec, or the service dropped it, or
`SystemCallFilter=` was overridden by a drop-in. Check `Seccomp: 2`
(filter mode) and `Seccomp_filters:` count on the actual worker thread.

**Q: Process can't read a file it owns with mode 600. `ls -Z` shows a `_t` mismatch. Fix?**
SELinux type mismatch, not DAC. `restorecon -v <file>` if the default
context is right, or `semanage fcontext -a -t <correct_t> '<path>'` +
`restorecon`. Confirm with `ausearch -m avc` that the denial is gone.
