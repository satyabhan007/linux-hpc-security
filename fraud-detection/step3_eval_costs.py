#!/usr/bin/env python3
"""
Fraud / Circumvention Detection · Step 3 — evaluate under imbalance & asymmetric cost.

Fraud is rare (here ~1.2%). Two traps:

  1. "Accuracy" is meaningless: a model that says "never fraud" scores
     98.8%.
  2. The cost of a miss (chargeback + goods + fine + ops) is NOT the
     cost of a false alarm (manual review + customer friction / lost
     good customer). The right threshold minimises EXPECTED COST, not
     error count.

We generate scored transactions, sweep the decision threshold, and find
the cost-optimal operating point — plus precision/recall/FPR at it.
"""
import random

random.seed(7)

N = 20_000
FRAUD_RATE = 0.012

COST_FN = 220.0     # missed fraud: chargeback + lost goods + fee + ops
COST_FP_REVIEW = 4.0    # analyst time for a flagged legit txn
COST_FP_FRICTION = 35.0  # prob-weighted lost good customer / abandoned order
# a flagged txn goes to review; if legit, we pay review + expected friction
COST_FP = COST_FP_REVIEW + 0.25 * COST_FP_FRICTION


def make_data():
    rows = []
    for _ in range(N):
        is_fraud = random.random() < FRAUD_RATE
        if is_fraud:
            # fraud scores higher but overlaps heavily with legit
            s = min(1.0, max(0.0, random.gauss(0.63, 0.20)))
        else:
            s = min(1.0, max(0.0, random.gauss(0.28, 0.18)))
        rows.append((s, is_fraud))
    return rows


def confusion(rows, thr):
    tp = fp = tn = fn = 0
    for s, y in rows:
        pred = s >= thr
        if pred and y:
            tp += 1
        elif pred and not y:
            fp += 1
        elif not pred and y:
            fn += 1
        else:
            tn += 1
    return tp, fp, tn, fn


def metrics(tp, fp, tn, fn):
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    fpr = fp / (fp + tn) if fp + tn else 0.0
    acc = (tp + tn) / (tp + fp + tn + fn)
    cost = fn * COST_FN + fp * COST_FP
    return prec, rec, fpr, acc, cost


def main():
    rows = make_data()
    n_fraud = sum(1 for _, y in rows if y)
    print(f"  {N} txns, {n_fraud} fraud ({100*n_fraud/N:.2f}%)")

    # baseline: block nothing
    _, _, _, _, base_cost = metrics(*(0, 0, N - n_fraud, n_fraud))
    print(f"  block-nothing:  accuracy {100*(N-n_fraud)/N:.2f}%  cost ${base_cost:,.0f}")

    best = None
    print(f"\n  {'thr':>5} {'prec':>6} {'recall':>7} {'FPR':>7} {'acc':>7} {'exp.cost':>12}")
    for thr in [i / 100 for i in range(5, 100, 5)]:
        m = metrics(*confusion(rows, thr))
        prec, rec, fpr, acc, cost = m
        star = ""
        if best is None or cost < best[1]:
            best = (thr, cost, m)
            star = "  <-"
        if thr in (0.15, 0.30, 0.45, 0.50, 0.55, 0.60, 0.70, 0.85):
            print(f"  {thr:>5.2f} {prec:>6.2f} {rec:>7.2f} {fpr:>7.3f} "
                  f"{acc:>6.2%} ${cost:>11,.0f}{star}")

    thr, cost, (prec, rec, fpr, acc, _) = best
    print(f"\n  cost-optimal threshold ~ {thr:.2f}: "
          f"precision {prec:.2f}, recall {rec:.2f}, FPR {fpr:.3f}, cost ${cost:,.0f}")

    # accuracy-optimal threshold, for comparison
    acc_opt = max([i / 100 for i in range(5, 100, 5)],
                  key=lambda t: metrics(*confusion(rows, t))[3])

    # 1. the naive "high accuracy" model (block nothing) is the most expensive
    assert base_cost > cost * 1.5

    # 2. a miss costs many times a false alarm here...
    assert COST_FN / COST_FP > 5
    # ...so the cost-optimal threshold sits BELOW the accuracy-optimal one
    #    (which is pushed to an extreme by the 98.8% base rate)
    assert thr < acc_opt, (thr, acc_opt)
    assert 0.4 <= thr <= 0.75, thr

    # 3. operating at the accuracy-optimal threshold loses money
    acc_at_accopt = metrics(*confusion(rows, acc_opt))[3]
    cost_at_accopt = metrics(*confusion(rows, acc_opt))[4]
    assert acc_at_accopt >= acc            # higher accuracy...
    assert cost_at_accopt > cost           # ...worse money

    # 4. recall at the cost-optimal point is partial, NOT ~1.0 — chasing the
    #    last few frauds costs more in review + friction than it saves
    assert 0.35 < rec < 0.95

    print(f"\n  accuracy-optimal threshold {acc_opt:.2f} scores {acc_at_accopt:.2%} "
          f"accuracy but costs ${cost_at_accopt:,.0f} "
          f"(${cost_at_accopt - cost:,.0f} worse than cost-optimal).")
    print("\n  takeaways: report precision/recall/FPR at a fixed review budget, not")
    print("  accuracy; pick the threshold by $ cost with real COST_FN/COST_FP;")
    print("  and expect a review queue, a challenge step (3-DS/step-up), and a")
    print("  feedback loop from chargebacks + analyst labels.")
    print("\nPASS — cost-optimal threshold is moderate (well below the accuracy-optimal"
          " one), beats 'block nothing' by >1.5x, and beats 'maximise accuracy' on $.")


if __name__ == "__main__":
    main()
