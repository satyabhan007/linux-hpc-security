# Chaos Engineering & Resilience — The Amateur's Guide

> A fire drill. You do not wait for a real fire to discover the back
> exit is chained shut. You test the alarm on a Tuesday, with everyone
> knowing, and you fix what you find.

---

## 1. What it is (and isn't)

**Chaos engineering** is the **scientific method** applied to a
distributed system: form a hypothesis about how it behaves under a
real-world fault, inject the smallest version of that fault in the
smallest blast radius, measure, and learn.

It is **not** "randomly break production". It is disciplined
experimentation to **find the weakness before it finds you at 3am**.

Netflix's Chaos Monkey kills production instances during business hours,
on purpose, so engineers are *forced* to build services that survive an
instance dying — because one will.

---

## 2. The method

1. **Define steady state** as a measurable *output*, not an internal
   metric: request success rate, p99 latency, orders/minute — something
   that means "users are fine".
2. **Hypothesize** it **holds** during a specific fault.
3. **Inject** the smallest fault that tests it, in the smallest scope.
4. **Measure.** If steady state is disproved → you found a real
   weakness. Stop and fix it. If it held → you have *evidence*, not
   hope.
5. **Abort condition** halts the experiment the instant user harm
   exceeds a preset limit. You never "ride it out to get clean data".

**Analogy — vitals.** "The patient is stable" is pulse/BP/O2, not "the
MRI is powered on". Steady state is the vitals of your system.

(Lab: `step1_steady_state.py` classifies HELD / DISPROVED / ABORTED.)

---

## 3. Blast radius: bounded by budget, not courage

Never inject into 100% of production on the first try. **Ramp:**

```
1%  →  5%  →  25%  →  50%      (halt at any stage that misbehaves)
```

Bound the whole experiment by the **error budget** (Module 18) you're
willing to spend, and set the **abort condition before you start**:
"kill it if success rate drops below 99%" or "if projected budget spend
exceeds the guardrail".

Run in **staging first**. Run in **production** only when the guardrails
and the abort button are wired and someone is watching.

(Lab: `step2_blast_radius.py`.)

---

## 4. The classic experiment: kill a dependency

Degrade or black-hole a dependency and watch whether its failure stays
**contained**. Four mechanisms decide it:

| Mechanism | Without it |
|---|---|
| **Timeout** | caller threads block forever on the dead dependency → the pool fills → the caller fails **everything** → cascade |
| **Capped retries + backoff + jitter** | uncapped retries = a "retry storm" that triples load on the already-failing dependency |
| **Circuit breaker** | after N failures, keep waiting the full timeout on every call — no fail-fast |
| **Fallback** | a hard error to the user instead of a degraded-but-useful response (cached data, a default, a queued write) |

"Recommendations unavailable" instead of a white screen = circuit
breaker + fallback doing its job. (Lab: `step3_dependency_failure.py`.)

---

## 5. Fault types worth a library

| Fault | How | Tests |
|---|---|---|
| added latency | `tc qdisc ... netem delay 200ms` | timeouts, ret+ budget |
| packet loss / partition | `tc netem loss 10%`, iptables DROP | split-brain, quorum, retries |
| process kill | `kill -9`, pod delete | restart, statelessness, LB |
| resource exhaustion | `stress-ng --vm ... --cpu ...` | limits, autoscaling, noisy neighbor |
| clock skew | `date -s`, `libfaketime` | token/cert validation, ordering |
| dependency black-hole | drop egress to the service | timeout + breaker + fallback |
| zone / region failure | block a whole AZ | failover, capacity, data replication |

Tools: **LitmusChaos** / **Chaos Mesh** (Kubernetes), **Gremlin**
(commercial), **Toxiproxy** (network), **AWS FIS**, **Chaos Monkey** /
Simian Army.

---

## 6. GameDays and continuous chaos

- **GameDay** — a scheduled, cross-team, hypothesis-driven exercise. "On
  Thursday we will fail the primary database and verify the replica
  promotes, alerts fire, and the runbook works." Everyone knows;
  nothing is a surprise except the results.
- **Continuous chaos** — automated experiments in CI/CD or on a
  schedule, once the team trusts the guardrails.

A chaos experiment that disproves steady state should **also** check
that your **alerting fired** and your **runbook worked** — it's testing
detection and response (Module 18), not just the system.

---

## 7. Resilience patterns (what you're verifying)

- **Timeouts** everywhere, tuned (not the library default of ∞ or 60s).
- **Retries**: capped, exponential backoff, **jitter**, and only for
  idempotent operations.
- **Circuit breaker**: closed → open (fail fast) → half-open (probe) →
  closed.
- **Bulkheads**: separate thread pools / connection pools per
  dependency, so one slow dependency can't starve the others.
- **Fallbacks / graceful degradation**: a useful reduced response.
- **Load shedding**: reject early (429) under overload rather than
  collapse.
- **Backpressure**: bounded queues; when full, push back, don't buffer
  to death.

---

## 8. Run the labs

```bash
python3 chaos/step1_steady_state.py        # the hypothesis test + abort guard
python3 chaos/step2_blast_radius.py        # ramp gating and the live abort projection
python3 chaos/step3_dependency_failure.py  # cascade, and the 4 things that stop it
```

Next: **`redblue/`** — chaos for the *adversary* case: emulate an attack
and measure whether detection and response hold.
