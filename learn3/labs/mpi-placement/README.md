# MPI placement benchmark sweep

Companion to Chapter 3 (`learn3/`). A Slurm `sbatch` script that submits
the same MPI benchmark repeatedly across a matrix of `--cpu-bind` and
`--distribution` combinations, so a real cluster's actual best placement
policy can be determined empirically rather than assumed.

## Files

- `placement_sweep.sh` — an `sbatch` job script. Loops over a small
  matrix of `--cpu-bind` (`cores`, `sockets`, `none`) and `--distribution`
  (`block:block`, `block:cyclic`, `cyclic:cyclic`) combinations, running
  each with `srun` against a placeholder benchmark binary, and appends a
  timed result line per combination to a results file for comparison.

## Try it

```bash
# edit BENCH_BIN below to point at a real MPI benchmark (e.g. an OSU
# micro-benchmark or your own application binary) before submitting.
sbatch placement_sweep.sh

# after it completes:
sort -k4 -n results/placement_sweep_${SLURM_JOB_ID}.csv | column -s, -t
```

Read alongside [Chapter 3](../../#ch3) — the point isn't that any one
combination is universally best, it's that the *measured* fastest
combination for your actual application and cluster should be the one
that ends up in production job scripts, not a guess.
