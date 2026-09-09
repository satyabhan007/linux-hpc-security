# STIGs & Compliance — Interview Q&A

---

## Model & vocabulary

**Q: What is a STIG?**
DISA's Security Technical Implementation Guide — the exact configuration
standard for a specific product, required for that product to run on a
DoD network. A list of rules, each with a check and a fix.

**Q: STIG vs SRG?**
The SRG (Security Requirements Guide) is the technology-generic parent
(e.g. "General Purpose OS SRG"); a STIG is its product-specific
implementation (e.g. "RHEL 9 STIG").

**Q: What is SCAP and what does it contain?**
Security Content Automation Protocol — the interoperable bundle:
**XCCDF** (checklist), **OVAL** (tests), **CPE** (platform
identification), **CCE/CCI** (config + control identifiers), often
packaged as a single **datastream** file.

**Q: XCCDF vs OVAL — one sentence each.**
XCCDF structures the benchmark: rules, groups, profiles, severities,
fixes. OVAL is the low-level assertion each rule calls to decide
pass/fail against actual system state.

**Q: What is an OVAL definition made of?**
A boolean **criteria** tree (operator AND/OR, optional negate) over
**tests**; each test binds an **object** (a file line, a sysctl, an rpm,
a process) to a **state** it must match, with a check like
"all"/"at least one".

**Q: CAT I / II / III?**
Severity. CAT I = a weakness that directly and immediately allows
compromise. CAT II = contributes to it. CAT III = defense-in-depth /
hardening depth. Accreditors expect **zero open CAT I**.

**Q: What is a CCI?**
Control Correlation Identifier — links a STIG rule to a NIST 800-53
control statement, so findings roll up into RMF / FedRAMP / CMMC
reporting.

---

## Tooling

**Q: What does `oscap xccdf eval` do?**
Runs a chosen XCCDF profile against the local system, evaluating the
referenced OVAL, and emits machine-readable results (`--results`) and an
HTML report (`--report`).

**Q: Where does the content come from?**
`scap-security-guide` (SSG), built by the open-source
**ComplianceAsCode/content** project — ships XCCDF + OVAL + bash and
Ansible remediations for RHEL, Ubuntu, SLES, Fedora, and more.

**Q: How do you generate a remediation from a scan?**
`oscap xccdf generate fix --fix-type ansible --result-id "" results.xml
> remediate.yml`. Then run it with `--check --diff` before applying.

**Q: What is a tailoring file and how is it made?**
An XCCDF file that overlays a profile — disabling rules or changing
values for your environment. Built with `scap-workbench` or by hand;
applied via `--tailoring-file`.

**Q: Rule result values — which count toward the score?**
`pass`, `fail`, `error`, `unknown`, `notapplicable`, `notchecked`,
`fixed`. Only `pass` and `fail` are scored; NA/NC are excluded from the
percentage.

**Q: `oscap-podman` / `oscap-vm` — what for?**
Scan a container image or an offline VM image (mount and evaluate)
without running an agent inside it — used for build-time image scanning.

---

## Process (RMF / ATO)

**Q: What is a POA&M?**
Plan of Action & Milestones: a documented deviation — the finding, the
risk, a compensating control, and a remediation date — that the
Authorizing Official formally accepts.

**Q: A rule can't be met without breaking a required app. What do you do?**
Tailor it out (or change its parameter), document a POA&M with a
compensating control and milestone, and get AO sign-off. You do **not**
silently ignore it or disable the scanner.

**Q: Is a POA&M-covered CAT I an "open" CAT I?**
No. If the deviation is documented and AO-accepted with compensating
controls, it is a *managed* risk, not an open finding. An *un*documented
CAT I is what fails an assessment.

**Q: What is an ATO, and who grants it?**
Authority to Operate — the Authorizing Official's formal acceptance of
the system's residual risk, based on the assessment package (scans,
POA&Ms, SSP). Granted under the Risk Management Framework.

**Q: How do STIG findings relate to NIST 800-53?**
Each finding's CCI maps to one or more 800-53 controls. That mapping is
how a single scan produces evidence across FedRAMP, CMMC, PCI (which all
reference or map to 800-53).

---

## Practical / gotchas

**Q: Why must FIPS mode be enabled at install, not after?**
The initramfs, crypto policy, kernel, and existing key material must all
be FIPS-consistent from first boot. Retrofitting on a system with
non-compliant artifacts (old SSH host keys, non-FIPS hashes) breaks boot
or login.

**Q: You scanned a container with the host OS STIG and got hundreds of
fails. Why, and the fix?**
A container has no kernel/bootloader/init/auditd to harden. Use the
container-appropriate benchmark, scan the image in CI, and keep a
trusted minimal base image.

**Q: Common auto-remediation casualties?**
`sshd` lockouts (bad `AllowGroups`/`AuthenticationMethods`), broken
`sudo`, FIPS boot failures, `/tmp` `noexec` breaking builds/MPI, and
`pam` changes that lock local accounts. Always `--check` + canary.

**Q: How do you keep an accredited RHEL fleet compliant between audits?**
SSG hardening baked into the image, `oscap` in CI failing the build on
new CAT I, nightly drift scans against every node with alerting, and all
`/etc` changes through a reviewed IaC repo that re-scans.

**Q: A node dropped from 97% to 88% overnight. Where do you look?**
Diff last night's `results.xml` against the prior good one — a package
update reset a config (`sshd_config`, `pam`, a `sysctl` drop-in
overwritten), an admin made a manual change, or a new content version
added rules. The diff names the exact rules.

**Q: `notchecked` results — what causes them and do they matter?**
The rule requires input the scanner couldn't get (e.g. a manual check,
or a value the OVAL can't evaluate on this platform). They're excluded
from the score but an assessor may still want each addressed manually.
