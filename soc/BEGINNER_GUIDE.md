# SOC Operations & Detection Engineering — The Amateur's Guide

> A hospital emergency department. Everyone who walks in gets a quick
> triage score; the chest-pain case jumps the queue; the sprained wrist
> waits. You do not treat patients in arrival order, and you do not treat
> everyone.

---

## 1. What a SOC is

A **Security Operations Center** is people + process + tooling that
**detects, triages, and responds** to security events, usually 24/7. The
unit of work is the **alert**. The core skill is deciding, fast, which
alerts are real and which are noise — because there are always far more
alerts than analysts.

Inputs: a SIEM (Module 19), EDR, network sensors, cloud logs, identity
logs, threat intel. Outputs: closed alerts, escalated incidents, new
detections, and metrics.

---

## 2. The tiers (and why capacity is finite)

| Tier | Job |
|---|---|
| **T1 — triage** | first look at every alert; close the obvious false positives, escalate the rest, follow a playbook |
| **T2 — investigation** | scope the incident: pivot across logs, build a timeline, decide impact, contain |
| **T3 — threat hunting / detection engineering** | proactively hunt for what no rule caught; write and tune detections |
| **IR / IC** | run the major incidents (Module 18) |

A T1 analyst realistically clears **~40 alerts per shift**. So a queue of
400 is not "hire 10 people" — it is a **tuning** problem. (Lab:
`step3_triage_queue.py` shows the queue math.)

---

## 3. Triage: score, then work the score

You do not work the queue top to bottom. Each alert gets a priority:

```
priority = severity  ×  asset_criticality  ×  confidence  ×  fidelity
```

- **severity** — how bad if true (critical/high/medium/low)
- **asset_criticality** — a domain controller vs a test VM
- **confidence** — how sure is this specific alert
- **fidelity** — the rule's historical true-positive rate (1 − FP rate)

Each severity has an **SLA** (critical: minutes; low: a day). An unacked
critical past its SLA auto-escalates. Low-fidelity, low-asset noise
sinks below the line and is auto-closed or never reaches a human —
**that is the point of scoring.**

---

## 4. Detection engineering: detections are code

A **detection** is a filter over an event stream, written from a
**hypothesis** ("an attacker dumping LSASS opens a handle to
`lsass.exe` with `PROCESS_VM_READ`"), version-controlled, and **tested**
against both attack data and benign data.

Every rule has a threshold, and there is **no threshold that catches
everything**:

```
precision = TP / (TP + FP)     "of my alerts, how many were real?"
recall    = TP / (TP + FN)     "of the real attacks, how many did I catch?"

threshold ↓  →  recall ↑, precision ↓  →  analyst burnout
threshold ↑  →  precision ↑, recall ↓  →  missed intrusions
```

You tune to the point where **fidelity is high enough that analysts
trust the queue** and recall is high enough to catch what matters.
(Lab: `step1_detection_precision.py` sweeps the threshold.)

**Analogy — a smoke detector.** Too sensitive and every piece of toast
sets it off, so you take the battery out (and sleep through the real
fire). Too insensitive and it never triggers. The setting that keeps the
battery in is the useful one.

---

## 5. Coverage is a matrix, not a count

"We have 400 detections" is vanity. The real question: **which
[MITRE ATT&CK](https://attack.mitre.org/) tactics and techniques can we
actually see**, weighted by how often adversaries use them?

Map every detection to a technique, build the matrix, and the blind
spots become a prioritized backlog:

```
initial-access   ██░░░░░░  25%   ← phishing (prevalence 10/10) has NO detection
execution        ████████ 100%
priv-esc         ░░░░░░░░   0%   ← nothing here at all
...
```

(Lab: `step2_attack_coverage.py`.)

---

## 6. SOAR: automate the rote, not the judgment

**SOAR** (Security Orchestration, Automation and Response) runs
**playbooks**: on a phishing alert → detonate the URL in a sandbox,
check who else received it, pull the message from all mailboxes, block
the sender, enrich the sender IP, open the ticket. The analyst arrives
to a decision, not a checklist.

Automate: enrichment, containment of reversible actions, ticket hygiene.
Keep a human in the loop for: anything irreversible, anything
high-blast-radius (disabling a service account, isolating a production
host).

---

## 7. The metrics that matter

| Metric | Meaning |
|---|---|
| **MTTD** | mean time to detect — the dwell time you are giving attackers |
| **MTTR** | mean time to respond / contain |
| **FP rate per rule** | a rule over ~5% FP gets ignored — tune or retire it |
| **coverage trend** | is the ATT&CK matrix getting greener month over month |
| **alert-to-incident ratio** | how much noise per real thing |

> **Alert fatigue** is the killer. A noisy rule trains analysts to
> batch-close without looking, and the one real alert dies in the
> batch-close. The Target 2013 breach: the tools *did* alert. Nobody
> acted. Detection without tuned fidelity and a response process is
> theater.

---

## 8. Run the labs

```bash
python3 soc/step1_detection_precision.py   # precision/recall/alert-fatigue, swept
python3 soc/step2_attack_coverage.py       # weighted ATT&CK coverage matrix + gaps
python3 soc/step3_triage_queue.py          # priority scoring + SLA + queue math
```

Next: **`noc/`** — the sibling discipline for availability, and the
incident-command structure both share.
