#!/usr/bin/env python3
"""
Storage · Step 1 — choosing a Lustre stripe layout.

A file is split into `stripe_count` objects, one per OST, in
`stripe_size` chunks (round-robin). Read/write bandwidth for one file is
bounded by:

    aggregate_BW = min(stripe_count, n_clients, n_OSTs) * per_OST_BW

so stripe_count = 1 caps a huge shared file at ONE OST's speed (and
fills that OST). Too many stripes on tiny files just adds overhead and
metadata. This lab recommends a layout and models the resulting BW and
the "one OST fills up" risk.
"""

N_OST = 24
PER_OST_BW = 2.0            # GB/s per OST
OST_CAPACITY_TB = 40.0


def recommend(file_size_gb, n_clients, shared):
    if not shared:                                  # file-per-process
        return 1, "1M"                              # each rank's own file, 1 stripe is fine
    if file_size_gb < 1:
        return 1, "1M"
    if file_size_gb < 100:
        c = 4
    elif file_size_gb < 1000:
        c = 16
    else:
        c = min(48, N_OST * 2)                      # allow 2 objects/OST on very large
    c = min(c, N_OST, max(1, n_clients))
    size = "4M" if file_size_gb >= 10 else "1M"
    return c, size


def model_bw(stripe_count, n_clients):
    lanes = min(stripe_count, n_clients, N_OST)
    return lanes * PER_OST_BW


def ost_fill_pct(file_size_gb, stripe_count):
    per_ost_gb = file_size_gb / min(stripe_count, N_OST)
    return 100 * (per_ost_gb / 1024) / OST_CAPACITY_TB


def main():
    cases = [
        ("checkpoint, 1 rank/file", 8, 512, False),
        ("shared restart file", 2000, 1024, True),
        ("mid shared dataset", 60, 256, True),
        ("tiny config files", 0.001, 4096, True),
        ("45 TB single shared file, 1 stripe (BAD)", 45000, 2048, True),
    ]
    print(f"{'workload':>40}  {'stripes':>7}  {'size':>5}  {'agg BW':>8}  {'max OST fill':>12}")
    rows = {}
    for name, sz, nc, shared in cases:
        if name.endswith("(BAD)"):
            c, s = 1, "1M"                           # force the anti-pattern
        else:
            c, s = recommend(sz, nc, shared)
        bw = model_bw(c, nc)
        fill = ost_fill_pct(sz, c)
        rows[name] = (c, bw, fill)
        print(f"{name:>40}  {c:>7}  {s:>5}  {bw:>6.0f}G  {fill:>10.1f}%")

    # the 40 TB / 1-stripe file: catastrophic single-OST fill and 2 GB/s cap
    c, bw, fill = rows["45 TB single shared file, 1 stripe (BAD)"]
    assert bw == PER_OST_BW, "1 stripe => capped at one OST's bandwidth"
    assert fill > 100, "45 TB on one 40 TB OST overflows it -> ENOSPC while df shows free"

    # the 2 TB shared restart file gets many stripes and scales
    c, bw, fill = rows["shared restart file"]
    assert c >= 16 and bw >= 32
    assert fill < 20

    # tiny files: 1 stripe, no benefit from spreading
    assert rows["tiny config files"][0] == 1

    # per-process checkpoints: 1 stripe each is correct (metadata-friendly at
    # modest rank counts), aggregate scales with the number of writers
    assert rows["checkpoint, 1 rank/file"][0] == 1

    print("\n  rule: stripe_count ~ file_size, capped by OST count and #writers;")
    print("  never leave a multi-TB shared file at stripe_count=1.")
    print("\nPASS — layout recommendations scale BW and avoid single-OST overflow.")


if __name__ == "__main__":
    main()
