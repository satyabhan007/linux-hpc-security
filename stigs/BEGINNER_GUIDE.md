# STIGs & Compliance Automation — The Amateur's Guide

> A STIG is a health-code inspection for a computer. CIS is the industry
> handbook you *choose* to follow; a STIG is the checklist you *must*
> pass to keep the doors open — item by item, with the grade posted in
> the window.

---

## 1. The vocabulary, decoded

| Term | Plain meaning |
|---|---|
| **STIG** | Security Technical Implementation Guide — DISA's exact config standard for one product (RHEL 9, RHEL 9 with GUI, Apache, PostgreSQL, Kubernetes…) |
| **SRG** | Security Requirements Guide — the generic parent a STIG specialises |
| **SCAP** | Security Content Automation Protocol — the machine-readable bundle of standards below |
| **XCCDF** | the checklist language: rules, groups, profiles, severities, fixes |
| **OVAL** | the *test* language: "here is exactly how to tell if the system complies" |
| **CCE / CCI** | identifiers linking a rule to a config item and to a NIST 800-53 control |
| **CAT I / II / III** | severity: directly exploitable / contributes / defense-in-depth |
| **Benchmark / Datastream** | the packaged content file (`ssg-rhel9-ds.xml`) |
| **Profile** | a named subset of rules (`stig`, `cui`, `ospp`, `pci-dss`, `cis`) |
| **Tailoring** | your local modifications to a profile, with justifications |
| **POA&M** | Plan of Action & Milestones — a documented, accepted deviation |
| **ATO / RMF / AO** | Authority to Operate / Risk Management Framework / Authorizing Official |
| **oscap** | the OpenSCAP scanner CLI |
| **SSG / ComplianceAsCode** | the open-source project that ships the content + remediations |

---

## 2. How the pieces fit

**Analogy — an exam.** XCCDF is the exam paper: the questions, the marks
per question, and which questions *this* candidate sits (the profile).
OVAL is the marking scheme: precisely what a correct answer looks like.
`oscap` is the invigilator who runs the exam and prints the grade sheet
(HTML report + machine-readable results XML).

```
Benchmark (XCCDF)
 ├─ Profile "stig"  ──selects──►  Rules
 │                                 ├─ severity: medium  → CAT II
 │                                 ├─ ident: CCI-000770 → NIST 800-53 AC-6(5)
 │                                 ├─ check ──► OVAL definition oval:ssg:def:1
 │                                 └─ fix (bash) / fix (ansible)
 └─ ...
OVAL definition
 └─ criteria (AND/OR) over OVAL tests
     └─ test binds an object (a file, a sysctl, an rpm) to a state (must equal X)
```

---

## 3. Running a scan

```bash
# what profiles does this content offer?
oscap info /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml

# scan against the STIG profile
oscap xccdf eval \
  --profile xccdf_org.ssgproject.content_profile_stig \
  --results /var/log/oscap/results.xml \
  --report  /var/log/oscap/report.html \
  --oval-results \
  /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml

# just the failures, as text
oscap xccdf eval --profile stig --results r.xml ... ; \
  xmlstarlet sel -t -m "//rule-result[result='fail']" -v ident -o '  ' -v idref -n r.xml
```

Result of each rule: `pass`, `fail`, `notapplicable`, `notchecked`,
`error`, `unknown`. Only `pass` and `fail` count toward the percentage.

---

## 4. Remediating — carefully

You do not hand-write fixes. **ComplianceAsCode / SCAP Security Guide**
ships remediation as **bash** and **Ansible** next to every rule.

```bash
# generate a targeted Ansible playbook from THIS scan's failures
oscap xccdf generate fix --fix-type ansible \
  --result-id "" /var/log/oscap/results.xml > remediate.yml

ansible-playbook -i inventory remediate.yml --check --diff   # dry run FIRST
```

> **Auto-remediation has bricked systems.** It has locked people out of
> SSH, broken `sudo`, killed FIPS boots, and made nodes un-provisionable.
> Always `--check` + diff, stage on a canary, keep a documented
> exception list, and never run "fix everything" blind.

---

## 5. Tailoring and POA&Ms

Real systems can't pass 100% unmodified. Two tools:

- **Tailoring file** — built with `scap-workbench` (GUI) or by hand;
  disables/modifies rules for your environment. Each change needs a
  justification. `oscap xccdf eval --tailoring-file tailoring.xml ...`
- **POA&M** — for what you *can't* fix: documented risk + compensating
  control + remediation date. The **Authorizing Official** accepts it as
  part of granting the **ATO** under the **RMF** process.

**Analogy — a building variance.** A building that can't meet a new fire
code everywhere files for a variance: "this stairwell is grandfathered,
we added sprinklers as a compensating control, full retrofit scheduled
Q3." The POA&M is that variance; the AO is the fire marshal who signs it.

---

## 6. Why one scan feeds many frameworks

Every STIG rule carries a **CCI**, which maps to a **NIST 800-53**
control. FedRAMP, CMMC, PCI-DSS, HIPAA all reference 800-53 (or map to
it). So a single OpenSCAP scan, tagged with control IDs, produces
evidence for several audits at once.

---

## 7. Run the labs

```bash
python3 stigs/step1_parse_xccdf.py      # parse rules, severities, profile selection
python3 stigs/step2_severity_rollup.py  # CAT I/II/III rollup + ATO-readiness verdict
python3 stigs/step3_oval_eval_sim.py    # a tiny OVAL boolean-tree evaluator
```

Compliance is a **pipeline property**: bake SSG hardening into the image
(Module 7), scan in CI, alert on drift. The audit is then just exporting
a dashboard that's been green for a year.
