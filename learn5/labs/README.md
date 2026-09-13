# Part 5 · labs — runnable configs

> Standard tools, at production depth. Every file here is validated in CI
> (`.github/workflows/lab-tests.yml`).

Five subdirectories, each mapped to specific chapters in `../assets/ch/`:

- **[`observability/`](observability/)** — a node_exporter + Prometheus
  scrape config for a bare-metal/HPC fleet, plus PromQL alerting rules
  (staleness, rolling-baseline drift, multi-window SLO burn-rate). Ch 1,
  5, 7, 9, 12, 15.
- **[`log-pipeline/`](log-pipeline/)** — a Splunk-style ingestion/indexing
  config (`indexes.conf`, `props.conf`, `inputs.conf`) with per-index
  retention tiering, plus a Kafka buffer topic config. Ch 2, 3.
- **[`anomaly-detection/`](anomaly-detection/)** — a zero-dependency
  Python rolling-baseline anomaly detector (z-score + trend/drift
  detection), matching this repo's `encrypted-anomaly`/`fraud-detection`
  labs. Ch 5, 12.
- **[`chaos-engineering/`](chaos-engineering/)** — two chaos-experiment
  definitions (an OSS node failure, an InfiniBand fabric-link failure)
  with steady-state hypotheses, bounded blast radius, and rollback
  probes. Ch 9, 15.
- **[`postmortem/`](postmortem/)** — a blameless-postmortem template and
  a burn-rate alert example for citing in a postmortem timeline. Ch 7, 8,
  14, 16.

Each subdirectory has its own README with a "try it" section showing how
to validate/run that lab's files locally.
