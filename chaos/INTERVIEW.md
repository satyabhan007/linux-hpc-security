# Chaos Engineering & Resilience — Interview Q&A

---

## Method

**Q: What is chaos engineering in one sentence?**
Disciplined experimentation on a system to build confidence in its
ability to withstand turbulent conditions — the scientific method
(hypothesis → inject fault → measure → learn) applied to reliability.

**Q: What are the principles / steps?**
Define steady state as a measurable output; hypothesize it holds under a
real-world fault; run the smallest fault in the smallest blast radius;
measure; minimize blast radius and have an abort condition; ideally
automate and run continuously in production.

**Q: What is "steady state" and how do you pick the SLI?**
The system's normal, healthy behavior expressed as a business/user
-visible output — request success rate, orders per minute, p99 latency.
Not an internal metric like CPU. It's the number that means "users are
fine".

**Q: What does it mean if an experiment "disproves" the hypothesis?**
You found a real weakness. Stop, fix it, then re-run to confirm. A
disproved hypothesis is a *success* for the exercise.

**Q: Why do you need an abort condition, and what's a good one?**
To cap user harm — you never keep a failing experiment running to "get
better data". Example: abort if user-facing success rate drops below
99% for 60s, or projected error-budget spend exceeds the guardrail.

**Q: Staging vs production chaos — why run in prod at all?**
Staging lacks prod's traffic, data, scale, dependency versions, and
real failure modes. Prod chaos (with small blast radius + guardrails +
abort) is the only way to build real confidence — but you earn it by
proving control in staging first.

---

## Blast radius & safety

**Q: How do you bound blast radius?**
By the error budget you're willing to spend, not by desired signal
strength. Start at ~1% of traffic/hosts, ramp 1→5→25→50 halting on any
bad stage, and compute the max fraction such that a full-failure of the
targeted slice for the experiment window still stays within the
guardrail.

**Q: What's the staged-ramp pattern?**
1% → 5% → 25% → 50%, with a health check and the abort condition
evaluated at each stage before proceeding.

**Q: How do you avoid harming customers during a prod experiment?**
Small blast radius, off-peak timing, targeting a canary/dark segment
first, feature-flag / percentage-based fault injection, a live abort
condition, someone actively watching, and a pre-briefed on-call.

---

## Failure modes & patterns

**Q: A caller has no timeout on a call to a now-dead dependency. What
happens?**
Threads block indefinitely; the worker/connection pool fills; the caller
then fails **all** requests, not just those needing that dependency —
one dependency outage becomes a full caller outage (cascade).

**Q: What is a retry storm and how do you prevent it?**
Callers retrying a failing dependency (especially with no cap and no
backoff) multiply load on the component that's already struggling,
preventing recovery. Prevent with: capped retries, exponential backoff,
**jitter**, retry only idempotent ops, and a circuit breaker.

**Q: Describe the circuit breaker states.**
Closed (calls pass; count failures). Open (after a failure threshold —
calls fail fast immediately, no waiting on the dead dependency). Half
-open (after a cooldown, let a probe through; success → closed, failure
→ open again).

**Q: What is a bulkhead?**
Isolating resources (separate thread pools / connection pools / queues)
per dependency or tenant, so one slow/failing dependency can't consume
all the caller's capacity and starve the rest.

**Q: Graceful degradation / fallback — example?**
Serving stale cached data, a default value, a queued write, or a reduced
feature ("recommendations unavailable") instead of a hard error when a
dependency is down.

**Q: Load shedding vs backpressure?**
Load shedding: reject excess requests early (429) to protect the core.
Backpressure: signal upstream to slow down (bounded queues that refuse
new work when full) rather than buffering until OOM.

**Q: Retries — when are they safe?**
Only for **idempotent** operations (GET, PUT with an idempotency key).
Retrying a non-idempotent POST can double-charge, double-ship, etc.

**Q: Why add jitter to backoff?**
Without it, many clients that failed at the same instant retry at the
same instant — a synchronized thundering herd that hammers the
recovering service in waves. Jitter spreads them out.

---

## Fault types & tooling

**Q: How would you inject network latency / packet loss on Linux?**
`tc qdisc add dev eth0 root netem delay 200ms 50ms` (latency + jitter),
`tc netem loss 10%`, or iptables/`nftables` DROP rules for a partition;
Toxiproxy for application-level control.

**Q: Name some chaos tools and what they target.**
Chaos Monkey / Simian Army (instance kills), Gremlin (commercial,
broad), LitmusChaos & Chaos Mesh (Kubernetes CRD-driven), Toxiproxy
(network faults), AWS Fault Injection Simulator, `stress-ng` (resource
exhaustion), `pumba` (Docker).

**Q: What's a GameDay?**
A scheduled, announced, cross-team exercise with a specific hypothesis
(e.g. "kill the primary DB, verify failover + alerts + runbook"). The
outcome is action items, not blame.

---

## Program & culture

**Q: How does chaos engineering relate to incident response (Module 18)?**
An experiment that disproves steady state should also verify the alert
fired, paged the right rotation, and the runbook worked — it tests
detection and response, not only the system's resilience.

**Q: Your org has zero chaos practice. How do you start?**
1) Pick one critical service with a clear SLI. 2) Run a tabletop, then a
staging GameDay for one obvious failure (kill an instance). 3) Fix what
you find, write the runbook. 4) Add guardrails + abort, do a tiny prod
canary. 5) Turn recurring experiments into a CI resilience test.

**Q: Common findings, most frequent first?**
Missing/default timeouts, uncapped retries, shared pools (no bulkheads),
DNS/connection caching on dead endpoints, alerts that don't page, stale
runbooks, no fallback, and autoscaling too slow for the failover surge.

**Q: How do you measure the program's value?**
Fewer and shorter incidents in the failure classes you've exercised,
resilience regressions caught in CI instead of prod, MTTD/MTTR trending
down, and GameDay findings closing on schedule.
