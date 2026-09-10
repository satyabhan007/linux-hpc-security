#!/usr/bin/env python3
"""
SOC · Step 3 — alert triage: priority scoring and SLA burn.

A tier-1 analyst does not work the queue top-to-bottom. Each alert gets
a priority from four factors:

    priority = severity  x  asset_criticality  x  confidence  x  fidelity

and an SLA clock by severity. This models a shift as a prioritised
backlog: analysts work the highest-priority alerts first at a fixed
handle time; we report SLA breaches, the tier-1 auto-close rate, and
what a second analyst changes.
"""
import random
random.seed(11)

SEV = {"critical": 4, "high": 3, "medium": 2, "low": 1}
SLA_MIN = {"critical": 15, "high": 60, "medium": 240, "low": 1440}
HANDLE_MIN = 12
SHIFT_MIN = 8 * 60
PER_ANALYST_CAP = SHIFT_MIN // HANDLE_MIN            # 40 alerts / analyst / shift


def synth_alerts(n=120):
    rules = [
        ("edr_ransomware_canary",     "critical", 0.95),
        ("lsass_dump",                "critical", 0.80),
        ("impossible_travel",         "high",     0.45),
        ("new_admin_account",         "high",     0.70),
        ("powershell_downloadstring", "high",     0.35),
        ("port_scan_internal",        "medium",   0.30),
        ("geo_anomaly_login",         "medium",   0.25),
        ("expired_cert_warning",      "low",      0.90),
        ("beacon_suspected",          "high",     0.55),
        ("dlp_keyword_match",         "medium",   0.20),
    ]
    out = []
    for i in range(n):
        name, sev, fid = random.choice(rules)
        asset = random.choices([1, 2, 3, 4], weights=[40, 30, 20, 10])[0]
        conf = round(random.uniform(0.3, 1.0), 2)
        arrive = random.randint(0, SHIFT_MIN - 1)
        real = random.random() < (fid * conf) ** 0.9
        out.append(dict(id=i, name=name, sev=sev, asset=asset, conf=conf,
                        fid=fid, arrive=arrive, real=real))
    return out


def priority(a):
    return SEV[a["sev"]] * a["asset"] * a["conf"] * a["fid"]


def run_shift(alerts, n_analysts=1):
    q = sorted(alerts, key=lambda a: (-priority(a), a["arrive"]))
    worked, breached, autoclosed = [], 0, 0
    for idx, a in enumerate(q):
        analyst = idx % n_analysts
        local_pos = idx // n_analysts
        if local_pos >= PER_ANALYST_CAP:
            break                                   # this analyst is out of shift
        completion = (local_pos + 1) * HANDLE_MIN
        wait = max(0, completion - a["arrive"])
        breach = wait > SLA_MIN[a["sev"]]
        breached += breach
        if a["fid"] < 0.35 and a["asset"] <= 2 and not a["real"]:
            autoclosed += 1
        worked.append((a, wait, breach))
    top20_wait = [w for _, w, _ in worked[:20]]
    return dict(worked=worked, n_worked=len(worked),
                unworked=len(alerts) - len(worked),
                breached=breached, autoclosed=autoclosed,
                mean_wait_top20=sum(top20_wait) / len(top20_wait) if top20_wait else 0)


def main():
    alerts = synth_alerts()
    real = sum(a["real"] for a in alerts)
    print(f"shift queue: {len(alerts)} alerts ({real} real), {HANDLE_MIN} min/alert, "
          f"cap {PER_ANALYST_CAP}/analyst\n")

    solo = run_shift(alerts, 1)
    pair = run_shift(alerts, 2)
    print(f"  1 analyst : worked {solo['n_worked']:>3}, unworked {solo['unworked']:>3}, "
          f"SLA breaches {solo['breached']:>2}, top-20 mean wait {solo['mean_wait_top20']:.0f} min")
    print(f"  2 analysts: worked {pair['n_worked']:>3}, unworked {pair['unworked']:>3}, "
          f"SLA breaches {pair['breached']:>2}, top-20 mean wait {pair['mean_wait_top20']:.0f} min")

    q = sorted(alerts, key=lambda a: -priority(a))
    top10 = {a["id"] for a in q[:10]}
    worked_ids = {a["id"] for a, *_ in solo["worked"]}
    assert top10 <= worked_ids, "the 10 highest-priority alerts must all get worked"

    crit = dict(sev="critical", asset=4, conf=0.9, fid=0.9)
    noise = dict(sev="medium", asset=1, conf=0.5, fid=0.2)
    assert priority(crit) > 10 * priority(noise), "crown-jewel critical >> low-fidelity noise"

    assert solo["n_worked"] == PER_ANALYST_CAP and solo["unworked"] == 120 - PER_ANALYST_CAP
    assert pair["n_worked"] == 2 * PER_ANALYST_CAP
    assert pair["unworked"] < solo["unworked"]
    # a second analyst halves the wait on the highest-priority alerts
    assert pair["mean_wait_top20"] < solo["mean_wait_top20"]

    # low-fidelity, low-asset noise never even reaches an analyst — that IS the point
    noise_ids = {a["id"] for a in alerts if a["fid"] < 0.3 and a["asset"] == 1}
    assert noise_ids and not (noise_ids & worked_ids), "scoring sinks the noise below the cut"

    print("\n  score, then work the score. ~40 alerts/analyst/shift is the ceiling;")
    print("  a queue of 120 is a detection-tuning problem, not only a staffing one.")
    print("\nPASS — priority + SLA model; the queue math is why tuning beats hiring.")


if __name__ == "__main__":
    main()
