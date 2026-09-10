#!/usr/bin/env python3
"""
Chaos Engineering · Step 2 — blast radius and the staged ramp.

You never inject a fault into 100% of production on the first try. You
pick the smallest blast radius that still tests the hypothesis, bound it
by the error budget you're willing to spend, and ramp:

    1%  ->  5%  ->  25%  ->  50%   (halt at any stage that misbehaves)

Given the remaining error budget and a guardrail SLO, this computes the
largest fraction of traffic you can safely target (assuming the fault
makes the targeted traffic fail entirely), the abort threshold, and
whether each ramp stage is within budget.
"""

# monthly error budget in "bad minutes" and how much is already spent
SLO = 0.999
MONTH_MIN = 30 * 24 * 60
BUDGET_MIN = (1 - SLO) * MONTH_MIN            # ~43.2 min
BUDGET_SPENT_MIN = 12.0                       # already used this month
EXPERIMENT_DURATION_MIN = 10                  # how long the fault window runs
GUARDRAIL_MAX_SPEND_FRAC = 0.25              # spend at most 25% of REMAINING budget


def max_safe_fraction():
    remaining = BUDGET_MIN - BUDGET_SPENT_MIN
    allowed_spend = remaining * GUARDRAIL_MAX_SPEND_FRAC
    # worst case: targeted traffic fails 100% for the whole window.
    # bad-minutes contributed = fraction * duration
    return allowed_spend / EXPERIMENT_DURATION_MIN, remaining, allowed_spend


def stage_ok(frac):
    allowed_frac, _, _ = max_safe_fraction()
    worst_case_spend = frac * EXPERIMENT_DURATION_MIN
    return frac <= allowed_frac, worst_case_spend


def main():
    global BUDGET_SPENT_MIN
    allowed_frac, remaining, allowed_spend = max_safe_fraction()
    print(f"monthly budget {BUDGET_MIN:.1f} bad-min,  spent {BUDGET_SPENT_MIN:.1f},  "
          f"remaining {remaining:.1f}")
    print(f"guardrail: spend <= {GUARDRAIL_MAX_SPEND_FRAC:.0%} of remaining = "
          f"{allowed_spend:.1f} bad-min over a {EXPERIMENT_DURATION_MIN}-min window")
    print(f"=> max safe blast radius: {allowed_frac:.1%} of traffic\n")

    print(f"  {'stage':>6}  {'worst-case spend':>17}  verdict")
    ramp = [0.01, 0.05, 0.25, 0.50]
    results = {}
    for frac in ramp:
        ok, spend = stage_ok(frac)
        results[frac] = ok
        print(f"  {frac:>5.0%}  {spend:>13.1f} min  {'PROCEED' if ok else 'HALT — exceeds guardrail'}")

    # abort condition during the run: real spend rate implies budget gone
    # before the window ends
    def abort_now(observed_bad_min_so_far, minutes_elapsed):
        if minutes_elapsed <= 0:
            return False
        rate = observed_bad_min_so_far / minutes_elapsed          # bad-min per min
        projected = rate * EXPERIMENT_DURATION_MIN
        return projected > allowed_spend

    # --- assertions ---
    # with ~31 min remaining and a 25% guardrail, allowed spend ~7.8 bad-min,
    # over 10 min that's ~0.78 -> ~78% blast radius allowed in theory, but a
    # sane ramp still starts at 1%. The first two stages must be safe:
    assert results[0.01] and results[0.05], "1% and 5% must be within any sane budget"

    # tighten the budget: pretend we've spent almost all of it
    BUDGET_SPENT_MIN = 41.0
    allowed_frac2, remaining2, _ = max_safe_fraction()
    assert remaining2 < 3 and allowed_frac2 < 0.10, \
        "near budget exhaustion, even a 10% blast radius is off the table"
    ok1, _ = stage_ok(0.01)
    ok25, _ = stage_ok(0.25)
    assert ok1 and not ok25, "1% still ok on fumes; 25% is not"
    BUDGET_SPENT_MIN = 12.0

    # abort guard: if 5 bad-minutes accrue in the first 2 minutes, project
    # 25 over the window >> 7.8 allowed -> abort
    assert abort_now(5.0, 2.0) is True
    assert abort_now(0.3, 5.0) is False

    print("\n  blast radius is bounded by budget, not courage. Ramp, watch the")
    print("  projected spend, and abort the instant the projection exceeds the guardrail.")
    print("\nPASS — max safe fraction, ramp gating, and the live abort projection all check out.")


if __name__ == "__main__":
    main()
