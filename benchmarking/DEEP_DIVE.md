# HPC Benchmarking — Deep Dive: Production Scenarios

---

## Scenario 1 — New cluster acceptance: 4% of nodes are slow

**Setup.** 240-node delivery. Acceptance criteria (agreed *before*
delivery): per-node STREAM Triad ≥ 85% of theoretical, HPL within 3% of
the vendor quote, OSU latency ≤ 1.1 µs intra-rack, IOR ≥ 80% of the
storage spec.

**Finding.** Whole-cluster HPL is 2% under quote — passes. But a per-node
STREAM sweep shows 9 nodes at 78–82% while the rest hit 94–96%.

**Diagnosis, in order of frequency.**
1. **Thermal throttling** — dusty heatsink / failed fan. `turbostat`
   shows the core clock sagging under load; `dmesg` may have
   `CPU throttled`. IPMI fan RPM / inlet temp.
2. **A DIMM at a lower speed** — `dmidecode -t 17` shows one channel at
   4400 MT/s instead of 4800. STREAM drops ~1/6.
3. **Governor** left on `powersave` — `cpupower frequency-info`.
4. **Firmware/microcode skew** — `dmidecode -t bios`, `grep microcode
   /proc/cpuinfo`.
5. **Wrong NUMA / SNC (Sub-NUMA Clustering)** BIOS setting on a subset.

**Fix + prevent.** Swap/reseat DIMMs, clean cooling, standardise BIOS
via Redfish, bake governor into the image. Add a **per-node STREAM +
HPL-single-node** gate to the Warewulf image acceptance (Module 7) and
run it after every physical touch. One slow node = a straggler in every
MPI job it lands in, forever, until someone measures per-node.

---

## Scenario 2 — "The code doesn't scale past 128 nodes"

**Symptom.** Speedup plateaus at ~40× on 128 nodes, then *drops* at 256.

**Investigate.**
```bash
# is it Amdahl (serial fraction) or comms?
# 1. profile the serial part
export SLURM_CPU_BIND=verbose
# 2. MPI profiling
mpirun -np ... -x LD_PRELOAD=libmpiP.so ./app        # mpiP report: % time in MPI, per-call
# or Score-P / Extrae / TAU / Caliper
```

**Common root causes.**
- **`MPI_Allreduce` in the inner loop** — cost grows with rank count;
  batch reductions, use non-blocking (`MPI_Iallreduce`) and overlap.
- **Load imbalance** — one rank's subdomain has all the work; the
  Allreduce waits for the slowest. Check per-rank time in the trace.
- **Halo exchange** blocking — switch to `MPI_Isend/Irecv` + compute
  interior while boundaries transfer.
- **Fixed serial I/O** at start/end (rank 0 reads the whole mesh) —
  parallel I/O (Module 10).
- **Fabric oversubscription** (Module 9) — at 256 nodes the job spans
  more racks and hits the 2:1 leaf-to-spine cut.

**Framing.** Plot **efficiency**, fit the Amdahl `s`. If `s ≈ 0.02`,
the theoretical cap is 50× — you're near it, and more nodes is the wrong
move. Switch to weak scaling (bigger science per node) if the problem
allows.

---

## Scenario 3 — HPL runs but efficiency is 55% (vendor says 80%)

**Checklist.**
- **N too small.** Bump to ~85–90% RAM; efficiency rises with N.
- **NB wrong.** Try 192, 224, 256; match the math-library sweet spot
  (MKL/BLIS/AOCL/OpenBLAS differ).
- **P×Q not square-ish.** `P ≤ Q`, close to square (16×16 beats 4×64).
- **BCAST / DEPTH / RFACT** tuning in `HPL.dat` — `BCAST=2` (2-ring),
  `DEPTH=1`, `PFACT`/`RFACT` = right-looking.
- **Threads vs ranks.** 1 rank/socket or 1 rank/node with
  `OMP_NUM_THREADS` = cores; **pin** them (Module 12). Unpinned HPL
  loses 10–30%.
- **Turbo / power cap.** Uncapped, `performance` governor, adequate
  cooling for a sustained all-core AVX load.
- **Math library** actually threaded and using AVX-512/AMX
  (`MKL_VERBOSE=1`).

---

## Scenario 4 — STREAM number is half the spec

**Likely causes.**
- Only running 1 thread — STREAM needs one thread **per memory
  controller / channel group**, pinned, first-touch (Module 12).
- Compiled without `-O3 -march=native` and non-temporal stores.
- `numactl --interleave` missing on a run that spans sockets, or the
  opposite (want `--localalloc` + per-thread first touch).
- DIMMs not populating all channels (`dmidecode -t 17`), or mixed
  ranks/speeds.
- Array too small — fits in LLC, so you're measuring cache, not DRAM
  (STREAM array should be ≥ 4× LLC).

---

## Scenario 5 — Benchmark numbers are noisy, ±15% run to run

**Sources of variance, and fixes.**
| Source | Fix |
|---|---|
| Turbo/frequency drift | fix frequency, record it; `intel_pstate=disable` or set `scaling_max_freq` |
| C-state wakeup latency | `cpupower idle-set -D 0` / `intel_idle.max_cstate=1` on the run cores |
| Noisy neighbours | exclusive node allocation (`--exclusive`), drop caches between runs deliberately |
| THP compaction | `THP=never` for the benchmark |
| NUMA auto-balancing | `kernel.numa_balancing=0` |
| Not enough samples | ≥ 5–11 runs, report median + MAD, discard the first (warm-up) |
| Filesystem cache state | `echo 3 > drop_caches` before I/O benchmarks; or measure warm explicitly |

---

## A minimal, honest benchmark harness

```bash
#!/bin/bash
#SBATCH --exclusive -N 1 -t 00:30:00
set -euo pipefail

# provenance
{ date -u; hostname; cat /proc/cmdline
  dmidecode -t bios -t processor -t memory | grep -E 'Version|Speed|Manufacturer'
  cpupower frequency-info | grep -E 'current|governor'
  grep -m1 microcode /proc/cpuinfo
  module list 2>&1 || true
} > provenance.txt

# fix the environment
sudo cpupower frequency-set -g performance >/dev/null || true
echo 3 | sudo tee /proc/sys/vm/drop_caches >/dev/null

# 11 runs, median reported by the analysis script
for i in $(seq 1 11); do
  numactl --cpunodebind=0 --membind=0 ./stream_c.exe
done | tee stream_runs.txt
```

Report: median ± spread, the provenance file, and the exact command.
Anything less is not reproducible.
