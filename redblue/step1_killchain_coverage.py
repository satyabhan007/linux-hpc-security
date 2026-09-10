#!/usr/bin/env python3
"""
Red vs Blue · Step 1 — kill-chain coverage and dwell time.

An intrusion walks the ATT&CK tactics in order. The blue team has a
detection for some techniques (with a fire probability). What matters is
not "how many detections do we have" but "at which STAGE do we first
catch it" -- catching recon costs the attacker nothing; catching exfil
means the data is already gone.

This runs an emulated intrusion, finds the first stage that alerts, the
dwell time (stages the attacker got for free), and the blind stages,
then shows the impact difference of an early vs late catch.
"""
import random
random.seed(5)

# ATT&CK tactic order (the "kill chain")
TACTICS = ["recon", "initial-access", "execution", "persistence",
           "priv-esc", "defense-evasion", "cred-access", "discovery",
           "lateral-movement", "collection", "command-control",
           "exfiltration", "impact"]

# the emulated intrusion: (tactic, technique)
INTRUSION = [
    ("recon",            "T1595 active scanning"),
    ("initial-access",   "T1566 spearphishing link"),
    ("execution",        "T1059 powershell"),
    ("persistence",      "T1547 run key"),
    ("priv-esc",         "T1548 bypass UAC"),
    ("defense-evasion",  "T1562 disable defender"),
    ("cred-access",      "T1003 lsass dump"),
    ("discovery",        "T1087 account discovery"),
    ("lateral-movement", "T1021 smb/psexec"),
    ("collection",       "T1005 data from local system"),
    ("command-control",  "T1071 https beacon"),
    ("exfiltration",     "T1041 exfil over c2"),
    ("impact",           "T1486 ransomware"),
]

# detections we own: technique_prefix -> P(fire | technique executed)
# (note: no detection on the final 'impact' stage -- by then it's too late anyway)
DETECTIONS = {
    "T1059": 0.55,   # powershell logging
    "T1547": 0.40,   # autoruns
    "T1562": 0.70,   # defender tamper
    "T1003": 0.75,   # lsass access
    "T1021": 0.50,   # smb admin share / psexec
    "T1071": 0.35,   # beacon jitter
}

# rough $ / harm weight if the attacker reaches this stage undetected
STAGE_COST = {t: c for t, c in zip(TACTICS, [0, 1, 2, 3, 5, 6, 8, 9, 13, 18, 20, 60, 100])}


def detect_prob(technique):
    for pref, p in DETECTIONS.items():
        if technique.startswith(pref):
            return p
    return 0.0


def run_intrusion(intrusion, trials=4000):
    first_stage_hist = {}
    dwell_samples = []
    ever_caught = 0
    for _ in range(trials):
        caught_at = None
        for idx, (tactic, tech) in enumerate(intrusion):
            if random.random() < detect_prob(tech):
                caught_at = idx
                break
        if caught_at is not None:
            ever_caught += 1
            dwell_samples.append(caught_at)                 # stages before detection
            first_stage_hist[intrusion[caught_at][0]] = \
                first_stage_hist.get(intrusion[caught_at][0], 0) + 1
        else:
            dwell_samples.append(len(intrusion))
    return dict(
        detect_rate=ever_caught / trials,
        mean_dwell_stages=sum(dwell_samples) / len(dwell_samples),
        first_stage_hist=first_stage_hist,
    )


def main():
    blind = [f"{t} / {tech}" for t, tech in INTRUSION if detect_prob(tech) == 0.0]
    print(f"kill chain: {len(INTRUSION)} stages,  detections on "
          f"{len(INTRUSION) - len(blind)} techniques\n")
    print("  blind stages (no detection at all):")
    for b in blind:
        print(f"    - {b}")

    r = run_intrusion(INTRUSION)
    print(f"\n  overall detection rate (caught somewhere): {r['detect_rate']:.1%}")
    print(f"  mean dwell: {r['mean_dwell_stages']:.1f} stages before first alert")
    print(f"  where it's first caught:")
    for t in TACTICS:
        n = r["first_stage_hist"].get(t, 0)
        if n:
            print(f"    {t:>16}: {100*n/ (r['detect_rate']*4000):.0f}% of catches "
                  f"(cost if it gets here: {STAGE_COST[t]})")

    # recon + initial-access + persistence-ish early stages are blind here,
    # so the earliest realistic catch is 'execution' (T1059)
    assert "recon / T1595 active scanning" in blind
    assert "initial-access / T1566 spearphishing link" in blind
    # first catch is never before 'execution' (index 2)
    assert min(TACTICS.index(t) for t in r["first_stage_hist"]) >= TACTICS.index("execution")

    # the chain of detections should catch MOST intrusions before impact,
    # but not all -- there is a real miss rate
    assert 0.80 < r["detect_rate"] < 0.999, "layered detection catches most, not all"

    # counterfactual: if we ONLY had the ransomware detection (T1486, last stage),
    # dwell would be ~12 stages and cost would be maximal
    only_last = {"T1486": 0.95}
    saved = dict(DETECTIONS)
    DETECTIONS.clear(); DETECTIONS.update(only_last)
    r2 = run_intrusion(INTRUSION)
    DETECTIONS.clear(); DETECTIONS.update(saved)
    assert r2["mean_dwell_stages"] > 11, "detecting only at 'impact' = ~full-chain dwell"
    assert r["mean_dwell_stages"] < 0.6 * r2["mean_dwell_stages"], \
        "early detections slash dwell time vs a single end-of-chain rule"

    print("\n  a detection at 'execution' costs the attacker the whole campaign;")
    print("  a detection at 'impact' means you're doing incident response, not defence.")
    print("\nPASS — coverage measured by STAGE and dwell, not by detection count.")


if __name__ == "__main__":
    main()
