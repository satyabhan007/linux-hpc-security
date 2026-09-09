#!/usr/bin/env python3
"""
Tuning · Step 1 — NUMA locality and why binding matters.

A 2-socket node has two memory controllers. Local RAM ~90 ns; remote RAM
(across the inter-socket link) ~140 ns AND the link is a shared, limited
resource. A memory-bound thread that reads a fraction `f` of its data
remotely sees:

    effective_latency = (1-f)*local + f*remote
    effective_bw      = local_bw * (local_lat / effective_latency)   [approx]
    ... minus link contention when many threads go remote at once.

We compare: unbound (pages land wherever, threads migrate), bound +
first-touch (each thread's pages are local), and a worst case
(all-remote).
"""

LOCAL_NS = 90.0
REMOTE_NS = 140.0
LOCAL_BW = 120.0            # GB/s per socket, memory-bound kernel
LINK_BW = 90.0             # GB/s inter-socket link (shared by all remote traffic)


def eff_bw(remote_frac, n_threads_remote=1):
    lat = (1 - remote_frac) * LOCAL_NS + remote_frac * REMOTE_NS
    bw = LOCAL_BW * (LOCAL_NS / lat)
    # link contention: remote demand above LINK_BW throttles everyone remote
    remote_demand = bw * remote_frac * n_threads_remote
    if remote_demand > LINK_BW:
        bw *= LINK_BW / remote_demand
    return bw


def main():
    scenarios = [
        ("bound + first-touch (all local)", 0.00, 1),
        ("unbound (scheduler migrated ~35% of pages remote)", 0.35, 4),
        ("wrong bind (data on the other socket)", 1.00, 6),
        ("interleaved (numactl --interleave, 50/50)", 0.50, 8),
    ]
    print(f"{'placement':>52}  {'remote%':>7}  {'eff BW':>8}  {'vs best':>7}")
    best = eff_bw(0.0, 1)
    results = {}
    for name, f, nrt in scenarios:
        bw = eff_bw(f, nrt)
        results[name] = bw
        print(f"{name:>52}  {f*100:>6.0f}%  {bw:>6.1f}G  {100*bw/best:>5.0f}%")

    local = results["bound + first-touch (all local)"]
    unbound = results["unbound (scheduler migrated ~35% of pages remote)"]
    remote = results["wrong bind (data on the other socket)"]

    assert abs(local - LOCAL_BW) < 1e-6
    # 35% remote already costs a meaningful chunk of bandwidth
    assert unbound < 0.85 * local
    # all-remote is far worse and slams the link
    assert remote < 0.45 * local
    # binding local recovers ~everything
    assert local / remote > 2.0

    # first-touch demo: if thread initialises data in the SAME parallel region
    # that later reads it, pages are local => f≈0; if a single init thread
    # touches everything first, all pages sit on one socket => f≈0.5 for the
    # other socket's threads
    good_first_touch = eff_bw(0.0, 1)
    bad_first_touch = eff_bw(0.5, 8)   # half the threads are now remote
    assert good_first_touch > 1.6 * bad_first_touch

    print("\n  takeaway: `numactl --cpunodebind=N --membind=N` + first-touch in the")
    print("  using parallel region. Unbound is not 'a bit slower' — it is 15-55% off.")
    print("\nPASS — local binding hits full bandwidth; remote access and link contention gut it.")


if __name__ == "__main__":
    main()
