# Linux Security — The Amateur's Guide

> Hardening (Module 2) locks the doors and windows of the house. This
> module is the building's structure itself — load-bearing walls the
> occupant *cannot* knock through even if they want to, and a guard who
> checks every internal door against a written list.

Module 2 was configuration you *choose*. This module is the kernel
mechanisms that **enforce** a boundary regardless of what a process
tries — the difference between "we set a strong password policy" and
"the process literally cannot make that syscall".

---

## 1. The layers, from weakest to strongest guarantee

| Layer | What it constrains | Bypassed by |
|---|---|---|
| **DAC** (rwx bits, uid/gid) | file access by owner | being root; a setuid bug |
| **Capabilities** | which *root powers* a process holds | holding `CAP_SYS_ADMIN` (≈ root) |
| **Namespaces** | what a process can *see* (pids, net, mounts, users) | a namespace-escape kernel bug |
| **seccomp-bpf** | which *syscalls* a thread may issue | only the syscalls you allowed |
| **LSM (SELinux/AppArmor)** | every access, as *subject type → object type* | `setenforce 0`; a policy hole; a kernel LPE |
| **IMA/EVM, lockdown, Secure Boot** | what code/files are *trusted to run* | signing-key compromise |

Defence in depth: an exploit must beat **all** the layers that apply, not
one. A confined-root RCE (uid 0 but domain `httpd_t`, seccomp allowlist,
no `CAP_SYS_MODULE`) is often a dead end.

---

## 2. Capabilities — "root" is ~40 separate privileges

Historically uid 0 meant *everything*. Capabilities split that:

```
CAP_NET_BIND_SERVICE   bind a port below 1024
CAP_NET_RAW            raw/packet sockets (ping, tcpdump)
CAP_DAC_OVERRIDE       ignore file permission bits
CAP_SYS_PTRACE         read/write another process's memory
CAP_SYS_MODULE         load a kernel module  (game over if held)
CAP_SYS_ADMIN          the "junk drawer" — mount, setns, and ~30 others
```

A web server needs `CAP_NET_BIND_SERVICE` and maybe `CAP_NET_RAW` — not
the other 38. Grant exactly those:

```ini
# systemd unit
[Service]
CapabilityBoundingSet=CAP_NET_BIND_SERVICE CAP_NET_RAW
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=yes
```

**Ambient caps exist** because non-file, non-inheritable caps are
**dropped on `execve()`** — set them on a thread, exec a helper, and
they vanish. (Lab: `step1_capabilities_split.py` models the capset
transition and shows least-privilege cutting post-exploit reach ~95%.)

`getpcaps <pid>`, `capsh --print`, `setcap`/`getcap` on files.

---

## 3. seccomp — a syscall firewall

A process voluntarily loads a BPF filter the kernel runs on **every
syscall**. Default-deny; allow the 40–80 the app really uses; everything
else returns `EPERM` or kills the process.

```
normal:  read, write, openat, epoll_wait, futex, sendto ...   -> ALLOW
exploit: ptrace, userfaultfd, init_module, unshare, mount ...  -> KILL / EPERM
```

That removes 80%+ of the ~350-syscall kernel surface — the surface where
local-privilege-escalation bugs live. `systemd` (`SystemCallFilter=`),
Docker/podman (`--security-opt seccomp=`), Chrome, OpenSSH, and
`kubelet` all use it. (Lab: `step2_seccomp_filter.py`.)

> **Analogy.** A bouncer with a guest list for the kitchen door. Staff
> (the app's real syscalls) walk in. Anyone else is turned away — and a
> few names on a "call the police" list get tackled on sight.

---

## 4. LSM — SELinux and AppArmor

A **Linux Security Module** hooks every access check *after* DAC and can
only further restrict. Two mainstream ones:

- **SELinux** — label-based. Every process has a **domain** (`httpd_t`),
  every object a **type** (`shadow_t`, `http_port_t`). Access is denied
  unless a policy `allow httpd_t shadow_t:file read;` exists. On
  `execve`, a **domain transition** moves the new process into its
  confined domain automatically. Fine-grained, powerful, complex.
- **AppArmor** — path-based profiles (`/usr/sbin/nginx { /var/www/** r,
  ... }`). Easier to read and write, less precise (paths, not labels).

The key property: even **root in a confined domain** cannot read
`/etc/shadow` or the host SSH keys if the policy doesn't allow it. That
is why `setenforce 0` (or `--privileged`, or an unconfined domain) is a
serious finding — it turns every deny into an allow-with-a-log at once.
(Lab: `step3_selinux_typeenforce.py` models type enforcement + the
transition, and the web-RCE containment.)

```bash
getenforce ; sestatus                 # Enforcing?  policy?
ps -eZ | grep httpd                    # what domain is it in
ausearch -m avc -ts recent            # denials
audit2allow -a                        # (careful) generate allow rules from denials
aa-status ; aa-complain / aa-enforce  # AppArmor
```

---

## 5. Namespaces as a security boundary (and their limits)

The same namespaces that make containers (Module 1, 11) are a boundary:
a **user namespace** can make a process root *inside* while unprivileged
*outside*; a **network namespace** removes all host interfaces; a
**mount namespace** + `pivot_root` gives a private root.

But namespaces are **not** a strong sandbox on their own — user
namespaces have historically been a rich source of LPE bugs
(`unshare` + a kernel flaw). Hardened hosts often set
`kernel.unprivileged_userns_clone=0` and rely on seccomp + LSM for the
real containment.

---

## 6. Integrity: IMA/EVM, lockdown, Secure Boot

- **Secure Boot** — firmware only loads a signed bootloader/kernel.
- **Kernel lockdown** (`lockdown=integrity|confidentiality`) — even root
  can't `kexec` an unsigned kernel, write `/dev/mem`, or load unsigned
  modules.
- **Module signing** — `CONFIG_MODULE_SIG_FORCE`; the kernel refuses
  unsigned `.ko` files.
- **IMA/EVM** — measure (hash) and optionally *appraise* (verify a
  signature on) every file before it's `mmap`'d executable or opened;
  extends the TPM PCRs for remote attestation.

Together these answer "is the code running what we shipped?" — the layer
below all the access control.

---

## 7. Run the labs

```bash
python3 linux-security/step1_capabilities_split.py   # root -> 40 caps; execve capset math
python3 linux-security/step2_seccomp_filter.py       # syscall allowlist vs an exploit trace
python3 linux-security/step3_selinux_typeenforce.py  # type enforcement + domain transition
```

Next: **`encrypted-anomaly/`** — when the payload is encrypted and these
controls can't see inside it, how you still tell normal activity from an
attack.
