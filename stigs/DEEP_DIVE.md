# STIGs & Compliance — Deep Dive: Production Scenarios

---

## Scenario 1 — Audit in three weeks, last scan was "sometime last year"

**Situation.** An assessor is booked. The team has 40 RHEL 8/9 hosts,
mixed patch levels, no current scan data, and a vague memory that "most
of it was done".

**Playbook.**
1. **Baseline everyone.** Push `scap-security-guide` + `openscap-scanner`
   via Ansible, run `oscap xccdf eval --profile stig` on every host,
   collect `results.xml` + `report.html` to a central store.
2. **Roll up.** Parse all results: per-host and fleet-wide CAT I / II /
   III pass counts and overall %. (Lab: `step2_severity_rollup.py`.)
3. **Triage.** Fix *all* open CAT I first — there should be zero.
   Batch the common CAT II failures (they repeat across hosts).
4. **Remediate in waves** (Module 6): `oscap xccdf generate fix`,
   `--check` diff, canary, roll. Re-scan after each wave.
5. **Document the rest** as POA&Ms with compensating controls and dates.
6. **Freeze + evidence.** Snapshot final scans with timestamps; that's
   the assessor's package.

**What "ready" looks like:** 0 open CAT I, CAT II trending to zero with
POA&Ms, overall ≥ the contract floor (often 90–95%), evidence dated.

---

## Scenario 2 — Auto-remediation locked everyone out of SSH

**What happened.** A junior engineer ran the generated `remediate.yml`
without `--check`. It applied `sshd_config` rules that: set
`AllowGroups` to a group that didn't exist, enabled
`AuthenticationMethods publickey,keyboard-interactive` with no OTP
configured, and set `PermitRootLogin no`. Next `sshd` reload → nobody
can log in. The box had no console.

**Recovery.** Out-of-band: IPMI SOL / iDRAC / iLO virtual console, single
-user mode, revert `/etc/ssh/sshd_config` from the pre-change backup the
remediation *should* have taken.

**Prevention (permanent).**
- `sshd` changes always through a handler that runs `sshd -t` **before**
  reload; never `restart` a broken config.
- Remediation runs `--check --diff` in CI; a human approves the diff.
- Keep a break-glass local account + console access documented.
- Split the SSH ruleset into its own tagged play, canary-only until
  verified.

---

## Scenario 3 — FIPS mode "can't be enabled"

**Symptom.** The STIG requires FIPS 140 mode. `fips-mode-setup --enable`
on a running RHEL host → reboots into emergency mode, or SSH breaks, or
the node won't PXE-boot.

**Why.** FIPS must be established **at install time** so the initramfs,
the crypto policy, and the kernel are consistent from first boot.
Retrofitting on a system with non-FIPS artifacts (old SSH host keys,
`MD5` in a config, a non-compliant bootloader hash) fails.

**Fix.**
- Kickstart / image build with `fips=1` on the kernel line and
  `--fips` (or `fips-mode-setup --enable` as the *last* build step
  before the image is sealed).
- Regenerate SSH host keys, set `update-crypto-policies --set FIPS`.
- Validate in the Warewulf image pipeline (Module 7): a node that boots
  the image and passes `fips-mode-setup --check` + the STIG scan.
- Node cmdline needs `fips=1` and `boot=UUID=...` so the initramfs can
  integrity-check `/boot`.

---

## Scenario 4 — STIG vs vendor vs local policy contradict each other

**Example conflicts.**
- STIG wants `umask 077`; a shared-project workflow needs `002` +
  setgid dirs.
- STIG wants `nodev,nosuid,noexec` on `/tmp`; Spack/EasyBuild and MPI
  need `exec` on compute nodes (Module 11).
- STIG wants `kernel.unprivileged_userns_clone=0`; Apptainer rootless
  needs it `1` on compute.
- A storage vendor requires a specific `sysctl` the STIG forbids.

**Resolution.** A documented **precedence order** (e.g. "STIG > vendor
hard-requirement > local convenience, with named exceptions"), each
deviation in a POA&M or tailoring file with a technical justification
and a compensating control. Different node *roles* (login vs compute vs
storage) can carry different tailoring files.

---

## Scenario 5 — Container images fail the host STIG

**Symptom.** Someone scanned a running Apptainer/OCI container with the
RHEL host profile. Hundreds of "failures": no `auditd`, no `firewalld`,
no `chronyd`, no bootloader.

**Fix.** Containers are scanned against **application/container**
content, not the host OS STIG (a container has no kernel, no bootloader,
no init to harden). Use the relevant container STIG / CIS Docker
benchmark, scan the **image** in CI (`oscap-podman` / a build-time
scan), and maintain a trusted, minimal, scanned base image that all
node and job images derive from.

---

## Keeping an accredited system compliant (day 2)

```
CI pipeline (per image build)
  ├─ build node image with SSG hardening role applied
  ├─ boot image in a container / VM
  ├─ oscap xccdf eval --profile stig  → fail build on any NEW CAT I
  ├─ diff findings vs last known-good → PR comment
  └─ publish results.xml as a build artifact (evidence)

Scheduled (nightly, all live nodes)
  ├─ oscap scan → central store
  ├─ dashboard: per-node %, CAT counts, accepted POA&Ms
  └─ alert on: any open CAT I, overall % drop > 2pp, a new failing rule

Change control
  └─ any /etc change lands via the Ansible repo → PR → CI re-scan
```

The team that dreads audits scans by hand the week before. The team
that doesn't has had "RHEL9 STIG: 96.4%, 0 CAT I, 11 POA&Ms" on a
screen every day for a year.
