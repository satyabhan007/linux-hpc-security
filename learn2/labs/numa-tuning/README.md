# NUMA-aware tuning — binding and reporting

Companion lab for Ch3 (NUMA topology & NUMA-aware tuning).

## Files

- **`run-numa-bound.sh`** — wraps `numactl --hardware` (show topology) plus
  `numactl --cpunodebind=<n> --membind=<n>` (bind both CPU and memory to one
  node) around launching a command. Directly implements the fix for Ch3's
  "taskset-without-membind trap": CPU affinity alone is not enough, memory
  policy has to be pinned too.
- **`numa-report.sh`** — wraps `numastat -p <pid>` / `numastat -c <pid>` to
  show whether a running process's memory accesses are landing local
  (`numa_hit`) or remote (`numa_foreign`/`numa_miss`) — the diagnostic used
  in Ch3's "new HPC node, mysterious 30% slowdown" scenario.

## Usage

```
./run-numa-bound.sh 0 -- ./latency_sensitive_app --port 8080
./numa-report.sh "$(pgrep -f latency_sensitive_app)"
```

## Notes on validation

Both scripts require `numactl`/`numastat` (the `numactl` package) and a
NUMA-capable host to do anything meaningful; on a single-node/non-NUMA
sandbox they will run but show a trivial one-node topology. Both are
syntax-checked with `bash -n` and hand-reviewed for `shellcheck`-style
cleanliness as part of this repository's CI.
