#!/usr/bin/env python3
"""
Storage · Step 2 — IOR throughput vs transfer size and access pattern.

Parallel filesystems reward large, stripe-aligned, sequential I/O and
punish small unaligned I/O. Model the effective bandwidth of a transfer:

    time_per_xfer = op_overhead + (xfer / bw_per_lane) + misalign_penalty
    eff_bw        = xfer / time_per_xfer  * n_lanes

small xfers  -> op_overhead dominates, eff_bw collapses
unaligned    -> read-modify-write on the boundary stripe, +penalty
file-per-proc at huge scale -> metadata cost per file (Module 3 storm)
"""

STRIPE = 1 << 20          # 1 MiB
BW_PER_LANE = 2.0e9       # B/s per OST lane
N_LANES = 16
OP_OVERHEAD = 300e-6      # per-transfer RPC + lock overhead (s)
CREATE_COST = 4e-3        # per-file metadata create (s)


def eff_bw(xfer, aligned, lanes=N_LANES):
    misalign = 0.0 if aligned else (STRIPE / BW_PER_LANE)   # ~1 extra stripe of work
    t = OP_OVERHEAD + xfer / BW_PER_LANE + misalign
    return xfer / t * lanes / 1e9        # GB/s


def shared_file_run(total_bytes, xfer, aligned):
    n_xfers = total_bytes / xfer
    t = n_xfers * (OP_OVERHEAD + xfer / BW_PER_LANE +
                   (0 if aligned else STRIPE / BW_PER_LANE)) / N_LANES
    return total_bytes / t / 1e9


def fpp_run(total_bytes, n_ranks, xfer):
    # each rank writes its own file: create cost + data cost, in parallel
    per_rank_bytes = total_bytes / n_ranks
    n_xfers = per_rank_bytes / xfer
    t = CREATE_COST + n_xfers * (OP_OVERHEAD + xfer / BW_PER_LANE)
    return total_bytes / t / 1e9


def main():
    print("single-transfer effective bandwidth (16 lanes):")
    print(f"  {'xfer':>10}  {'aligned':>8}  {'eff BW':>9}")
    for xfer in (4 << 10, 64 << 10, 1 << 20, 4 << 20, 16 << 20):
        for aligned in (True,):
            print(f"  {xfer:>10}  {'yes':>8}  {eff_bw(xfer, aligned):>7.1f}G")
    print(f"  {1<<20:>10}  {'NO':>8}  {eff_bw(1 << 20, False):>7.1f}G   <- unaligned 1 MiB")

    small = eff_bw(4 << 10, True)
    big = eff_bw(16 << 20, True)
    unaligned = eff_bw(1 << 20, False)
    aligned1m = eff_bw(1 << 20, True)

    assert big > 20 * small, "4 KiB transfers collapse to a fraction of large-transfer BW"
    assert aligned1m > 1.5 * unaligned, "misalignment roughly halves a 1 MiB transfer"

    print("\naccess pattern, writing 64 GiB from 4096 ranks:")
    total = 64 << 30
    shared_good = shared_file_run(total, 4 << 20, True)
    shared_small = shared_file_run(total, 16 << 10, True)
    fpp = fpp_run(total, 4096, 4 << 20)
    print(f"  one shared file, 4 MiB aligned : {shared_good:>7.1f} GB/s")
    print(f"  one shared file, 16 KiB xfers  : {shared_small:>7.1f} GB/s")
    print(f"  file-per-process (4096 files)  : {fpp:>7.1f} GB/s  (+ 4096 metadata creates)")

    assert shared_good > 5 * shared_small
    # fpp looks ok on BW but the create storm is the hidden cost at scale
    creates = 4096
    assert creates * CREATE_COST > 10, "4096 file creates ~ 16s of pure metadata — the real tax"

    print("\nPASS — large aligned I/O wins by >20x; misalignment ~halves it; small xfers collapse.")


if __name__ == "__main__":
    main()
