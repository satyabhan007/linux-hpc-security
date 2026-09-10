#!/usr/bin/env python3
"""
Chaos Engineering · Step 3 — cascading failure, and the four things that stop it.

A downstream dependency (`payments`) goes hard-down. What the caller
(`checkout`) does about it decides whether one dependency's outage
becomes a full-site outage:

  * NO timeout        -> caller threads block forever on the dead dep;
                          the thread pool fills; the caller stops serving
                          ANYTHING -> cascade.
  * retry, no backoff -> the caller hammers the failing dep 3x ->
                          "retry storm" amplification, delaying its recovery.
  * timeout + capped retry + backoff -> requests fail fast, pool survives.
  * circuit breaker + fallback -> after N failures the breaker opens,
                          calls return instantly with a degraded response;
                          the caller stays up at reduced function.

This models a fixed-size worker pool and compares the four strategies.
"""

POOL = 50                     # worker threads at the caller
OFFERED_RPS = 200
TICK_S = 0.1                  # simulate in 100ms ticks
DURATION_TICKS = 100         # 10 seconds of outage
DEP_TIMEOUT_S = 0.3
DEP_DOWN = True              # the dependency is hard-down for the whole run


def simulate(strategy):
    busy_until = [0.0] * POOL          # per-worker free time (seconds)
    served_ok = served_degraded = dropped = admitted = 0
    dep_calls = 0
    breaker_open = False
    breaker_fail_count = 0
    BREAKER_THRESHOLD = 20
    BREAKER_COOLDOWN = 2.0
    breaker_opened_at = -999

    t = 0.0
    for _ in range(DURATION_TICKS):
        t += TICK_S
        arrivals = int(OFFERED_RPS * TICK_S)
        # breaker half-open check
        if breaker_open and t - breaker_opened_at > BREAKER_COOLDOWN:
            breaker_open = False
            breaker_fail_count = 0
        for _ in range(arrivals):
            free = [i for i, u in enumerate(busy_until) if u <= t]
            if not free:
                dropped += 1                       # pool exhausted -> request shed
                continue
            w = free[0]
            admitted += 1

            if strategy == "circuit_breaker" and breaker_open:
                served_degraded += 1              # fallback, instant
                busy_until[w] = t + 0.005
                continue

            # make the dependency call(s)
            if strategy == "no_timeout":
                # blocks for a very long time on a dead dep
                busy_until[w] = t + 30.0
                dep_calls += 1
            elif strategy == "retry_no_backoff":
                busy_until[w] = t + DEP_TIMEOUT_S * 3     # 3 immediate tries
                dep_calls += 3
            elif strategy == "timeout_backoff":
                busy_until[w] = t + DEP_TIMEOUT_S + 0.05 + DEP_TIMEOUT_S  # 1 retry, small backoff
                dep_calls += 2
            elif strategy == "circuit_breaker":
                busy_until[w] = t + DEP_TIMEOUT_S
                dep_calls += 1
                breaker_fail_count += 1
                if breaker_fail_count >= BREAKER_THRESHOLD:
                    breaker_open = True
                    breaker_opened_at = t
            # dep is down -> the call fails after it returns
            # (served_ok only increments if the dep were up, which it isn't)

    total = OFFERED_RPS * TICK_S * DURATION_TICKS
    return dict(strategy=strategy, total=int(total),
                ok=served_ok, degraded=served_degraded, dropped=dropped,
                admitted=admitted,
                availability=(served_ok + served_degraded) / total,
                dep_load_multiple=dep_calls / (admitted or 1))


def main():
    print(f"pool={POOL} workers, offered {OFFERED_RPS} rps, dependency HARD DOWN for "
          f"{DURATION_TICKS*TICK_S:.0f}s\n")
    print(f"  {'strategy':>18}  {'served/degraded':>15}  {'dropped':>8}  "
          f"{'availability':>12}  {'dep load x':>10}")
    res = {}
    for s in ("no_timeout", "retry_no_backoff", "timeout_backoff", "circuit_breaker"):
        r = simulate(s)
        res[s] = r
        print(f"  {s:>18}  {r['ok']:>6}/{r['degraded']:<8}  {r['dropped']:>8}  "
              f"{r['availability']:>11.1%}  {r['dep_load_multiple']:>9.2f}x")

    # no_timeout: pool fills almost immediately, nearly everything is dropped
    assert res["no_timeout"]["dropped"] > 0.9 * res["no_timeout"]["total"], \
        "no timeout -> pool exhaustion -> caller-wide outage (cascade)"

    # retry storm: dep sees ~3x the load of the sane strategies -> slows its recovery
    assert res["retry_no_backoff"]["dep_load_multiple"] > 2.5
    assert res["retry_no_backoff"]["dep_load_multiple"] > \
           2 * res["circuit_breaker"]["dep_load_multiple"]

    # timeout+backoff: still failing the user (dep is down) but the POOL survives
    # and keeps recycling, so it admits many times more requests than no_timeout
    # (whose 50 workers are stuck for 30s each and never come back)
    assert res["timeout_backoff"]["admitted"] > 5 * res["no_timeout"]["admitted"], \
        "a bounded timeout lets the worker pool recover instead of wedging"

    # circuit breaker: the ONLY strategy that keeps availability up, via fallback
    assert res["circuit_breaker"]["availability"] > 0.5, \
        "breaker + fallback -> degraded but available"
    assert res["circuit_breaker"]["availability"] > 5 * res["no_timeout"]["availability"]
    # and it stops calling the dead dependency
    assert res["circuit_breaker"]["dep_load_multiple"] < 0.5

    print("\n  no_timeout: 1 dep outage -> whole caller down.  retry_no_backoff: +3x load")
    print("  on the victim.  timeout+backoff: pool survives.  breaker+fallback: stay up degraded.")
    print("\nPASS — the four containment strategies produce the four textbook outcomes.")


if __name__ == "__main__":
    main()
