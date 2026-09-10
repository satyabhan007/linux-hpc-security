#!/usr/bin/env python3
"""
NOC · Step 2 — SLOs, error budgets, and multi-window burn-rate alerting.

An SLO of 99.9% availability over 30 days = an error budget of 0.1% =
~43.2 minutes of allowed downtime. "Burn rate" = how fast you're
consuming it relative to steady state (1.0 = exactly on pace to use it
all in the window).

Google SRE's multi-window multi-burn-rate policy:
  * PAGE  if 1h burn >= 14.4  AND 5m burn >= 14.4   (2% of budget in 1h)
  * PAGE  if 6h burn >= 6     AND 30m burn >= 6     (5% of budget in 6h)
  * TICKET if 24h burn >= 3   AND 2h burn >= 3      (10% of budget in 24h)
  * TICKET if 72h burn >= 1   AND 6h burn >= 1

Short window confirms it's still happening; long window kills flapping.
"""

SLO = 0.999
WINDOW_DAYS = 30
BUDGET_FRAC = 1 - SLO                                  # 0.001
BUDGET_MIN = BUDGET_FRAC * WINDOW_DAYS * 24 * 60       # ~43.2 minutes

# (short_window_h, long_window_h, burn_threshold, action)
POLICIES = [
    (5 / 60, 1,  14.4, "PAGE"),
    (30 / 60, 6, 6.0,  "PAGE"),
    (2, 24, 3.0, "TICKET"),
    (6, 72, 1.0, "TICKET"),
]


def burn_rate(error_ratio):
    """error_ratio observed in a window / the error_ratio the SLO allows."""
    return error_ratio / BUDGET_FRAC


def evaluate(short_err, long_err):
    """short_err/long_err: dict window_hours -> observed error ratio."""
    fired = []
    for sw, lw, thr, action in POLICIES:
        sr = burn_rate(short_err[sw])
        lr = burn_rate(long_err[lw])
        if sr >= thr and lr >= thr:
            fired.append((action, thr, sw, lw, sr, lr))
    if not fired:
        return "none", None
    # most severe / fastest wins
    fired.sort(key=lambda f: (0 if f[0] == "PAGE" else 1, -f[1]))
    return fired[0][0], fired[0]


def time_to_exhaustion(current_burn, budget_left_frac=1.0):
    if current_burn <= 0:
        return float("inf")
    return budget_left_frac * WINDOW_DAYS * 24 / current_burn      # hours


def scenario(name, err_by_window):
    short = {sw: err_by_window.get(sw, err_by_window["_base"]) for sw, *_ in POLICIES}
    lng = {lw: err_by_window.get(lw, err_by_window["_base"]) for _, lw, *_ in POLICIES}
    action, detail = evaluate(short, lng)
    peak_burn = max(burn_rate(v) for v in list(short.values()) + list(lng.values()))
    tte = time_to_exhaustion(peak_burn)
    print(f"  {name:<34} peak burn {peak_burn:>6.1f}x  ->  {action:<6} "
          f"(budget gone in {'%.1fh' % tte if tte != float('inf') else 'never'})")
    return action


def main():
    print(f"SLO {SLO:.3%} over {WINDOW_DAYS}d  =>  error budget {BUDGET_MIN:.1f} min "
          f"({BUDGET_FRAC:.3%})\n")

    a1 = scenario("steady state (0.05% errors)", {"_base": 0.0005})
    a2 = scenario("brief 30% error blip, ~40s", {"_base": 0.0005,
                  5 / 60: 0.30, 30 / 60: 0.004, 1: 0.001, 6: 0.0005})  # gone within the hour
    a3 = scenario("sustained 2% errors, 1h+", {"_base": 0.02,
                  5 / 60: 0.02, 30 / 60: 0.02, 1: 0.02, 6: 0.02})
    a4 = scenario("chronic 0.35% errors, days", {"_base": 0.0035,
                  2: 0.0035, 24: 0.0035, 6: 0.0035, 72: 0.0035})

    assert a1 == "none", "steady state at half the budget rate must not alert"
    # a short 5-minute blip: 5m burn is huge but the 1h long window is calm -> no page
    assert a2 == "none", "a 3-minute blip must not page (long window filters it)"
    # sustained 2% (20x the 0.1% budget) -> fast page
    assert a3 == "PAGE", "20x burn sustained across 5m AND 1h must page"
    # chronic low-grade 3.5x burn -> ticket, not a page
    assert a4 == "TICKET", "3.5x chronic burn is a ticket, not a 3am page"

    # exhaustion math
    assert abs(time_to_exhaustion(14.4) - 50.0) < 1.0, "14.4x burn empties a 30d budget in ~50h"
    assert time_to_exhaustion(1.0) == WINDOW_DAYS * 24
    assert time_to_exhaustion(0) == float("inf")

    print("\n  short window = 'is it still happening?'  long window = 'is it real?'")
    print("  Both must exceed the threshold. That kills flapping and blips.")
    print("\nPASS — burn-rate policy pages on fast sustained burn, tickets on chronic, ignores blips.")


if __name__ == "__main__":
    main()
