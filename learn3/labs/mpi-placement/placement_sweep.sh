#!/usr/bin/env bash
#SBATCH --job-name=placement-sweep
#SBATCH --nodes=4
#SBATCH --ntasks=64
#SBATCH --time=00:30:00
#SBATCH --output=results/placement_sweep_%j.out
#
# Part 3 lab — MPI placement benchmark sweep (Chapter 3)
#
# Runs the same benchmark under every combination of --cpu-bind and
# --distribution in the matrices below, so the actually-fastest placement
# for THIS application on THIS cluster is measured, not assumed. Results
# land in results/placement_sweep_<jobid>.csv as "cpu_bind,distribution,
# seconds".
#
# Point BENCH_BIN at a real MPI benchmark (e.g. an OSU micro-benchmark,
# or your own application binary compiled against the site's MPI) before
# submitting for real use.

set -euo pipefail

BENCH_BIN="${BENCH_BIN:-./bench_placeholder}"
RESULTS_DIR="results"
JOB_ID="${SLURM_JOB_ID:-manual}"
RESULTS_FILE="${RESULTS_DIR}/placement_sweep_${JOB_ID}.csv"

mkdir -p "${RESULTS_DIR}"
echo "cpu_bind,distribution,seconds" > "${RESULTS_FILE}"

CPU_BIND_OPTS=(cores sockets none)
DISTRIBUTION_OPTS=(block:block block:cyclic cyclic:cyclic)

if [ ! -x "${BENCH_BIN}" ]; then
  echo "warning: ${BENCH_BIN} not found/executable — using 'sleep 1' as a placeholder" >&2
  BENCH_BIN="sleep 1"
fi

for cpu_bind in "${CPU_BIND_OPTS[@]}"; do
  for distribution in "${DISTRIBUTION_OPTS[@]}"; do
    echo "== cpu-bind=${cpu_bind} distribution=${distribution} =="
    start_ts=$(date +%s.%N)

    # shellcheck disable=SC2086
    srun --cpu-bind="${cpu_bind}" --distribution="${distribution}" ${BENCH_BIN}

    end_ts=$(date +%s.%N)
    elapsed=$(awk -v a="${start_ts}" -v b="${end_ts}" 'BEGIN { printf "%.3f", b - a }')
    echo "${cpu_bind},${distribution},${elapsed}" >> "${RESULTS_FILE}"
  done
done

echo "Done. Results: ${RESULTS_FILE}"
