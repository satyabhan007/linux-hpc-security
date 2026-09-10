#!/usr/bin/env python3
"""
Red vs Blue · Step 3 — the purple-team feedback loop.

Purple teaming = the red team executes a known set of ATT&CK techniques,
on a schedule, in the open, and the blue team measures: for each
technique, did an alert fire, and how fast (MTTD)? The output is a
detection-coverage scorecard and a ranked gap list. Then you build a
rule for the biggest gap and re-run to prove the coverage went up.

This models one exercise, scores it, closes the top gap, and re-scores.
"""

# (technique, tactic, prevalence 1-10)
PLAN = [
    ("T1566", "initial-access",  9),
    ("T1059", "execution",      10),
    ("T1053", "persistence",     7),
    ("T1548", "priv-esc",        6),
    ("T1562", "defense-evasion", 8),
    ("T1003", "cred-access",     9),
    ("T1087", "discovery",       5),
    ("T1021", "lateral-movement",8),
    ("T1071", "command-control", 7),
    ("T1041", "exfiltration",    7),
]

# detections: technique -> (fires?, mttd_minutes)
DETECTIONS = {
    "T1059": (True, 4),
    "T1562": (True, 2),
    "T1003": (True, 6),
    "T1021": (True, 11),
    "T1071": (True, 25),
    # T1566, T1053, T1548, T1087, T1041  -> no detection
}


def score(plan, detections):
    covered = [t for t, *_ in plan if detections.get(t, (False,))[0]]
    coverage = len(covered) / len(plan)
    wtot = sum(w for *_, w in plan)
    wcov = sum(w for t, _, w in plan if detections.get(t, (False,))[0])
    weighted = wcov / wtot
    mttds = [detections[t][1] for t, *_ in plan if detections.get(t, (False,))[0]]
    mttd = sum(mttds) / len(mttds) if mttds else None
    gaps = sorted(((w, t, tac) for t, tac, w in plan
                   if not detections.get(t, (False,))[0]), reverse=True)
    return dict(coverage=coverage, weighted=weighted, mttd=mttd, gaps=gaps,
                covered=covered)


def main():
    before = score(PLAN, DETECTIONS)
    print("exercise 1 scorecard:")
    print(f"  technique coverage : {before['coverage']:.0%}  "
          f"({len(before['covered'])}/{len(PLAN)})")
    print(f"  prevalence-weighted: {before['weighted']:.0%}")
    print(f"  mean MTTD (detected): {before['mttd']:.1f} min")
    print("  gap list (by prevalence):")
    for w, t, tac in before["gaps"]:
        print(f"    [{w:>2}] {t}  {tac}")

    # close the top gap: build a detection for it
    top_gap = before["gaps"][0][1]
    print(f"\n  --> detection engineering: ship a rule for {top_gap}")
    new_det = dict(DETECTIONS)
    new_det[top_gap] = (True, 8)          # new rule, 8-min MTTD
    after = score(PLAN, new_det)

    print("\nexercise 2 scorecard (after the fix):")
    print(f"  technique coverage : {after['coverage']:.0%}")
    print(f"  prevalence-weighted: {after['weighted']:.0%}   "
          f"(+{(after['weighted']-before['weighted'])*100:.0f} pp)")
    print(f"  mean MTTD (detected): {after['mttd']:.1f} min")

    # the loop must measurably move coverage
    assert after["coverage"] > before["coverage"]
    assert after["weighted"] > before["weighted"]
    # closing the HIGHEST-prevalence gap moves the weighted number more than
    # a random gap would
    alt = dict(DETECTIONS); alt["T1087"] = (True, 8)     # close the weakest gap instead
    alt_score = score(PLAN, alt)
    assert (after["weighted"] - before["weighted"]) > (alt_score["weighted"] - before["weighted"]), \
        "closing the biggest gap beats closing the smallest"

    # T1566 (phishing, prevalence 9) was the top gap here
    assert top_gap == "T1566"
    # still gaps left -> the loop continues (this is never "done")
    assert after["gaps"], "one exercise closes one gap; purple teaming is continuous"
    # MTTD only counts detections that fired; adding a slow-ish rule can nudge it
    assert after["mttd"] is not None

    print(f"\n  before: {before['weighted']:.0%} weighted coverage, {len(before['gaps'])} gaps")
    print(f"  after : {after['weighted']:.0%} weighted coverage, {len(after['gaps'])} gaps")
    print("  run monthly, close the top gap each time, and the curve goes up.")
    print("\nPASS — the purple loop turns an emulated attack into a ranked, shrinking gap list.")


if __name__ == "__main__":
    main()
