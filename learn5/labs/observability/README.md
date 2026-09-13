# observability — node_exporter + Prometheus + Grafana stack config

Matches learn5 Ch 1 (fleet-wide observability), Ch 5 (anomaly detection),
Ch 7 (SLOs & error budgets), and Ch 9/15 (the Lustre OST latency drift used
in the chaos-engineering and case-study chapters).

## Files

- **`prometheus.yml`** — a scrape config for a bare-metal/HPC fleet: node
  metrics, GPU metrics (dcgm), Lustre OSS/MDS metrics, and InfiniBand fabric
  counters, each as its own job so alerts and dashboards can group by role
  (`storage`, `fabric`, `compute`) instead of only by hostname.
- **`alerts.rules.yml`** — two rule groups:
  - `fleet-health`: a staleness alert (`up == 0`, the Ch 1 anti-pattern
    fix), a rolling-baseline memory-leak trend detector (`predict_linear`,
    Ch 5), and a rolling-baseline Lustre OST latency-drift alert (the
    metric the Ch 15 case study shows a fixed threshold missing).
  - `slo-burn-rate`: a fast-burn (1h+5m window) and slow-burn (6h+30m
    window) multi-window burn-rate alert against a 99.9% availability SLO,
    per Ch 7/Ch 8.

## Try it

```bash
# validate the config against a real Prometheus binary (not required for
# this repo's CI, which lints YAML syntax/structure only):
promtool check config prometheus.yml
promtool check rules alerts.rules.yml
```

## Why this shape

A single `node_exporter` job with no role labels cannot tell you "is
storage or fabric the bottleneck" (Ch 12) or "which alert group should page
which team" (Ch 8) — the job-per-exporter-type-plus-role-label pattern here
is what makes both of those questions answerable directly in PromQL instead
of requiring a human to cross-reference a spreadsheet of hostnames.
