# Linux Security — Deep Dive: Production Scenarios

---

## Scenario 1 — Web RCE that goes nowhere because the service was confined

**Symptom.** IDS alerts on a webshell upload to a PHP app. Incident
response expects lateral movement; there is none.

**Why it stalled.** The `httpd` service ran:
- domain `httpd_t` (SELinux targeted policy, `getenforce` = Enforcing)
- `CapabilityBoundingSet=CAP_NET_BIND_SERVICE`, `NoNewPrivileges=yes`
- `SystemCallFilter=@system-service` minus `@privileged @mount @debug`
- `ProtectHome=yes ProtectSystem=strict ReadWritePaths=/var/www/uploads`

The attacker had code-exec as `apache` but:
```
read /etc/shadow          -> SELinux DENY (httpd_t shadow_t:file read)
setuid(0)                 -> NoNewPrivileges: EPERM even if a setuid bug existed
ptrace(sshd)              -> seccomp KILL
load kernel module        -> no CAP_SYS_MODULE + lockdown
write /usr/bin/x          -> ProtectSystem=strict: EROFS
mount --bind              -> seccomp EPERM + no CAP_SYS_ADMIN
```

**Lesson.** None of these controls stops the RCE. *Together* they turn a
full compromise into "attacker can deface files under
`/var/www/uploads` and nothing else". That is the whole game of Linux
security: assume the process is owned, and bound the blast radius.

---

## Scenario 2 — `audit2allow` used as a "make it work" button

**Symptom.** A new app throws SELinux denials. Someone runs
`ausearch -m avc -ts recent | audit2allow -M myapp && semodule -i
myapp.pp` until the denials stop. A month later a pentest reads
`/etc/shadow` through the app.

**What went wrong.** `audit2allow` generated
`allow httpd_t shadow_t:file read;` because at some point the app
*tried* it (a misconfigured library). The blanket "allow whatever it
asked for" re-opened the exact hole SELinux exists to close.

**The right process.**
1. Look at *every* denial. Ask "should it be doing this?"
2. Legit-but-mislabelled file → `semanage fcontext -a -t
   httpd_sys_content_t '/srv/site(/.*)?'` + `restorecon`. Fix the
   **label**, not the policy.
3. Legit new access pattern → a **narrow** custom module, reviewed.
4. Illegitimate (the shadow read) → fix the app; never allow it.
5. `dontaudit` only to silence known-harmless noise, never to hide a
   real deny.

---

## Scenario 3 — Building a seccomp profile for a service

**Goal.** Ship `SystemCallFilter=` / a Docker seccomp JSON that is
default-deny without breaking the app.

**Method.**
```bash
# 1. run under audit in staging, capture every syscall it makes
strace -f -qcf -o trace.txt ./app --run-realistic-load
# or: SCMP_ACT_LOG profile + `ausearch -m SECCOMP`
# or: perf trace -s ./app

# 2. derive the set (also cover: startup, config reload, graceful stop,
#    error paths, the rare cron/GC path)
awk '/^[a-z_]+\(/{sub(/\(.*/,"");print}' trace.txt | sort -u > allow.txt

# 3. start from a curated base and subtract
#    systemd: SystemCallFilter=@system-service
#             SystemCallFilter=~@privileged ~@resources
#    docker:  default profile + remove groups you proved unused
```

**Traps.**
- glibc picks different syscalls per version/arch (`openat` vs `open`,
  `clone3` vs `clone`, `newfstatat`) — build on the target platform.
- JITs (`node`, `python -X`) need `mprotect`/`pkey_mprotect`; block them
  wrong and you get a silent crash.
- `SCMP_ACT_ERRNO` is safer than `KILL` for a first rollout — you get
  logs and a limping app, not an outage.

---

## Scenario 4 — `--privileged` container on a shared box

**Symptom.** A CI job "needs" `docker run --privileged` (or a k8s Pod
with `securityContext.privileged: true`) to build images / run tests.

**What `--privileged` actually removes.** All capability drops, the
seccomp filter, the AppArmor/SELinux confinement, and the masked
`/proc` and `/sys` paths. The container can now load kernel modules,
write raw disks, and `nsenter` the host. It is a host root shell with
extra steps.

**Replace it with the specific thing needed.**
| "needs privileged" for… | give instead |
|---|---|
| building images | rootless buildkit / kaniko / `buildah` unshare |
| `mount` in tests | `--cap-add SYS_ADMIN` + a userns, or a VM runner |
| FUSE | `--device /dev/fuse --cap-add SYS_ADMIN` |
| raw packets | `--cap-add NET_RAW NET_ADMIN` |
| perf/eBPF | `--cap-add BPF PERFMON SYS_PTRACE`, `--security-opt seccomp=unconfined` for that job only |

Isolate the privileged workload onto a dedicated, disposable runner
pool, never the shared login/build node.

---

## Scenario 5 — Integrity: proving the node runs what you shipped

**Requirement.** An accreditor (Module 3) asks you to demonstrate that
compute nodes cannot run unsigned kernel code and that critical binaries
are unmodified.

**Stack.**
- **Secure Boot** on; shim + vendor cert or your own MOK.
- `CONFIG_MODULE_SIG_FORCE=y` and `lockdown=integrity` on the kernel
  cmdline — even root can't `insmod` an unsigned module or `kexec` an
  unsigned kernel.
- **IMA measurement** (`ima_policy=tcb`) extends PCR 10 with the hash of
  every executed file; **IMA appraisal** (`ima_appraise=enforce`) blocks
  execution of files without a valid signed `security.ima` xattr.
- **Remote attestation**: the node's TPM quote (PCRs + a nonce) is
  verified by an attestation server before it's handed a Slurm auth
  token / storage mount / secret (ties into Module 15's key release).

**Operational cost.** Every package update must re-sign IMA xattrs
(`evmctl`) as part of the image build (Module 7); an emergency
hand-patch on a node breaks appraisal and the node must be reimaged, by
design.

---

## Costs and limits (the honest part)

- **SELinux has a learning cost.** Teams that don't invest end up at
  `setenforce 0`, which is worse than never having enabled it (false
  sense of coverage). AppArmor is a pragmatic middle ground.
- **seccomp is per-thread and one-way.** You can only *narrow* the
  filter; a wrong allowlist is a production incident, so stage it with
  `ERRNO`+logging first.
- **`NoNewPrivileges` breaks legitimate setuid helpers** (`ping` on old
  distros, `sudo` from within the unit) — know what your service execs.
- **User namespaces are double-edged** — great for rootless containers,
  historically a top LPE source; many hardened hosts disable unprivileged
  userns and accept the container-usability hit.
- **Integrity enforcement makes nodes immutable in practice** — which is
  the goal, but it means your provisioning pipeline (Module 7) is now
  security-critical.

---

## Quick reference

```bash
getenforce ; sestatus ; ps -eZ | grep <svc>
ausearch -m avc,user_avc,selinux_err -ts recent ; sealert -a /var/log/audit/audit.log
semanage fcontext -l | grep <path> ; matchpathcon <path> ; restorecon -Rv <path>
getsebool -a | grep <svc> ; setsebool -P <bool> on
getcap -r / 2>/dev/null ; getpcaps <pid> ; capsh --print
systemd-analyze security <unit>            # ranks a unit's sandboxing 0-10
grep -E 'Seccomp|CapEff|NoNewPrivs' /proc/<pid>/status
aa-status ; aa-genprof /usr/bin/<app> ; aa-logprof
cat /sys/kernel/security/lockdown ; mokutil --sb-state
ima-evm-utils: evmctl ima_verify <file> ; cat /sys/kernel/security/ima/ascii_runtime_measurements
```
