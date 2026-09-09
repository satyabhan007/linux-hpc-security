#!/usr/bin/env python3
"""
Benchmarking · Step 2 — STREAM, the memory wall, and the roofline model.

STREAM measures sustainable memory bandwidth with a[i] = b[i] + s*c[i].
The roofline model then predicts the best a kernel can do:

    attainable GFLOP/s = min( peak_compute , bandwidth * arithmetic_intensity )

arithmetic_intensity (AI) = FLOPs performed per byte moved from DRAM.
The "ridge point" AI* = peak_compute / bandwidth is where a kernel stops
being memory-bound and starts being compute-bound. Most HPC kernels sit
to the LEFT of the ridge => bandwidth, not FLOPs, is the ceiling.
"""

# a representative 2-socket node
PEAK_GFLOPS = 2400.0        # FP64 peak (with AVX-512 FMA)
STREAM_GBS = 320.0          # measured sustainable bandwidth (Triad)
DRAM_GBS_THEORY = 410.0     # spec bandwidth; STREAM ~78% of it is normal

RIDGE_AI = PEAK_GFLOPS / STREAM_GBS   # FLOP/byte

KERNELS = [
    # name, arithmetic intensity (FLOP/byte), note
    ("STREAM Triad",        0.083, "2 FLOP / 24 bytes"),
    ("7-pt stencil",        0.42,  "classic memory-bound PDE"),
    ("SpMV (CSR)",          0.20,  "sparse matvec — always bandwidth bound"),
    ("dense GEMM (blocked)", 8.0,  "BLAS-3, high reuse"),
    ("N-body direct",       30.0,  "O(n^2), compute bound"),
]


def attainable(ai):
    mem_bound = STREAM_GBS * ai
    return min(PEAK_GFLOPS, mem_bound), ("compute" if mem_bound >= PEAK_GFLOPS else "memory")


def main():
    global PEAK_GFLOPS, STREAM_GBS
    print(f"peak compute : {PEAK_GFLOPS:8.0f} GFLOP/s")
    print(f"STREAM Triad : {STREAM_GBS:8.0f} GB/s   "
          f"({100*STREAM_GBS/DRAM_GBS_THEORY:.0f}% of spec — healthy is 75-85%)")
    print(f"ridge point  : AI* = {RIDGE_AI:.2f} FLOP/byte  "
          f"(kernels below this are memory bound)\n")

    print(f"{'kernel':>20}  {'AI':>6}  {'attainable':>11}  {'bound':>8}  {'% of peak':>9}")
    bounds = {}
    for name, ai, note in KERNELS:
        perf, bound = attainable(ai)
        bounds[name] = bound
        print(f"{name:>20}  {ai:>6.2f}  {perf:>9.0f}GF  {bound:>8}  "
              f"{100*perf/PEAK_GFLOPS:>7.1f}%   ({note})")

    # the STREAM-limited kernels can't be helped by faster FMA units
    assert bounds["STREAM Triad"] == "memory"
    assert bounds["7-pt stencil"] == "memory"
    assert bounds["SpMV (CSR)"] == "memory"
    assert bounds["dense GEMM (blocked)"] == "compute"
    assert bounds["N-body direct"] == "compute"

    # a memory-bound kernel: doubling peak FLOPs changes nothing
    stencil_ai = 0.42
    before, _ = attainable(stencil_ai)

    PEAK_GFLOPS *= 2
    after, _ = attainable(stencil_ai)
    assert abs(before - after) < 1e-6, "faster compute must not help a memory-bound kernel"
    PEAK_GFLOPS /= 2

    # ...but doubling bandwidth doubles it

    STREAM_GBS *= 2
    after_bw, _ = attainable(stencil_ai)
    assert abs(after_bw - 2 * before) < 1e-6
    STREAM_GBS /= 2

    print("\n  this is why 'we added GPUs and it barely sped up' happens: the code")
    print("  lived left of the ridge, and only the bandwidth ceiling mattered.")
    print("\nPASS — roofline correctly classifies every kernel and its true ceiling.")


if __name__ == "__main__":
    main()
