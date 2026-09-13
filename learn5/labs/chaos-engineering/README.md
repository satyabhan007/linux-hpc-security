# chaos-engineering — bare-metal node & fabric-link failure experiments

Matches learn5 Ch 9 (chaos engineering for bare-metal & HPC systems).

## Files

- **`experiment-oss-node-failure.yaml`** — kills one Lustre OSS node and
  validates I/O throughput degrades gracefully instead of catastrophically
  (Ch 9 Scenario A). Includes an explicit `rollback` section with its own
  recovery probe, per the Ch 9 anti-pattern fix "testing only the
  failure, never the recovery."
- **`experiment-fabric-link-failure.yaml`** — disables one InfiniBand
  fabric link and validates fat-tree redundancy actually reroutes traffic
  (Ch 9 Scenario B), including a probe specifically watching for
  black-holed traffic (the exact misconfigured-routing-table failure mode
  described in that scenario).

Both experiments share the same shape, deliberately:

- a **steady-state hypothesis** with a measurable tolerance, not a vibe
- an explicit, bounded **blast radius** (single node / single link, a
  scheduled non-peak window, named on-call notification targets, and
  written abort conditions) agreed *before* the experiment runs
- a **method** (the fault injection) and a separate **rollback** with its
  own success probe
- a **recurrence schedule**, because infrastructure drifts and a
  redundancy path validated once can silently break later

## Try it

```bash
python3 -c "import yaml, sys; [yaml.safe_load(open(f)) for f in sys.argv[1:]]; print('valid YAML')" \
  experiment-oss-node-failure.yaml experiment-fabric-link-failure.yaml

# or, matching this repo's CI exactly:
yamllint -d "{extends: relaxed, rules: {line-length: disable, truthy: disable}}" *.yaml
```

## Why this shape

These are written as tool-agnostic experiment *definitions* (readable as
design docs, translatable into a Chaos-Toolkit/Gremlin-style runner)
rather than as executable scripts against real hardware — the point of
this lab is the structure a real chaos experiment needs (hypothesis,
bounded blast radius, rollback-with-probe, recurrence), which this repo's
`chaos/` module builds on at the OS/service level and learn5 Ch 9 applies
at the node/fabric/filesystem layer.
