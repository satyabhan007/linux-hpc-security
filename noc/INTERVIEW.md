# NOC & Incident Command — Interview Q&A

---

## Signals & monitoring

**Q: Name the four golden signals.**
Latency, traffic, errors, saturation. (Google SRE, per user-facing
service.)

**Q: USE vs RED vs golden signals?**
USE (per resource): Utilization, Saturation, Errors. RED (per service):
Rate, Errors, Duration. Golden signals (per service): latency, traffic,
errors, saturation. RED's duration≈latency, RED's errors≈golden errors —
they overlap by design; use USE for resources, RED/golden for services.

**Q: Symptom-based vs cause-based alerting — which and why?**
Page on symptoms (user-visible: error rate, p99, failed transactions).
Cause/predictor signals like saturation get a ticket/warning because
they lead the symptom and give you time to act before it becomes an
incident.

**Q: What is saturation, and why alert on it differently?**
How "full" a resource is — CPU near 100%, a growing queue, a rising
run-queue, disk near full. It's a leading indicator, so it's a warning
that buys lead time, not a page.

**Q: Latency SLIs — why report percentiles not the mean?**
The mean hides the tail. Users feel p95/p99. A p50 of 40ms with a p99 of
3s is a bad experience for 1 in 100 requests; the mean might look fine.

**Q: White-box vs black-box monitoring?**
White-box: internal metrics/logs/traces (why it's failing). Black-box:
external probes of the user-visible behavior (that it's failing, as a
user sees it). You need both; black-box catches things white-box
misses (DNS, LB, cert).

---

## SLOs & error budgets

**Q: SLI vs SLO vs SLA?**
SLI: the measured indicator (success rate). SLO: the internal target
(99.9% over 30d). SLA: the contractual promise to customers, with
penalties, usually looser than the SLO.

**Q: What is an error budget?**
`1 − SLO` expressed as allowed failure. 99.9% over 30 days ⇒ 0.1% ⇒
~43 minutes/month of permitted badness. It's the currency you spend on
risk (deploys, experiments, incidents).

**Q: What is burn rate?**
The rate you're consuming the error budget relative to steady state.
1.0 = on pace to exhaust it exactly at the window's end. 14.4× exhausts
a 30-day budget in ~50 hours.

**Q: Explain multi-window multi-burn-rate alerting.**
Require both a short window (still happening now?) and a long window
(real, not a blip?) to exceed the burn threshold. Fast+high → page;
slower+lower → ticket. Kills flapping and transient spikes while still
catching sustained burns quickly.

**Q: What's an error budget policy?**
A pre-agreed rule: when the budget is exhausted, feature releases pause
and reliability work is prioritized until it recovers. Makes the
velocity/reliability trade explicit.

**Q: 100% availability — why is it the wrong target?**
It's unachievable, infinitely expensive, and removes the budget you need
to ship changes. The right SLO is "reliable enough that users don't
notice, with budget left to move fast".

---

## On-call

**Q: What makes a healthy on-call rotation?**
1 week in ≥4, real handoff (open issues, risks, recent deploys),
primary+secondary, every alert linked to a runbook, and a tracked
"pages per shift" metric driven down. Comp/time-off for the burden.

**Q: An alert that isn't actionable — what do you do with it?**
Demote it: dashboard-only, or a ticket, or re-scope it to alert on a
rate/trend that *is* actionable. Every page must be urgent, actionable,
and real.

**Q: What is a runbook and what's in it?**
Per-alert doc: what it means, how to confirm it's real, first
mitigations to try, how to escalate, and links to dashboards/queries.
Enables the on-call to act without tribal knowledge.

---

## Incident command

**Q: Name the incident-command roles and the key rule.**
Incident Commander (decides, coordinates, communicates — does NOT
debug), Ops/Tech lead (investigates and fixes), Comms lead
(stakeholders + status page), Scribe (timestamps everything). Key rule:
different people, and the IC stays out of the debugger.

**Q: How do you set SEV level?**
Impact × scope. SEV1: major outage or data loss (all-hands, exec
comms). SEV2: significant degradation. SEV3: minor/single feature.
SEV4: cosmetic. The SEV drives response size, comms cadence, and
escalation SLA.

**Q: MTTD / MTTA / MTTM / MTTR — define each.**
Mean time to Detect (from onset to first alert/notice), Acknowledge
(alert to a human owning it), Mitigate (to stopping user impact),
Resolve/Recover (to fully fixed).

**Q: Which MTT* metric do teams usually neglect, and why does it
matter?**
MTTD. You can't acknowledge or mitigate what you haven't detected;
shaving detection time reduces every downstream metric. Better
alerting/monitoring often beats a faster response process.

**Q: What is a blameless postmortem and why "blameless"?**
A structured review: timeline, contributing factors (plural), what went
well, action items with owners/dates. Blameless because people acting
reasonably on available information is a systems failure; blame drives
concealment and kills the learning.

**Q: "Root cause" — what's wrong with that phrase?**
Complex-system failures have multiple contributing factors, not one root
cause. Stopping at "someone pushed a bad change" ignores the missing
staging gate, the missing canary, the missing alert, and the slow
rollback — all of which are the real fixes.

**Q: What is a status page and when do you update it?**
A public/customer-facing incident communication channel. For SEV1/2,
post within ~10 minutes of declaring and update on a fixed cadence
(e.g. every 30 min) even if the update is "still investigating".

---

## Cross-cutting

**Q: How does the NOC/SRE side relate to the SOC side (Module 17)?**
Same incident-command structure, same MTT* metrics, same
symptom-vs-cause alerting discipline — one is optimizing for
availability/performance, the other for security detection/response.
Many orgs run a combined "fusion" center.

**Q: A chaos experiment (Module 20) disproved a resilience hypothesis.
What should the NOC also check?**
That the failure produced an alert (and it paged the right rotation),
that the runbook worked, and that MTTD for that failure class is
acceptable — the experiment tests detection and response, not just the
system.
