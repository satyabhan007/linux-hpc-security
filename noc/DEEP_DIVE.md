# NOC & Incident Command — Deep Dive: Production Scenarios

---

## Scenario 1 — On-call is drowning in non-actionable pages

**Symptom.** Primary on-call gets 30–60 pages a week. Most are "disk at
80%", "CPU spike", "pod restarted", "latency blip". Burnout, and real
pages get missed in the noise.

**Fix — an alerting audit.** For every alerting rule ask:
1. Is it a **symptom** (user impact) or a **cause/predictor**?
2. Is it **actionable right now** by the person paged?
3. What's the **false-page rate**?

**Actions.**
- Cause/predictor alerts (`disk > 80%`, `CPU > 90%`) → **tickets**, or
  page only on a *fast burn toward* exhaustion (`disk will be full in
  < 4h at current rate`).
- Non-actionable ("pod restarted" once, and recovered) → dashboard only,
  or alert on `restart rate > N/10min`.
- Symptom alerts → keep, but move to **multi-window burn rate** so a
  30-second blip doesn't page.
- Publish "pages per shift" as a team metric; target < 2.

**Rule of thumb:** every page must be *urgent*, *actionable*, and *real*.
If it's missing one, it's a ticket or a dashboard.

---

## Scenario 2 — SLO breach: is it a page or not?

**Setup.** Checkout service SLO: 99.9% success over 30 days → 43.2
bad-minutes budget. Current spend this month: 18 min.

**Event A — a deploy causes 8% errors, sustained.**
Burn rate = 0.08 / 0.001 = **80×**. 5-min window: 80×. 1-hour window
(20 min in): ~27×. Both ≫ 14.4 → **PAGE**. Budget gone in ~9 hours at
this rate → roll back now.

**Event B — a dependency blips, 25% errors for 45 seconds.**
5-min window: burn ~15×. 1-hour window: ~0.9× (45s of 3600s). Long
window is calm → **no page**. It self-corrected; a ticket to
investigate is enough.

**Event C — chronic 0.35% errors for days** (a slow memory leak, a bad
edge node).
Burn ~3.5×, sustained across 2h and 24h → **TICKET** (not a 3am page),
but it *is* eating budget — ~200 hours to exhaustion. Fix in business
hours before the budget runs out.

(Lab: `step2_error_budget.py` runs exactly these.)

---

## Scenario 3 — A SEV1 with no incident command

**What happened.** Payments down. Eight engineers in a Slack channel,
all typing `kubectl` commands, three different theories, someone
restarts the DB "to be safe" and loses the in-flight transaction log.
No one told support; customers flooded Twitter; an exec DMs the CTO for
status and gets three contradictory answers.

**What ICS would have given it.**
- **IC declared** in the first 5 minutes (rotating role, anyone can
  declare). IC says: "one person changes things at a time; propose in
  channel, I approve."
- **Ops lead** owns the investigation; everyone else feeds them info or
  stands by.
- **Comms lead** posts to the status page within 10 min and updates
  every 30, handles the exec.
- **Scribe** timestamps: `14:03 DB CPU 100%`, `14:11 rolled back deploy
  X`, `14:19 error rate falling`.
- Nobody restarts anything without IC sign-off → the transaction log
  survives.

**Adopt:** a one-page incident runbook, a `/incident` bot that spins up
the channel + doc + roles, and quarterly IC training so the role isn't
scary.

---

## Scenario 4 — The postmortem that named a person

**Draft 1 conclusion:** "Root cause: engineer X pushed a config change
without testing."

**Why that's wrong and harmful.**
- It's not *the* root cause — it's the last hop. Why did an untested
  config reach prod? No staging gate. Why did it take 40 min to detect?
  No alert on that error class. Why did rollback take 25 min? Manual,
  undocumented.
- Naming X guarantees the next person hides their mistake, and you lose
  the early-warning that honesty provides.

**Blameless rewrite — contributing factors:**
1. CI didn't validate the config schema (X's change was syntactically
   valid but semantically wrong).
2. No canary for config changes — it went to 100% at once.
3. The resulting error was logged but had no alert.
4. Rollback was a manual runbook, not a button.

**Action items (owner, date):** schema validation in CI (team A, 2wk);
config canary (team A, 1mo); alert on `config_parse_error` (team B, 1wk);
one-command rollback (team B, 2wk).

---

## Scenario 5 — MTTD is the hidden problem

**Data from the last 10 incidents:**
```
              MTTD    MTTA    MTTM    MTTR
mean          38 min   4 min   22 min  95 min
```

MTTA and MTTM are fine — the team responds well. **MTTD of 38 minutes**
means every incident ran unnoticed for over half an hour. Cutting MTTD
to 5 minutes would shave ~33 min off every incident — more than any
response improvement.

**Where MTTD hides:**
- Alerting on causes, not symptoms (the user-facing failure had no
  direct alert).
- Thresholds too loose ("errors > 5%" when 1% is already an incident).
- Synthetic monitoring gaps (no probe for the actual user journey).
- Alert routing: it fired into a channel nobody watches at 2am instead
  of paging.

**Better detection often beats faster response.** Invest there first.

---

## A minimal incident runbook

```
DECLARE
  Anyone can declare an incident. Post in #incidents: "Declaring SEV<n>: <one line>".
  First responder is IC until they hand off.

ROLES (assign in the channel, pin the message)
  IC:      _____   (decides, does not debug)
  Ops:     _____   (investigates, applies fixes — one change at a time, IC approves)
  Comms:   _____   (status page + stakeholders; update cadence: SEV1 30m, SEV2 60m)
  Scribe:  _____   (timestamps every action in the incident doc)

DURING
  - One change at a time. Propose -> IC approves -> Ops executes -> Scribe logs.
  - No irreversible actions (DB restart, data delete) without IC sign-off.
  - Status page updated within 10 min for SEV1/2.

RESOLVE
  - IC declares resolved when the SLI is back to steady state and holding.
  - Schedule the blameless postmortem before leaving the call (SEV1/2).
```
