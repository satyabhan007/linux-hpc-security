#!/usr/bin/env python3
"""
Encrypted Anomaly · Step 3 — beacon detection from connection timing.

C2 implants "phone home" on a schedule: every 60 s, every 5 min, often
with random jitter (+/- 20%) to look less robotic. You cannot read the
traffic, but the *arrival pattern* of connections to a destination is
very different from a human.

Signals:
  * low coefficient of variation of inter-arrival times (regular)
  * a sharp peak in the interval histogram / autocorrelation
  * many connections, tiny bytes, long total duration
  * survives jitter: the MEAN interval is still stable, the distribution
    is still tight and unimodal

This lab scores several destinations and separates beacons (incl.
jittered) from human browsing bursts.
"""
import random
import statistics as st

random.seed(1337)


def gen_beacon(period, jitter_frac, n, start=0.0):
    t, out = start, []
    for _ in range(n):
        out.append(round(t, 2))
        t += period * (1 + random.uniform(-jitter_frac, jitter_frac))
    return out


def gen_human(n, span_s):
    """bursty: a few clusters of activity, long gaps, irregular."""
    out = []
    t = 0.0
    while len(out) < n:
        burst = random.randint(2, 6)
        for _ in range(burst):
            out.append(round(t, 2))
            t += random.uniform(0.5, 8)
        t += random.uniform(120, 1800)  # long idle gap
        if t > span_s:
            break
    return out[:n]


def iats(ts):
    return [b - a for a, b in zip(sorted(ts), sorted(ts)[1:])]


def regularity(ts):
    d = iats(ts)
    if len(d) < 4:
        return {"n": len(ts), "score": 0.0}
    mean = st.fmean(d)
    cv = st.pstdev(d) / mean if mean else 9.9
    # histogram tightness: fraction of intervals within +/-25% of the mean
    within = sum(1 for x in d if abs(x - mean) <= 0.25 * mean) / len(d)
    # lag-1 autocorrelation of the interval series (regular -> ~1)
    dm = [x - mean for x in d]
    num = sum(a * b for a, b in zip(dm, dm[1:]))
    den = sum(x * x for x in dm) or 1e-9
    ac1 = num / den
    # combine: low cv + high 'within' => beacon-like
    score = round(max(0.0, (1 - min(cv, 1)) * 0.6 + within * 0.4), 3)
    return {"n": len(ts), "mean_iat_s": round(mean, 1), "cv": round(cv, 3),
            "within_25pct": round(within, 2), "ac1": round(ac1, 2), "score": score}


def verdict(r):
    if r.get("score", 0) >= 0.7 and r.get("cv", 9) < 0.35:
        return "BEACON"
    if r.get("score", 0) >= 0.55 and r.get("cv", 9) < 0.55:
        return "LIKELY BEACON (jittered)"
    return "human / benign"


def main():
    dests = {
        "10.0.0.9  (clean 60s beacon)": gen_beacon(60, 0.00, 90),
        "10.0.0.9  (60s +/-20% jitter)": gen_beacon(60, 0.20, 90),
        "10.0.0.9  (300s +/-30% jitter)": gen_beacon(300, 0.30, 60),
        "cdn.example.com (human browse)": gen_human(90, 6 * 3600),
        "mail.example.com (human)": gen_human(70, 4 * 3600),
    }
    results = {}
    for name, ts in dests.items():
        r = regularity(ts)
        v = verdict(r)
        results[name] = (r, v)
        print(f"\n== {name} ==")
        for k, val in r.items():
            print(f"   {k:>14}: {val}")
        print(f"   -> {v}")

    # clean beacon: unambiguous
    assert results["10.0.0.9  (clean 60s beacon)"][1] == "BEACON"
    # jittered beacons: still caught (as beacon or jittered-beacon)
    assert "BEACON" in results["10.0.0.9  (60s +/-20% jitter)"][1]
    assert "BEACON" in results["10.0.0.9  (300s +/-30% jitter)"][1]
    # humans: not flagged
    assert results["cdn.example.com (human browse)"][1] == "human / benign"
    assert results["mail.example.com (human)"][1] == "human / benign"

    # the discriminator is CV: beacons < ~0.35, jittered < ~0.55, humans >> 1
    cv_clean = results["10.0.0.9  (clean 60s beacon)"][0]["cv"]
    cv_human = results["cdn.example.com (human browse)"][0]["cv"]
    assert cv_clean < 0.05
    assert cv_human > 1.0
    assert cv_human > 10 * cv_clean

    print("\n  RITA, Zeek, and most EDR/NDR products score exactly this: connection")
    print("  interval regularity + data-size consistency + connection count.")
    print("  Jitter raises the bar but a tight unimodal interval distribution stays")
    print("  a giveaway; only fully random (non-periodic) timing defeats it.")
    print("\nPASS — clean and jittered beacons flagged; human browsing is not.")


if __name__ == "__main__":
    main()
