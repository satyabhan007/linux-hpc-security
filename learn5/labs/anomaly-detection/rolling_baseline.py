#!/usr/bin/env python3
"""Rolling-baseline anomaly detector for infrastructure telemetry.

Matches learn5 Ch 5 (anomaly detection for infrastructure telemetry) and
mirrors the pattern used by this repo's `encrypted-anomaly` and
`fraud-detection` lab modules: zero third-party dependencies, stdlib
`statistics` only, so it runs anywhere Python 3 runs.

Two detectors, because the same underlying problem (a leak, a beacon, a
spike) produces different statistical signatures (Ch 5, L5):

  1. z_score_anomalies()   — flags points far from a rolling mean/stddev.
                             Catches sudden spikes/drops.
  2. trend_anomalies()     — flags a sustained linear drift (a slow memory
                             leak) using simple linear regression, the same
                             idea as Prometheus's predict_linear().

Run directly for a self-contained demo against synthetic data:

    $ python3 rolling_baseline.py
"""
from __future__ import annotations

import statistics
from dataclasses import dataclass


@dataclass
class Anomaly:
    index: int
    value: float
    reason: str


def z_score_anomalies(
    series: list[float],
    window: int = 20,
    threshold: float = 3.0,
) -> list[Anomaly]:
    """Flag points more than `threshold` rolling-stddevs from the rolling
    mean of the preceding `window` points.

    This is the Ch 5 "rolling mean and standard deviation" baseline — the
    workhorse for infra telemetry because it needs no training step and
    adapts as the baseline itself shifts.
    """
    anomalies: list[Anomaly] = []
    for i in range(window, len(series)):
        history = series[i - window : i]
        mean = statistics.fmean(history)
        # stdev needs at least 2 points and non-zero variance to be
        # meaningful; guard against a perfectly flat window.
        try:
            stdev = statistics.stdev(history)
        except statistics.StatisticsError:
            stdev = 0.0
        if stdev == 0:
            continue
        z = abs(series[i] - mean) / stdev
        if z > threshold:
            anomalies.append(
                Anomaly(
                    index=i,
                    value=series[i],
                    reason=f"z={z:.2f} (mean={mean:.2f}, stdev={stdev:.2f})",
                )
            )
    return anomalies


def _linear_regression_slope(y: list[float]) -> tuple[float, float]:
    """Ordinary least squares slope/intercept for y against x = 0..n-1.

    Stdlib-only stand-in for the trend half of Prometheus's
    predict_linear() function used throughout learn5 Ch 5 and Ch 12.
    """
    n = len(y)
    xs = list(range(n))
    x_mean = statistics.fmean(xs)
    y_mean = statistics.fmean(y)
    num = sum((x - x_mean) * (yi - y_mean) for x, yi in zip(xs, y))
    den = sum((x - x_mean) ** 2 for x in xs)
    if den == 0:
        return 0.0, y_mean
    slope = num / den
    intercept = y_mean - slope * x_mean
    return slope, intercept


def trend_anomalies(
    series: list[float],
    window: int = 30,
    slope_threshold: float = 0.5,
) -> list[Anomaly]:
    """Flag windows with a sustained linear drift steeper than
    `slope_threshold` units per sample — the "slow memory leak" pattern
    that a fixed threshold or even a z-score detector can miss because no
    single point is ever far from ITS immediate neighbors.
    """
    anomalies: list[Anomaly] = []
    for i in range(window, len(series), window):
        chunk = series[i - window : i]
        slope, _ = _linear_regression_slope(chunk)
        if abs(slope) > slope_threshold:
            direction = "upward" if slope > 0 else "downward"
            anomalies.append(
                Anomaly(
                    index=i,
                    value=chunk[-1],
                    reason=f"sustained {direction} drift, slope={slope:.3f}/sample over {window} samples",
                )
            )
    return anomalies


def _demo_series() -> list[float]:
    """Synthetic node-metric-like series: a stable baseline, one sudden
    spike (simulating a transient CPU burst), then a slow steady leak
    (simulating unbounded cache growth) — exercising both detectors.
    """
    import random

    random.seed(7)
    series: list[float] = []

    # 60 stable samples around 40% utilization, +/- small noise
    for _ in range(60):
        series.append(40.0 + random.uniform(-2.0, 2.0))

    # one sudden spike — a transient CPU burst
    series.append(95.0)
    for _ in range(5):
        series.append(41.0 + random.uniform(-2.0, 2.0))

    # a slow, steady leak: +0.8/sample for 40 samples, easy to miss with a
    # fixed 90% threshold, exactly the Ch 5 scenario
    base = 42.0
    for i in range(40):
        base += 0.8
        series.append(base + random.uniform(-1.0, 1.0))

    return series


def main() -> None:
    series = _demo_series()

    print(f"Analyzing {len(series)} synthetic samples...\n")

    z_anomalies = z_score_anomalies(series, window=20, threshold=3.0)
    print(f"z-score anomalies (spikes/drops): {len(z_anomalies)} found")
    for a in z_anomalies:
        print(f"  [{a.index}] value={a.value:.2f}  {a.reason}")

    print()

    trend_flags = trend_anomalies(series, window=30, slope_threshold=0.3)
    print(f"trend anomalies (sustained drift): {len(trend_flags)} found")
    for a in trend_flags:
        print(f"  [{a.index}] value={a.value:.2f}  {a.reason}")

    print()
    print("Sanity check: a detector that only used a fixed 90% threshold")
    print("would have caught the spike at index 60, but nothing in the")
    print("slow-leak region (indices 66-105) until it eventually crossed")
    print("90% -- by which point it is a page, not a ticket. That gap is")
    print("exactly what trend_anomalies() closes (learn5 Ch 5).")


if __name__ == "__main__":
    main()
