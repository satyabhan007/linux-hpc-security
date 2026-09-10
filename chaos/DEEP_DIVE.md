# Chaos Engineering & Resilience — Deep Dive: Production Scenarios

---

## Scenario 1 — First GameDay: fail the primary database

**Hypothesis.** "If the primary Postgres fails, the replica is promoted
within 60s, the app reconnects, and checkout success rate stays above
99% (steady state)."

**Setup.**
- Blast radius: staging that mirrors prod topology first; then prod at
  **off-peak**, with the on-call + a DBA on the call.
- Steady state SLI: checkout success rate, measured every 15s.
- **Abort:** success rate < 95% for 60s, or promotion not complete in
  180s.
- Fault: `systemctl stop postgresql` on the primary (not `kill -9` —
  test a clean failure first, then the messy one later).

**What actually gets found (typical):**
- Promotion took 140s, not 60s — the failover tool's health check
  interval was 30s and it needed 3 misses. Steady state **disproved**
  (success dipped to 88% for ~2 min). *Action: tune the check; add
  connection retry with backoff in the app so a 140s gap degrades
  instead of erroring.*
- The app's connection pool cached the dead primary's IP for 5 minutes
  (DNS TTL). *Action: shorter TTL, or use the failover DNS/proxy.*
- The alert for "database primary down" fired — good — but into a
  channel, not a page. *Action: fix routing.*
- The runbook said "promote the replica manually" but the tool now does
  it automatically; the responder almost caused a split-brain by
  promoting a second one. *Action: rewrite the runbook.*

**Every one of those is a real 3am outage avoided.**

---

## Scenario 2 — Latency injection reveals a missing timeout

**Experiment.** Add 300ms latency to the `auth` service for 5% of
traffic (`tc qdisc add dev eth0 root netem delay 300ms`, applied to the
auth pods).

**Hypothesis:** "300ms of added auth latency does not breach the
checkout p99 SLO."

**Result:** checkout p99 went from 400ms to **9 seconds** for the
affected 5%. Steady state disproved.

**Why:** the checkout service called `auth` with **no timeout** (library
default). Under the added latency, checkout worker threads sat blocked;
the pool filled; even requests that didn't need auth queued behind them.
A 300ms dependency slowdown became a near-outage.

**Fix + retest:**
```
auth client: connect_timeout=200ms, request_timeout=800ms
             retries=1, backoff=100ms + jitter
checkout:    separate bulkhead pool for auth calls (max 20 threads)
             fallback: if auth times out, allow "guest checkout" for low-value carts
```
Re-run the same experiment → checkout p99 stays under 1.2s for the
affected slice, and the fallback path serves the rest.

---

## Scenario 3 — The retry storm

**Experiment.** Black-hole the `inventory` service entirely for 60s at
25% of traffic.

**Observation:** `inventory`'s own dashboards showed **3× normal request
rate** while it was down — from a service that was supposed to be
sending it *less*.

**Cause:** the caller retried 3× immediately on failure, with no cap
beyond that and no backoff. 25% of traffic × 3 tries = a load
multiplier aimed straight at the thing that was already struggling,
delaying its recovery even after the black-hole was lifted.

**Fix:** cap at 1 retry, exponential backoff (`100ms, 400ms, …`) with
**jitter** (so callers don't synchronize into a thundering herd), and a
circuit breaker that opens after 20 failures in 10s so most calls fail
fast instead of retrying at all. (Lab: `step3_dependency_failure.py`
shows the `dep load ×` multiplier per strategy.)

---

## Scenario 4 — Blast radius math gone wrong

**Near miss.** An engineer wanted to test region failover and set the
experiment to fail **50% of traffic** in the primary region "to get a
strong signal". The error budget for the month had 4 minutes left. The
experiment would have burned ~5 bad-minutes in its first 10-minute
window if failover was slow — blowing the SLA.

**The rule they skipped:** blast radius is bounded by the **remaining
error budget**, not by how clean you want the data.

```
remaining budget      = 4 min
guardrail (spend ≤ 25% of remaining) = 1 min
experiment window     = 10 min
=> max safe blast radius = 1 min / 10 min = 10% of traffic
```

And even 10% starts as a 1% canary with an abort at "projected spend >
1 min". (Lab: `step2_blast_radius.py`.)

---

## Scenario 5 — Chaos in CI: a resilience regression test

**Goal.** Stop resilience from silently rotting between GameDays.

**Pipeline (per service, on merge to main):**
```
1. deploy the build to a chaos-test namespace with a load generator
2. establish steady state (success rate, p99) over 2 min
3. run a fixed fault matrix:
     - kill 1 of 3 pods            -> expect: no SLO breach (LB + statelessness)
     - 200ms latency on dependency -> expect: no SLO breach (timeout + fallback)
     - dependency 100% errors 30s  -> expect: circuit opens, fallback serves, no cascade
     - CPU stress to 95%           -> expect: HPA scales OR load shedding kicks in
4. assert steady state held for each; fail the build if any regressed
5. tear down
```

Tools: LitmusChaos / Chaos Mesh experiments as CRDs checked into the
repo, or Toxiproxy for the network faults. The first time you add this,
it fails — that's the point; you find the missing timeout before a
customer does.

---

## Common findings, ranked by frequency

1. **Missing or default timeouts** on inter-service calls → cascades.
2. **Uncapped / no-backoff retries** → retry storms.
3. **Shared thread/connection pools** → one slow dependency starves all.
4. **DNS TTL / connection caching** → clients stuck on a dead endpoint.
5. **Alerts that don't page** (fire into a channel, wrong rotation).
6. **Runbooks out of date** with the current tooling.
7. **No fallback** → hard failure where graceful degradation was
   possible.
8. **Autoscaling too slow** or capped below the failover surge.
