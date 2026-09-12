# Postmortem: <incident title>

Matches learn5 Ch 14 (postmortems for infrastructure incidents). Copy this
file per incident; do not edit the template in place.

| Field           | Value |
|-----------------|-------|
| Status          | draft / in review / final |
| Date            | YYYY-MM-DD |
| Authors         | |
| Severity        | SEV1 / SEV2 / SEV3 / SEV4 (see learn5 Ch 10) |
| Duration        | start – end (UTC) |
| Incident Commander | |
| Postmortem owner | |

## Summary

One paragraph: what broke, for how long, and who/what was affected. Write
this last, after the timeline and root cause are done — it is easier to
summarize accurately once the full story is reconstructed.

## Impact

- User/customer-visible impact (be specific: % of requests, which
  service, which region)
- SLO/error-budget impact (tie to a specific Ch 7 burn-rate number if one
  fired — see `burn_rate_alert.yml` in this directory for the alert shape
  that should have paged)
- Any data loss, security exposure, or compliance impact

## Timeline

Build this from **logs, alert-fire timestamps, and chat history** — not
from memory. Per Ch 14, L3 Scenario B: participants' recollection of a
high-stress incident is frequently inconsistent; timestamped evidence is
not.

| Time (UTC) | Event |
|------------|-------|
| 00:00 | (example) OSS node begins showing elevated I/O latency |
| 00:14 | Scheduler starts timing out job submissions |
| 00:31 | `ErrorBudgetFastBurn` pages primary on-call |
| 00:40 | Incident commander assigned, bridge opened |
| ... | ... |
| 02:15 | Service restored |

## Root cause (5 whys)

Do not stop at the first symptom. Per Ch 14, L2: "OOM killed" is a
symptom, not a root cause — keep asking why until you reach an actual
systemic or organizational gap.

1. Why did [symptom] happen? →
2. Why did [answer 1] happen? →
3. Why did [answer 2] happen? →
4. Why did [answer 3] happen? →
5. Why did [answer 4] happen? → **(this is usually the actual root cause)**

## What went well

- ...

## What went poorly

- ...

## Where we got lucky

- ...

## Action items

Every item needs a named **owner** and a **due date** — per Ch 14, L4: "an
action item with neither is a wish, not a commitment." Per learn5 Ch 16,
point each item at the specific platform layer it should change (a new
detector, a revised SLO, a new chaos experiment) so the loop actually
closes instead of the postmortem becoming a standalone document.

| Action item | Owner | Due date | Status | Links to |
|-------------|-------|----------|--------|----------|
| (example) Add a rolling-baseline latency detector for every OSS node | storage-team | 2 weeks | open | `../observability/alerts.rules.yml` (`LustreOSTLatencyDrift`) |
| (example) Add a scheduler health check independent of job outcomes | scheduling-team | 4 weeks | open | |
| (example) Add a chaos experiment simulating slow degradation | sre-team | next quarter | open | `../chaos-engineering/` |

## Blameless statement

This postmortem exists to fix the systems and processes that allowed this
incident to happen, not to evaluate the performance of the individuals
involved. If this document reads as assigning blame to a person, it has
failed at its actual purpose — flag it for a rewrite.
