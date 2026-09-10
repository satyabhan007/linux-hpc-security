#!/usr/bin/env python3
"""
NOC · Step 1 — the four golden signals, USE, and RED — and why you alert
on symptoms, not causes.

  Golden signals (Google SRE): latency, traffic, errors, saturation
  USE (Brendan Gregg, per resource): utilization, saturation, errors
  RED (per service): rate, errors, duration

Rule: page on user-visible symptoms (error rate, p99 latency, SLO burn).
Saturation is a *predictor* — it warns you before the symptom, so it's a
ticket/warning, not a page (unless it's already causing the symptom).

This walks a per-minute metrics series through a rising-load incident and
shows the signals lighting up in order: saturation first, then latency,
then errors.
"""

# per-minute: rps, cpu_util, run_queue, p99_ms, err_rate
# Model: capacity ~ 900 rps. Above that, a queue integrates (work arrives
# faster than it drains); latency tracks the queue; errors appear only
# once latency crosses the client timeout (600 ms) -> timeouts.
CAPACITY_RPS = 900
CLIENT_TIMEOUT_MS = 600


def make_series():
    s = []
    queue = 0.0
    for m in range(30):
        rps = 400 + m * 55                        # traffic climbs past capacity ~m9
        cpu = min(0.99, rps / CAPACITY_RPS * 0.9)
        overload = max(0.0, rps - CAPACITY_RPS)
        queue = max(0.0, queue + overload / CAPACITY_RPS - 0.15)   # integrate, slow drain
        runq = queue * 6
        p99 = 45 + queue * 140                    # latency tracks the standing queue
        err = 0.0008
        if p99 > CLIENT_TIMEOUT_MS:
            err += 0.02 + 0.00025 * (p99 - CLIENT_TIMEOUT_MS)     # timeout-driven errors
        s.append(dict(min=m, rps=rps, cpu=cpu, runq=runq, p99=p99, err=min(err, 0.6)))
    return s


THRESH = dict(p99_ms=500, err_rate=0.02, cpu_util=0.85, run_queue=8)


def classify(row):
    sat_hot = row["cpu"] > THRESH["cpu_util"] or row["runq"] > THRESH["run_queue"]
    lat_bad = row["p99"] > THRESH["p99_ms"]
    err_bad = row["err"] > THRESH["err_rate"]
    if err_bad or lat_bad:
        sev = "PAGE"                              # user-visible symptom
    elif sat_hot:
        sev = "WARN"                              # predictor: ticket, watch it
    else:
        sev = "ok"
    return dict(sev=sev, sat_hot=sat_hot, lat_bad=lat_bad, err_bad=err_bad)


def main():
    s = make_series()
    print(f"{'min':>3} {'rps':>5} {'cpu':>5} {'runq':>5} {'p99ms':>7} {'err':>6}  signal")
    first = {}
    for row in s:
        c = classify(row)
        for k in ("sat_hot", "lat_bad", "err_bad"):
            if c[k] and k not in first:
                first[k] = row["min"]
        tags = " ".join(t for t in
                        (["SAT"] if c["sat_hot"] else []) +
                        (["LAT"] if c["lat_bad"] else []) +
                        (["ERR"] if c["err_bad"] else []))
        print(f"{row['min']:>3} {row['rps']:>5} {row['cpu']:>5.2f} {row['runq']:>5.1f} "
              f"{row['p99']:>7.0f} {row['err']:>6.3f}  {c['sev']:<4} {tags}")

    print(f"\n  saturation first flagged at minute {first['sat_hot']}")
    print(f"  latency SLO breached at minute   {first['lat_bad']}")
    print(f"  errors (client timeouts) at min  {first['err_bad']}")

    # saturation leads the user-visible symptoms — that's why it's an
    # early-warning WARN, and latency/errors are the PAGE.
    assert first["sat_hot"] < first["lat_bad"] < first["err_bad"], \
        "cause (saturation) must precede symptoms (latency then errors)"

    # there is a window where only saturation is hot -> WARN, no page yet
    warn_only = [r for r in s if classify(r)["sev"] == "WARN"]
    assert warn_only, "there must be a lead-time window that pages nobody"

    # once errors appear, so has latency (you don't get error-only)
    for r in s:
        c = classify(r)
        if c["err_bad"]:
            assert c["lat_bad"], "error spike without latency spike shouldn't happen here"

    # RED 'duration' == golden 'latency'; RED 'errors' == golden 'errors' -> same page
    page_rows = [r["min"] for r in s if classify(r)["sev"] == "PAGE"]
    assert page_rows and page_rows[0] == first["lat_bad"]

    print("\n  page on symptoms (LAT/ERR), ticket on the predictor (SAT). The SAT")
    print("  lead time is your chance to autoscale before users notice.")
    print("\nPASS — signals light up cause->symptom; alerting policy follows the order.")


if __name__ == "__main__":
    main()
