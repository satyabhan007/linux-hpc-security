# NOC & Incident Command — The Amateur's Guide

> A car dashboard has ~6 gauges, not a readout for every bolt. Speed,
> fuel, temp, oil, RPM, warning light. You drive on those; the mechanic
> reads the rest *after* the light comes on.

---

## 1. What a NOC does

A **Network/Operations Center** watches availability and performance and
**drives incidents to resolution**. Modern practice folds this into
**SRE** (Site Reliability Engineering). The instrument is a small set of
**symptom** signals, not a wall of host graphs.

---

## 2. The signal frameworks

| Framework | Scope | Signals |
|---|---|---|
| **Four Golden Signals** (Google SRE) | per user-facing service | latency, traffic, errors, saturation |
| **USE** (Brendan Gregg) | per resource (CPU, disk, NIC) | Utilization, Saturation, Errors |
| **RED** (Tom Wilkie) | per request-driven service | Rate, Errors, Duration |

They overlap on purpose. RED "duration" ≈ golden "latency"; RED
"errors" ≈ golden "errors". Pick one per layer and be consistent.

---

## 3. Page on symptoms, not causes

- **Symptom**: user-visible. Error rate up, p99 latency past the SLO,
  checkout failing. → **page someone.**
- **Cause / predictor**: saturation — CPU near 100%, a queue filling, a
  run-queue climbing, disk 95% full. → **ticket / warning.**

Saturation usually **leads** the symptom by minutes. That lead time is
your window to autoscale, shed load, or fail over *before* users notice.
Paging on saturation directly means waking people for something that
isn't an incident yet.

"The site got slow, then threw errors, then recovered when they added
servers" = saturation → latency → errors → mitigation, in that order,
every time. (Lab: `step1_golden_signals.py`.)

---

## 4. SLOs and error budgets

- **SLI** — a measured number: success rate, p99 latency.
- **SLO** — the target: "99.9% of requests succeed over 30 days".
- **Error budget** — what's left: `1 − SLO`. 0.1% of 30 days ≈
  **43 minutes** of allowed badness a month.
- **Burn rate** — how fast you're spending it. `1.0` = exactly on pace
  to use it all in the window. `14.4` = you'll burn the whole month's
  budget in ~50 hours.

**Multi-window multi-burn-rate alerting** (Google SRE): a **short**
window ("is it still happening right now?") and a **long** window ("is
it real, not a blip?") must **both** exceed the threshold.

```
PAGE   if 1h burn ≥ 14.4  AND  5m burn ≥ 14.4    (2% of budget in an hour)
PAGE   if 6h burn ≥ 6     AND  30m burn ≥ 6      (5% in 6h)
TICKET if 24h burn ≥ 3    AND  2h burn ≥ 3       (10% in a day)
TICKET if 72h burn ≥ 1    AND  6h burn ≥ 1
```

This pages on a sustained 20× burn, tickets on chronic low-grade burn,
and **ignores a 40-second spike** — because the long window stays calm.
(Lab: `step2_error_budget.py`.)

**Error budget policy:** when the budget is spent, feature work pauses
and reliability work takes priority until it recovers. Velocity and
reliability trade **explicitly**, not by argument in a meeting.

---

## 5. On-call

- **Rotation**: 1 week in N (N ≥ 4 is humane), with a real **handoff**
  (open incidents, known risks, what's deployed).
- **Primary + secondary**: secondary is paged if primary doesn't ack in
  X minutes.
- **Runbooks**: every alert links to "what this means, how to confirm,
  first three things to try, who to escalate to".
- **Paging hygiene**: if an alert isn't actionable, it shouldn't page.
  Track "pages per on-call shift" and drive it down.

---

## 6. Incident Command (borrowed from wildfire response)

When it's a real incident, structure beats heroics. Roles, held by
**different people**:

| Role | Does | Does NOT |
|---|---|---|
| **Incident Commander (IC)** | decides, prioritizes, delegates, runs the call | debug |
| **Ops / Tech lead** | actually investigates and applies fixes | talk to stakeholders |
| **Comms lead** | status page, exec updates, customer comms | debug |
| **Scribe** | timestamps every action and decision in the incident doc | — |

**SEV levels** from impact × scope: **SEV1** = major outage / data loss
(all hands, exec comms), **SEV2** = significant degradation, **SEV3** =
minor / single feature, **SEV4** = cosmetic. The SEV sets the response,
the comms cadence, and the escalation SLA.

**Analogy — a film set.** The director (IC) does not operate the camera.
If the person calling the shots has their head in a debugger, nobody is
calling the shots.

(Lab: `step3_incident_timeline.py`.)

---

## 7. The blameless postmortem

After every SEV1/SEV2 (and near-misses worth learning from): a document
with the **timeline**, **contributing factors** (plural — there's never
one cause), **what went well**, **what was lucky**, and **action items
with owners and due dates**.

**Blameless** because a human acting reasonably on the information they
had is a *systems* problem. Punishing people just buys silence and
hidden risk. The output is fixes, not blame.

---

## 8. Run the labs

```bash
python3 noc/step1_golden_signals.py     # signals light up cause -> symptom; alert policy
python3 noc/step2_error_budget.py       # burn-rate alerting: page / ticket / ignore
python3 noc/step3_incident_timeline.py  # SEV classification, MTT* metrics, escalation
```

Next: **`splunk/`** — the query layer under most of these dashboards and
alerts.
