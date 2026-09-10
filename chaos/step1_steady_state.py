#!/usr/bin/env python3
"""
Chaos Engineering · Step 1 — the steady-state hypothesis test.

The method is the scientific method:
  1. Define steady state as a measurable SLI (here: request success rate).
  2. Hypothesise it HOLDS during a real-world fault.
  3. Inject the smallest fault that tests it, in the smallest blast radius.
  4. Measure. If steady state is disproved, you found a weakness. Stop.
  5. An ABORT condition halts the experiment the moment user harm exceeds
     a preset limit -- you never "ride it out to get clean data".

This runs a baseline vs a fault window and does a simple significance
check, plus an abort guard.
"""
import random
import statistics as st

random.seed(3)

BASELINE_SUCCESS = 0.995
ABORT_IF_SUCCESS_BELOW = 0.90        # kill the experiment immediately below this
SIGNIFICANCE_DROP = 0.01            # a >1pp sustained drop disproves steady state


def sample_window(true_success, n=400):
    return [1 if random.random() < true_success else 0 for _ in range(n)]


def rate(xs):
    return sum(xs) / len(xs)


def run_experiment(fault_true_success, label):
    baseline = sample_window(BASELINE_SUCCESS)
    b_rate = rate(baseline)

    # fault window, checked in small batches so we can ABORT early
    fault_all = []
    aborted_at = None
    for batch in range(8):
        chunk = sample_window(fault_true_success, n=50)
        fault_all += chunk
        # rolling rate over the last 100 requests
        recent = fault_all[-100:]
        if len(recent) >= 100 and rate(recent) < ABORT_IF_SUCCESS_BELOW:
            aborted_at = (batch + 1) * 50
            break

    f_rate = rate(fault_all)
    drop = b_rate - f_rate
    # crude significance: drop must exceed threshold AND a few std errs
    se = (st.pstdev(baseline) ** 2 / len(baseline)
          + st.pstdev(fault_all) ** 2 / len(fault_all)) ** 0.5
    significant = drop > SIGNIFICANCE_DROP and drop > 2 * se

    verdict = ("ABORTED" if aborted_at else
               "DISPROVED (weakness found)" if significant else
               "HELD (resilient)")
    print(f"  {label}")
    print(f"    baseline success {b_rate:.3f}  fault success {f_rate:.3f}  "
          f"drop {drop*100:+.2f}pp  {'(aborted @%d req)' % aborted_at if aborted_at else ''}")
    print(f"    -> steady state {verdict}\n")
    return dict(verdict=verdict, drop=drop, aborted=aborted_at is not None,
               significant=significant)


def main():
    print(f"steady state: success rate ~ {BASELINE_SUCCESS};  "
          f"abort if <{ABORT_IF_SUCCESS_BELOW};  disproved if drop >{SIGNIFICANCE_DROP*100}pp\n")

    # A: a redundant dependency fails; retries + a replica absorb it -> HELD
    a = run_experiment(0.993, "Experiment A: kill one of three cache replicas")
    # B: a single-point dependency degrades; no fallback -> DISPROVED, small drop
    b = run_experiment(0.955, "Experiment B: add 300ms latency to the auth service")
    # C: a hard dependency outage; success collapses -> ABORT fires
    c = run_experiment(0.55, "Experiment C: black-hole the primary database")

    assert a["verdict"].startswith("HELD"), "a well-tolerated fault should not disprove steady state"
    assert not a["aborted"]
    assert b["verdict"].startswith("DISPROVED"), "a real 4pp drop should be caught as a weakness"
    assert not b["aborted"], "4pp is bad but above the 10pp abort line"
    assert c["aborted"], "a collapse to ~55% success must trip the abort guard"

    # the whole point: the abort protects users; you do NOT keep running C
    assert c["verdict"] == "ABORTED"

    print("  A: resilient (no action).  B: weakness -> add a fallback, retest.")
    print("  C: abort protected users; fix the SPOF before ever running this again.")
    print("\nPASS — hypothesis test classifies HELD / DISPROVED / ABORTED correctly.")


if __name__ == "__main__":
    main()
