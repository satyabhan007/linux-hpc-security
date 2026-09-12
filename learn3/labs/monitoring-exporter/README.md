# Prometheus Slurm job-efficiency exporter config

Companion to Chapter 13 (`learn3/`). A Prometheus scrape configuration
wiring up a `slurm-exporter`-style job-efficiency exporter and NVIDIA's
DCGM exporter, plus an alerting rules file that turns Chapter 4's fabric
error counters and Chapter 13's efficiency metrics into actual pages
instead of dashboards nobody watches.

## Files

- `prometheus-scrape.yml` — scrape config for `slurm-exporter` (cluster
  queue/scheduler metrics) and `dcgm-exporter` (per-GPU utilization) on
  every compute node.
- `alerts.yml` — Prometheus alerting rules: a climbing InfiniBand
  `SymbolErrorCounter` (Chapter 4), a job-efficiency anti-pattern
  (allocated-but-idle GPUs), and a `slurmctld` liveness gap (Chapter 15's
  lesson — alert on missing job-state transitions, not just process
  uptime).

## Try it

```bash
# validate syntax only (this lab does not run a live Prometheus):
promtool check config prometheus-scrape.yml
promtool check rules alerts.yml
```

Read alongside [Chapter 13](../../#ch13) for why per-job efficiency
telemetry (not just up/down monitoring) is the metric that actually
answers "is this cluster being used well," and
[Chapter 15](../../#ch15) for why the `slurmctld` alert here checks job
dispatch activity specifically, not just process liveness.
