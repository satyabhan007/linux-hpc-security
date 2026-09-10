# Red Team / Blue Team / Purple Team — The Amateur's Guide

> A pentest is a home inspector listing every unlocked window. A red
> team is someone who actually breaks in, lives in your attic for a
> week, and sees whether you ever notice.

---

## 1. The teams

| Team | Job |
|---|---|
| **Red** | emulate a real adversary end-to-end to test whether detection + response actually work |
| **Blue** | the defenders — SOC (Module 17), detection engineering, IR, hardening |
| **Purple** | the *loop*: red and blue working together so every emulated attack produces a measured detection improvement |

**Red team ≠ pentest.** A pentest enumerates *vulnerabilities* in a
scoped target. A red team runs a *campaign* — objectives, stealth, rules
of engagement — and the deliverable is "we reached your crown jewels in
6 days; you detected us on day 5 at the exfil stage — too late", plus
the specific gaps that let it happen.

---

## 2. The intrusion lifecycle (the kill chain / ATT&CK tactics)

```
recon → initial-access → execution → persistence → priv-esc →
defense-evasion → cred-access → discovery → lateral-movement →
collection → command-&-control → exfiltration → impact
```

What matters to the defender is **at which stage you first detect it**:

- Detect at **execution** → the attacker loses the whole campaign.
- Detect at **exfiltration / impact** → the data is already gone; you're
  doing incident response, not defense.

**Dwell time** = the number of stages the attacker completed before your
first alert. Lower is everything. (Lab: `step1_killchain_coverage.py`.)

---

## 3. MITRE ATT&CK is the shared language

- **Tactic** — the goal (Persistence).
- **Technique** — how (T1053 Scheduled Task / Job).
- **Sub-technique** — a variant (T1053.005 Scheduled Task).
- **Procedure** — the exact way a specific actor does it.

Both teams map to it: red picks techniques to emulate; blue maps
detections to techniques and measures coverage.
**MITRE D3FEND** is the mirror — defensive countermeasures mapped to
ATT&CK.

---

## 4. Lateral movement is a graph search

Model the estate as a directed graph:
- **nodes** = hosts and identities
- **edges** = "the attacker on A can reach B" because of a cached
  credential, a local admin right, a service-account token, or an AD
  trust / delegation.

From a foothold, the **shortest path to Domain Admin** (or the crown
jewel) is what the attacker takes. This is exactly what **BloodHound**
computes — and the defensive use is running it *yourself*, then testing
which single control (tier-0 isolation, LAPS, killing a cached
credential, unique local admin passwords, removing unconstrained
delegation) **lengthens or severs** that path.

**Analogy — a city of doors.** Some are unlocked because a key was left
in a nearby drawer. The burglar walks the shortest chain of unlocked
doors to the vault. Find that chain first, and change one lock that's on
every route.

(Lab: `step2_lateral_movement.py`.)

---

## 5. Purple teaming: the feedback loop

The loop that makes red teaming actually pay off:

1. Red executes a **known** set of ATT&CK techniques, **in the open**,
   on a schedule.
2. For each: did an alert fire? How fast (MTTD)?
3. Output: a detection-coverage scorecard and a **ranked gap list**.
4. Build a detection for the top gap.
5. Re-run → prove coverage went up.
6. Repeat monthly. It is **never "done".**

Tools that let a small blue team do adversary emulation without a
dedicated red team: **Atomic Red Team**, **MITRE Caldera**, **Prelude**,
**Vectr** (for tracking the exercises). (Lab: `step3_purple_metrics.py`.)

---

## 6. Red-team craft (so blue can build detections for it)

- **OPSEC** — blend into normal activity: living-off-the-land binaries
  (`certutil`, `rundll32`, `wmic`, PowerShell), sleeping beacons with
  jitter, no noisy port scans, staged payloads.
- **C2** — command & control over normal-looking channels (HTTPS,
  DNS), redirectors, domain fronting, long callback intervals. Frameworks:
  Cobalt Strike (commercial), Sliver, Mythic, Havoc.
- **Rules of Engagement (ROE)** — scope, allowed techniques, blackout
  windows, no data destruction, and a **deconfliction line** so a real
  incident is not confused with the exercise (and vice versa).
- **Deliverable** — not "40 bugs" but the attack narrative, the detection
  gaps, dwell time, and prioritized fixes.

---

## 7. Assume breach

The mature end state: the perimeter **will** be crossed, so invest in
the detection and containment that decide whether a foothold becomes a
headline. Most incident reports don't say "they beat our firewall" —
they say "they were in for 200 days; tooling alerted on day 3 and nobody
acted; lateral movement to the DC took one cached credential." Every one
of those is a blue-team gap a purple exercise would have surfaced.

---

## 8. Run the labs

```bash
python3 redblue/step1_killchain_coverage.py  # first-detection stage + dwell time
python3 redblue/step2_lateral_movement.py    # shortest attack path + control ablation
python3 redblue/step3_purple_metrics.py      # the purple feedback loop, scored
```

That's the last module. Modules 17–21 are the **operations and
adversary** half; Modules 1–16 are what they run on and protect.
