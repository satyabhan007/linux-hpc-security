#!/usr/bin/env python3
"""
HPC · Step 2 — ring MPI_Allreduce: correctness and why it scales.

Naive allreduce (everyone -> rank 0, sum, broadcast back) pushes O(P)
data through one link. The ring algorithm does a reduce-scatter around
the ring then an all-gather around the ring: 2*(P-1) messages of size
n/P, and its bandwidth term does NOT grow with P:

    T_naive ~ (P-1)*alpha + (P-1)*n*beta
    T_ring  ~ 2*(P-1)*alpha + 2*(P-1)*(n/P)*beta   (bandwidth ~ 2*n*beta, P-free)

We implement the real ring reduce-scatter + all-gather, check it is
bit-exact against the true sum, then compare the cost models.
"""

ALPHA = 1.0e-6         # per-message latency (s)  ~1 us on InfiniBand
BETA = 1.0 / 24e9      # per-byte time (s)        ~24 GB/s link
B = 8                  # bytes per FP64 element


def ring_allreduce(rank_arrays):
    P = len(rank_arrays)
    n = len(rank_arrays[0])
    assert n % P == 0
    csz = n // P
    # buf[r] = list of P chunks (each a list of csz floats)
    buf = [[list(rank_arrays[r][c * csz:(c + 1) * csz]) for c in range(P)]
           for r in range(P)]

    # ---- reduce-scatter: P-1 steps; after this rank r owns the fully
    #      reduced chunk (r+1) % P ----
    for step in range(P - 1):
        payloads = []
        for r in range(P):
            send_c = (r - step) % P
            payloads.append((r, (r + 1) % P, send_c, list(buf[r][send_c])))
        for src, dst, c, data in payloads:
            buf[dst][c] = [x + y for x, y in zip(buf[dst][c], data)]

    # ---- all-gather: P-1 steps; propagate each finished chunk around ----
    for step in range(P - 1):
        payloads = []
        for r in range(P):
            send_c = (r + 1 - step) % P
            payloads.append(((r + 1) % P, send_c, list(buf[r][send_c])))
        for dst, c, data in payloads:
            buf[dst][c] = data

    return [sum((chunks for chunks in rbuf), []) for rbuf in buf]


def cost_naive(P, n):
    return (P - 1) * ALPHA + (P - 1) * n * B * BETA


def cost_ring(P, n):
    return 2 * (P - 1) * ALPHA + 2 * (P - 1) * (n // P) * B * BETA


def main():
    P, n = 4, 12
    rank_arrays = [[(r + 1) * (i + 1) for i in range(n)] for r in range(P)]
    true_sum = [sum(rank_arrays[r][i] for r in range(P)) for i in range(n)]

    out = ring_allreduce(rank_arrays)
    for r in range(P):
        assert out[r] == true_sum, f"rank {r}: {out[r]} != {true_sum}"
    print(f"  ring allreduce P={P} n={n}: all ranks hold the exact sum ✓")
    print(f"  sum = {true_sum}")

    # bigger ring, random-ish data
    P, n = 8, 64
    ra = [[((r * 7 + i * 13) % 5) - 2 for i in range(n)] for r in range(P)]
    ts = [sum(ra[r][i] for r in range(P)) for i in range(n)]
    assert all(row == ts for row in ring_allreduce(ra))
    print(f"  ring allreduce P=8 n=64: bit-exact ✓")

    print(f"\n  {'P':>4}  {'n':>10}  {'naive':>11}  {'ring':>11}  {'speedup':>8}")
    for P, n in [(8, 1_000_000), (64, 1_000_000), (512, 1_000_000), (512, 64_000_000)]:
        tn, tr = cost_naive(P, n), cost_ring(P, n)
        print(f"  {P:>4}  {n:>10}  {tn*1e3:>9.2f}ms  {tr*1e3:>9.2f}ms  {tn/tr:>7.1f}x")

    bw64 = 2 * (64 - 1) * (1_000_000 // 64) * B * BETA
    bw512 = 2 * (512 - 1) * (1_000_000 // 512) * B * BETA
    assert abs(bw64 - bw512) / bw64 < 0.05, "ring bandwidth term must be ~P-independent"
    assert cost_naive(512, 1_000_000) > 20 * cost_ring(512, 1_000_000)

    print("\nPASS — ring allreduce is bit-exact; its bandwidth cost barely moves with P.")


if __name__ == "__main__":
    main()
