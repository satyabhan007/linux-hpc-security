# HPC Benchmarking — Interview Q&A

---

## Concepts

**Q: HPL vs HPCG — what does each measure and why do rankings differ?**
HPL solves a dense linear system — cache/FLOP-friendly, hits near peak
FP64, and is the Top500 metric. HPCG runs a sparse multigrid CG —
memory-bandwidth and communication bound, close to real scientific
codes. A FLOP-rich machine can lead Top500 but trail on HPCG.

**Q: What does STREAM measure and what's a "good" result?**
Sustainable main-memory bandwidth (`a[i]=b[i]+s*c[i]`, the Triad
kernel). Good ≈ 75–85% of the theoretical DIMM bandwidth; below that
suggests a throttled/underclocked DIMM, unpopulated channels, or a power
governor issue.

**Q: Explain the roofline model.**
Plot achievable GFLOP/s vs arithmetic intensity (FLOP/byte). Two
ceilings: slanted `bandwidth × intensity` (memory bound) and flat peak
compute. A kernel sits at its intensity; the lower ceiling is its limit.
Ridge point = peak_compute / bandwidth.

**Q: A kernel at intensity 0.5 FLOP/byte — is it memory or compute
bound? What helps?**
Memory bound (well left of the ridge on any real machine). Only more
bandwidth or better data reuse (cache blocking, loop fusion, higher
intensity algorithm) helps; faster FMA units do nothing.

**Q: Arithmetic intensity of dense GEMM vs SpMV — roughly?**
GEMM: O(N) reuse → intensity scales with block size, easily 8–50+
FLOP/byte (compute bound). SpMV: ~0.1–0.25 FLOP/byte (always memory
bound).

---

## Scaling

**Q: State Amdahl's law and its limit.**
`speedup(N) = 1 / (s + (1-s)/N)`, where `s` is the serial fraction. As
N→∞, speedup → 1/s. So 5% serial caps strong scaling at 20×.

**Q: Amdahl vs Gustafson?**
Amdahl: fixed problem size (strong scaling) — serial fraction dominates
at scale. Gustafson: problem grows with N (weak scaling) — if the serial
part stays constant, scaled speedup ≈ `s + (1-s)N`, near linear.

**Q: Strong vs weak scaling — how do you run each?**
Strong: hold total problem size, vary rank count, plot speedup and
efficiency. Weak: hold *work per rank* constant, grow the global problem
with rank count, plot time-to-solution (ideally flat).

**Q: What is parallel efficiency and why report it instead of speedup?**
`efficiency = speedup / N`. Speedup can look impressive (40×) while
efficiency is terrible (16% on 256 nodes). Efficiency shows when you're
wasting nodes.

**Q: Your scaling curve has a knee at 128 nodes. Prime suspects?**
Collective cost (`MPI_Allreduce` growing with N), load imbalance,
blocking halo exchange, a fixed serial I/O phase, or fabric
oversubscription once the job spans multiple racks.

---

## HPL sizing (back-of-envelope)

**Q: Size HPL N for 64 nodes × 512 GiB.**
usable ≈ 64 × 512 GiB × 0.8 = ~1.68e13 bytes; `N = sqrt(1.68e13 / 8)`
≈ **1.45 million**, rounded down to a multiple of NB (~232). Grid
8×8, one rank per node.

**Q: Why round N to a multiple of NB, and pick a square P×Q?**
NB is the panel/block size; N a multiple of it avoids ragged edge
blocks. A square grid minimises the communication volume in the
panel broadcast and row/column exchanges.

**Q: HPL efficiency is 55%. Three things to check.**
N too small (raise to ~85–90% RAM), NB not matched to the BLAS,
unpinned threads / wrong rank×thread layout. Then `HPL.dat` BCAST/DEPTH
and turbo/power/cooling.

**Q: FLOP count for HPL?**
`(2/3)N³ + 2N²`. Training-style "6·P·T" is for neural nets, not HPL —
don't mix them.

---

## Interconnect & storage micro-benchmarks

**Q: What does OSU `osu_latency` measure, and a good intra-rack number?**
Half-round-trip latency of an MPI message between two ranks. Modern
InfiniBand: ~1 µs for small messages intra-rack. 20–30 µs means it fell
back to the TCP path.

**Q: `osu_bw` vs `osu_bibw`?**
Uni-directional vs bi-directional bandwidth. `osu_bibw` should approach
~2× the link rate on a full-duplex fabric.

**Q: IOR — what knobs matter for a meaningful number?**
Transfer size (≥ 1 MiB, stripe-aligned), block size, `-F`
(file-per-process) vs shared file, `-C` (reorder to defeat client
cache), collective vs independent MPI-IO, and enough ranks to saturate
the servers. Report both write and read.

**Q: mdtest — what does it stress and why separately from IOR?**
Metadata: create/stat/unlink rates. It's a different bottleneck (the
MDS, Module 10) than data bandwidth (the OSTs), so you measure it on its
own.

**Q: fio vs IOR?**
fio = block-device / single-node filesystem I/O (IOPS, latency,
queue depth). IOR = parallel, multi-node, MPI-coordinated filesystem
throughput at scale.

---

## Methodology

**Q: Someone hands you "our cluster does 3 PFLOP/s". What do you ask?**
Which benchmark (HPL? HPCG? mixed precision?), at what efficiency
(Rmax/Rpeak), on how many nodes, with what precision, and how does it do
on STREAM and OSU. One number without context is marketing.

**Q: How many times do you run a benchmark and what do you report?**
At least 5 (ideally ~11), discard the warm-up, report **median and
spread** (MAD or min/max), never the single best. And the full
provenance: firmware, kernel, compiler flags, MPI, libraries.

**Q: Why pin frequency before benchmarking?**
Turbo boost varies with temperature, neighbouring cores, and power
budget, adding run-to-run noise and making before/after comparisons
meaningless. Fix it (or at least record `turbostat` per run).

**Q: You changed a kernel tunable and the benchmark improved 3%. Is it
real?**
Only if 3% is outside the run-to-run spread you measured, with the same
provenance, on the same nodes, and it reproduces. Otherwise it's noise.

**Q: Why run acceptance benchmarks on *every* node, not a sample?**
A single degraded node (bad DIMM, throttling, wrong BIOS) averages away
in a fleet number but becomes the slowest rank — and thus the whole
job's speed — in every MPI job that lands on it.
