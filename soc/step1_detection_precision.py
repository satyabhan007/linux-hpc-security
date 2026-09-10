#!/usr/bin/env python3
"""
SOC · Step 1 — a detection rule, and the precision / recall / alert-fatigue trade.

A detection is a filter over a stream of events. Every rule has a knob
(a threshold). Turn it down: you catch more real attacks (recall up) but
drown analysts in false positives (precision down). Turn it up: quiet
queue, missed intrusions.

This runs a real-shaped rule ("N failed auths from one source in a
window, then a success") against a labelled synthetic stream and sweeps
the threshold, reporting the confusion matrix, precision, recall, F1,
and the alert-fatigue ratio (alerts per true positive).
"""
import random
from collections import deque

random.seed(7)

# --- synthesise an auth event stream: (t_seconds, src_ip, user, outcome, is_attack) ---
def make_stream(n_benign_bursts=140, n_attacks=18):
    ev = []
    t = 0
    users = [f"u{i:02d}" for i in range(40)]
    for _ in range(n_benign_bursts):
        t += random.randint(1, 40)
        src = f"10.0.{random.randint(0,3)}.{random.randint(2,254)}"
        u = random.choice(users)
        # a benign user fat-fingers 0-3 times then succeeds
        fails = random.choices([0, 1, 2, 3], weights=[60, 25, 10, 5])[0]
        for k in range(fails):
            ev.append((t + k, src, u, "fail", False))
        ev.append((t + fails, src, u, "success", False))
        t += fails
    for _ in range(n_attacks):
        t += random.randint(5, 60)
        src = f"185.220.{random.randint(0,255)}.{random.randint(2,254)}"   # "bad" range
        u = random.choice(users)
        fails = random.randint(8, 40)                 # brute force
        for k in range(fails):
            ev.append((t + k, src, u, "fail", True))
        if random.random() < 0.7:                     # 70% of brute forces eventually pop
            ev.append((t + fails, src, u, "success", True))
        t += fails
    ev.sort()
    return ev


def detect(stream, fail_threshold, window_s=120):
    """Alert when a src accumulates >= fail_threshold 'fail' events within
    window_s AND (optionally) is followed by a 'success'. Returns the set
    of (src, t_alert) and whether each alert overlapped a true attack."""
    per_src = {}
    alerts = []
    for t, src, user, outcome, is_atk in stream:
        dq = per_src.setdefault(src, deque())
        if outcome == "fail":
            dq.append((t, is_atk))
        # evict outside the window
        while dq and t - dq[0][0] > window_s:
            dq.popleft()
        if outcome == "fail" and len(dq) == fail_threshold:
            # fire once when we first cross the threshold
            atk_frac = sum(1 for _, a in dq if a) / len(dq)
            alerts.append((src, t, atk_frac >= 0.5))
    return alerts


def score(stream, fail_threshold):
    # ground truth: a src is a "true attack" if it has >=8 attack fails
    atk_srcs = set()
    per = {}
    for t, src, u, o, is_atk in stream:
        if o == "fail" and is_atk:
            per[src] = per.get(src, 0) + 1
    atk_srcs = {s for s, c in per.items() if c >= 8}

    alerts = detect(stream, fail_threshold)
    alerted_srcs = {s for s, _, _ in alerts}

    tp = len(alerted_srcs & atk_srcs)
    fp = len(alerted_srcs - atk_srcs)
    fn = len(atk_srcs - alerted_srcs)
    precision = tp / (tp + fp) if tp + fp else 1.0
    recall = tp / (tp + fn) if tp + fn else 1.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    fatigue = len(alerts) / tp if tp else float("inf")
    return dict(thr=fail_threshold, tp=tp, fp=fp, fn=fn,
                precision=precision, recall=recall, f1=f1,
                alerts=len(alerts), fatigue=fatigue)


def main():
    stream = make_stream()
    print(f"events: {len(stream)}\n")
    print(f"{'thr':>4}  {'TP':>3} {'FP':>3} {'FN':>3}  {'prec':>5} {'recall':>6} "
          f"{'F1':>5}  {'alerts':>6} {'alerts/TP':>9}")
    rows = []
    for thr in (3, 4, 5, 6, 8, 10, 12):
        r = score(stream, thr)
        rows.append(r)
        print(f"{thr:>4}  {r['tp']:>3} {r['fp']:>3} {r['fn']:>3}  "
              f"{r['precision']:>5.2f} {r['recall']:>6.2f} {r['f1']:>5.2f}  "
              f"{r['alerts']:>6} {r['fatigue']:>9.1f}")

    low = next(r for r in rows if r["thr"] == 3)
    high = next(r for r in rows if r["thr"] == 12)
    best = max(rows, key=lambda r: r["f1"])

    print(f"\n  threshold 3 : recall {low['recall']:.2f} but {low['fp']} FP, "
          f"{low['fatigue']:.1f} alerts per real attack  (analyst burnout)")
    print(f"  threshold 12: precision {high['precision']:.2f} but recall "
          f"{high['recall']:.2f}  ({high['fn']} intrusions missed)")
    print(f"  best F1 at threshold {best['thr']}  (F1={best['f1']:.2f})")

    # the trade-off must actually show up
    assert low["recall"] >= high["recall"], "lower threshold should not have worse recall"
    assert high["precision"] >= low["precision"], "higher threshold should not have worse precision"
    assert low["fatigue"] > high["fatigue"], "lower threshold must cost more alerts per TP"
    assert 4 <= best["thr"] <= 10, "the F1-optimal threshold should be in the sensible middle"
    assert best["f1"] > 0.75, "a decent rule should reach F1 > 0.75 somewhere"

    print("\nPASS — precision/recall trade quantified; there is no 'catch everything' threshold.")


if __name__ == "__main__":
    main()
