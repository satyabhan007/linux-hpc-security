#!/usr/bin/env python3
"""
Benchmarking · Step 3 — strong scaling (Amdahl) vs weak scaling (Gustafson).

Strong scaling: fixed total problem, add ranks.
    speedup(N) = 1 / ( s + (1 - s)/N )         -> capped at 1/s as N->inf

Weak scaling: grow the problem with the ranks (fixed work per rank).
    scaled_speedup(N) = s + (1 - s) * N        -> near-linear if s constant

We also add a communication term (a real curve bends because Allreduce
cost grows), then report parallel efficiency and the "stop adding nodes"
point where efficiency falls below 50%.
"""

def amdahl(s, N):
    return 1.0 / (s + (1.0 - s) / N)


def amdahl_with_comm(s, N, comm_coeff):
    # comm grows like log2(N) (tree Allreduce); expressed as a fraction of
    # the original serial runtime
    comm = comm_coeff * (N.bit_length())
    return 1.0 / (s + (1.0 - s) / N + comm)


def gustafson(s, N):
    return s + (1.0 - s) * N


def main():
    s = 0.05                     # 5% serial
    comm_coeff = 0.002
    print(f"serial fraction s = {s:.0%}   =>  Amdahl hard cap = {1/s:.0f}x\n")

    print(f"{'N':>6}  {'Amdahl':>8}  {'+comm':>8}  {'eff%':>6}  {'Gustafson':>10}")
    knee = None
    for N in (1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024):
        a = amdahl(s, N)
        ac = amdahl_with_comm(s, N, comm_coeff)
        eff = 100 * ac / N
        g = gustafson(s, N)
        if knee is None and eff < 50 and N > 1:
            knee = N
        print(f"{N:>6}  {a:>7.1f}x  {ac:>7.1f}x  {eff:>5.1f}%  {g:>9.1f}x")

    print(f"\n  strong-scaling knee (efficiency < 50%): N = {knee}")
    print(f"  beyond here you burn nodes for shrinking returns — switch to weak scaling")
    print(f"  (bigger problem) if the science allows it.")

    # Amdahl asymptote
    assert abs(amdahl(s, 10 ** 9) - 1 / s) < 1e-3
    # ideal (s=0) is linear
    assert abs(amdahl(0.0, 64) - 64) < 1e-9
    # communication term makes the real curve non-monotonic in efficiency and
    # eventually the "+comm" speedup peaks then DROPS
    peak_N = max((2 ** k for k in range(1, 16)),
                 key=lambda N: amdahl_with_comm(s, N, comm_coeff))
    assert amdahl_with_comm(s, 2 * peak_N, comm_coeff) < amdahl_with_comm(s, peak_N, comm_coeff)
    print(f"  with comms, speedup peaks near N = {peak_N} then declines — more nodes, slower job")

    # weak scaling stays near-linear
    assert gustafson(s, 512) > 480
    assert knee is not None and knee <= 128
    print("\nPASS — Amdahl caps strong scaling at 1/s; comms give it a peak; Gustafson stays linear.")


if __name__ == "__main__":
    main()
