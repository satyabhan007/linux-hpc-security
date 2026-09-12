# anomaly-detection — rolling-baseline detector for infra telemetry

Matches learn5 Ch 5 (anomaly detection for infrastructure telemetry).
Zero third-party dependencies (stdlib `statistics` only), the same
constraint this repo's `encrypted-anomaly` and `fraud-detection` lab
modules use, so it runs anywhere Python 3.9+ runs with no `pip install`.

## Files

- **`rolling_baseline.py`** — two detectors:
  - `z_score_anomalies()` — rolling mean/stddev z-score, catches sudden
    spikes/drops (Ch 5, L2's "rolling mean and standard deviation"
    baseline).
  - `trend_anomalies()` — stdlib linear regression over fixed-size
    windows, catches a sustained slow drift (a memory leak) that a
    z-score detector misses because no single point is ever far from its
    immediate neighbors — the same idea as Prometheus's
    `predict_linear()`, reimplemented dependency-free.

## Try it

```bash
python3 -m py_compile rolling_baseline.py   # syntax/compile check
python3 rolling_baseline.py                 # runs a self-contained demo
```

Expected output: the demo generates a 106-sample synthetic series (a
stable baseline, one spike, then a slow 40-sample leak) and both
detectors should report exactly one anomaly each — the spike caught by
`z_score_anomalies()` and the drift caught by `trend_anomalies()`.

## Why two detectors, not one

Ch 5, L5 makes this explicit: "the same underlying issue produces a
different statistical signature — drift, low variance, seasonal
deviation — and a detector tuned for one shape will not catch another."
A single z-score threshold over a short window would never flag the slow
leak here, because each individual step in the leak is small relative to
the window's own (elevated) rolling stddev. Trend detection is a
different lens on the same data, not a redundant check.
