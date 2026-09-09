# HPC Benchmarking — The Amateur's Guide

> Every benchmark measures exactly one thing, and the vendor quotes the
> flattering one. Judging a machine by its HPL score is judging a car by
> its 0–60 time — impressive, and possibly irrelevant to your commute.

---

## 1. Why benchmark at all

- **Acceptance testing** — did the vendor deliver what the contract says?
- **Sizing** — how big a problem fits, how long will it take?
- **Tuning** — did that change help or hurt? (need a stable before/after)
- **Regression** — is node 347 secretly 15% slow?

A benchmark is a **known workload under controlled conditions** producing
**one comparable number**. The discipline is in the "controlled" part.

---

## 2. The core benchmarks and what each proves

| Benchmark | Measures | Bound by |
|---|---|---|
| **HPL** (LINPACK) | dense FP64 (LU solve) | peak FLOPs — the Top500 number |
| **HPCG** | sparse conjugate gradient | memory bandwidth + comms — "real science" floor |
| **STREAM** | `a[i] = b[i] + s*c[i]` | sustainable memory bandwidth (GB/s) |
| **OSU / IMB** | MPI pingpong, collectives | interconnect latency (µs) & bandwidth |
| **IOR** | parallel file I/O | filesystem read/write GB/s at scale |
| **mdtest** | file create / stat / unlink | metadata ops/s |
| **fio** | block-device I/O | IOPS, latency of a device or mount |
| **HPL-MxP / HPL-AI** | mixed-precision solve | tensor-core / low-precision peak |

**Analogy — a gym assessment.** HPL is a one-rep max (raw power).
STREAM is carrying groceries up stairs all day (sustained throughput).
OSU latency is your reaction time. IOR is how fast the whole team moves
boxes through one doorway.

> Many real machines get **1–3% of their HPL number on HPCG**. That gap
> is the difference between "peak FLOPs" and "what your solver sees".

---

## 3. STREAM and the memory wall

Most HPC codes are **memory-bandwidth bound**: a modern core can do far
more arithmetic than the memory system can feed it operands for. STREAM
Triad reports the number that actually caps them. Healthy sustained
bandwidth is **~75–85% of the DIMM spec** — below that, look for a
throttled DIMM, wrong channel population, or a `powersave` governor.

---

## 4. The roofline model — one chart that explains performance

- **x-axis:** *arithmetic intensity* = FLOPs per byte moved from DRAM.
- **y-axis:** achievable GFLOP/s.
- **Slanted ceiling:** `bandwidth × intensity` (memory bound).
- **Flat ceiling:** peak compute (compute bound).
- **Ridge point:** `peak_compute / bandwidth` — where you cross over.

Your kernel sits at its intensity; whichever ceiling is lower is your
limit.

- Low intensity (stencils, SpMV, BLAS-1, `a=b+c`): **left of the ridge**
  → buy bandwidth or improve data reuse (blocking, fusion).
- High intensity (dense GEMM, N-body, BLAS-3): **right of the ridge** →
  you can actually use those FLOPs; faster compute helps.

**"We added GPUs and it barely got faster"** = the code lived at
intensity ~0.5, memory-bound. The GPU raised a ceiling nobody was
touching. (Lab: `step2_stream_roofline.py`.)

---

## 5. Scaling: strong vs weak

**Strong scaling** — fixed problem, more ranks. Bounded by **Amdahl**:

```
speedup(N) ≤ 1 / (s + (1-s)/N)   →   ≤ 1/s   as N → ∞
```

5% serial ⇒ **20× maximum**, no matter the node count.

**Weak scaling** — grow the problem *with* the ranks. **Gustafson**:
near-linear if the serial part doesn't grow.

Always report **efficiency** = `speedup / N`, and always plot it. The
knee in the curve is almost always communication (halo exchange,
`MPI_Allreduce`) or load imbalance.

**Analogy.** Nine women can't make a baby in one month (Amdahl — some
work is serial). Nine women *can* have nine babies in nine months
(Gustafson — scale the problem, not the schedule).

(Lab: `step3_amdahl_scaling.py`.)

---

## 6. HPL problem sizing (the interview favourite)

```
matrix bytes  = 8 × N²          (FP64)
target        ≈ 80% of usable RAM
N             = floor( sqrt(0.80 × usable_bytes / 8) ), rounded to a multiple of NB
P × Q         ≈ as square as possible, P ≤ Q, one rank per node (threads inside)
NB            192–256 on modern CPUs
```

Bigger N → higher efficiency (Rmax/Rpeak), until it doesn't fit.
(Lab: `step1_hpl_problem_size.py`.)

---

## 7. Methodology — a result without one is a rumour

- Pin frequency; disable turbo drift if you need determinism; **record**
  the actual clock.
- Bind processes (Module 12) and report the map.
- Warm caches, or explicitly measure cold — say which.
- Run ≥ 5 times; report **median + spread**, not the best.
- Hold the node **exclusively**.
- Capture: BIOS/firmware, microcode, kernel, compiler + flags, MPI, math
  library, OFED/fabric versions.
- For a new cluster: **run the whole fleet** — one slow node hides in an
  average and shows up as a straggler in every job for years.

---

## 8. Run the labs

```bash
python3 benchmarking/step1_hpl_problem_size.py   # size HPL N, P×Q, runtime
python3 benchmarking/step2_stream_roofline.py    # roofline: classify each kernel's ceiling
python3 benchmarking/step3_amdahl_scaling.py     # strong vs weak scaling curves
```

Next: **`ebpf/`** — measuring what a running kernel is doing, live, with
almost no overhead.
