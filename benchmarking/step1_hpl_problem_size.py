#!/usr/bin/env python3
"""
Benchmarking · Step 1 — size an HPL run (the Top500 number).

HPL solves a dense N x N linear system in FP64. The run is memory-bound
in the sense that you want N as large as possible while the matrix (plus
working space) still fits in RAM, because efficiency (Rmax/Rpeak) rises
with N. Rules of thumb the whole field uses:

  bytes for the matrix   = 8 * N^2            (FP64)
  target                 ~ 80% of usable RAM  (leave room for OS, MPI, panels)
  =>  N  = floor( sqrt(0.80 * usable_bytes / 8) )   , rounded to a multiple of NB
  P x Q  grid            ~ as square as possible, P <= Q
  NB (block size)        192-256 on modern CPUs

This computes all of that and a rough runtime from an assumed efficiency.
"""
import math

GiB = 1024 ** 3


def hpl_plan(nodes, mem_gib_per_node, cores_per_node,
             gflops_per_core=48.0, nb=232, mem_fraction=0.80, eff=0.80):
    usable_bytes = nodes * mem_gib_per_node * GiB * mem_fraction
    n_raw = math.sqrt(usable_bytes / 8.0)
    n = int(n_raw // nb) * nb                      # round DOWN to a multiple of NB

    # process grid: one MPI rank per node (threads inside), P x Q ~ square
    ranks = nodes
    p = int(math.isqrt(ranks))
    while ranks % p:
        p -= 1
    q = ranks // p
    if p > q:
        p, q = q, p

    rpeak = nodes * cores_per_node * gflops_per_core / 1000.0     # TFLOP/s
    rmax = rpeak * eff
    # HPL FLOPs = 2/3 N^3 + 2 N^2
    flop = (2.0 / 3.0) * n ** 3 + 2.0 * n ** 2
    runtime_s = flop / (rmax * 1e12)

    return {
        "N": n, "NB": nb, "P": p, "Q": q, "ranks": ranks,
        "matrix_GiB": 8 * n ** 2 / GiB,
        "mem_used_pct": 100 * (8 * n ** 2) / (nodes * mem_gib_per_node * GiB),
        "Rpeak_TF": rpeak, "Rmax_TF": rmax, "runtime_min": runtime_s / 60,
    }


def main():
    scenarios = [
        ("single fat node", 1, 512, 96),
        ("small cluster",   16, 256, 128),
        ("64 x 512 GiB",    64, 512, 96),
    ]
    print(f"{'scenario':>16}  {'N':>8}  {'PxQ':>7}  {'matrix':>9}  {'RAM%':>5}  "
          f"{'Rpeak':>8}  {'Rmax':>8}  {'~run':>7}")
    plans = {}
    for name, nodes, mem, cores in scenarios:
        pl = hpl_plan(nodes, mem, cores)
        plans[name] = pl
        print(f"{name:>16}  {pl['N']:>8}  {pl['P']}x{pl['Q']:<5}  "
              f"{pl['matrix_GiB']:>7.1f}G  {pl['mem_used_pct']:>4.0f}%  "
              f"{pl['Rpeak_TF']:>6.1f}TF  {pl['Rmax_TF']:>6.1f}TF  {pl['runtime_min']:>5.0f}m")

    big = plans["64 x 512 GiB"]

    # sanity: matrix must fit and be ~80% of RAM, N a multiple of NB, P<=Q
    assert big["mem_used_pct"] < 82 and big["mem_used_pct"] > 70
    assert big["N"] % big["NB"] == 0
    assert big["P"] <= big["Q"] and big["P"] * big["Q"] == big["ranks"]

    # hand check: 64 * 512 GiB * 0.8 / 8 bytes -> N ~ sqrt(1.759e12) ~ 1.326e6
    hand_N = int(math.sqrt(64 * 512 * GiB * 0.8 / 8) // 232) * 232
    assert big["N"] == hand_N

    # doubling nodes at fixed mem/node: N grows ~sqrt(2), runtime grows ~sqrt(2)^3/2
    p32 = hpl_plan(32, 512, 96)
    ratio = big["N"] / p32["N"]
    assert 1.3 < ratio < 1.5, f"N should scale ~sqrt(2) with node count, got {ratio:.2f}"

    print("\nPASS — HPL N sized to ~80% RAM, rounded to NB, on a square-ish P x Q grid.")


if __name__ == "__main__":
    main()
