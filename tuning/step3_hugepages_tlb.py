#!/usr/bin/env python3
"""
Tuning · Step 3 — TLB reach: 4 KiB pages vs 2 MiB / 1 GiB hugepages.

The TLB caches virtual->physical translations. "TLB reach" = entries x
page_size — the memory you can address before translations start
missing. A miss triggers a page-table walk (~4 memory accesses on
x86-64, ~caches help but the uncached cost is real).

    reach          = tlb_entries * page_size
    miss_rate      ~ max(0, 1 - reach / working_set)   (uniform-ish access)
    walk_cost_ns   ~ 4 * dram_ns  (worst case, minus cache mitigation)
    slowdown       = 1 + miss_rate * walk_cost_ns / base_access_ns
"""

TLB_ENTRIES = 3072          # combined L2 dTLB, a modern big core
DRAM_NS = 90.0
BASE_ACCESS_NS = 4.0        # amortised per-access cost of a streaming kernel
WALK_NS = 4 * DRAM_NS * 0.35   # 4-level walk, ~65% mitigated by paging-structure caches

PAGE = {"4K": 4 << 10, "2M": 2 << 20, "1G": 1 << 30}


def reach(page_bytes):
    return TLB_ENTRIES * page_bytes


def miss_rate(working_set, page_bytes):
    r = reach(page_bytes)
    return max(0.0, 1.0 - r / working_set) if working_set > r else 0.0


def slowdown(working_set, page_bytes):
    return 1.0 + miss_rate(working_set, page_bytes) * WALK_NS / BASE_ACCESS_NS


def main():
    print(f"TLB entries: {TLB_ENTRIES}")
    for k, v in PAGE.items():
        print(f"  reach with {k} pages: {reach(v) / (1<<20):>10.1f} MiB")

    print(f"\n{'working set':>12}  {'4K miss':>8}  {'4K slow':>8}  "
          f"{'2M miss':>8}  {'2M slow':>8}  {'1G slow':>8}")
    for ws_mib in (8, 64, 512, 4096, 32768):
        ws = ws_mib << 20
        m4, s4 = miss_rate(ws, PAGE["4K"]), slowdown(ws, PAGE["4K"])
        m2, s2 = miss_rate(ws, PAGE["2M"]), slowdown(ws, PAGE["2M"])
        s1 = slowdown(ws, PAGE["1G"])
        print(f"{ws_mib:>9} MiB  {m4:>7.1%}  {s4:>7.2f}x  "
              f"{m2:>7.1%}  {s2:>7.2f}x  {s1:>7.2f}x")

    # 12 MiB reach with 4K pages -> anything bigger thrashes the TLB
    assert reach(PAGE["4K"]) == 12 * (1 << 20)
    assert reach(PAGE["2M"]) == 6 * (1 << 30)

    # a 4 GiB working set: 4K pages miss almost always, 2M pages basically never
    ws = 4096 << 20
    assert miss_rate(ws, PAGE["4K"]) > 0.99
    assert miss_rate(ws, PAGE["2M"]) == 0.0
    assert slowdown(ws, PAGE["4K"]) / slowdown(ws, PAGE["2M"]) > 15

    # even a 32 GiB set stays inside 1G-page reach (3 TiB) -> no penalty
    assert slowdown(32768 << 20, PAGE["1G"]) == 1.0
    # ...but exceeds 2M reach (6 GiB), so 2M pages start missing there
    assert miss_rate(32768 << 20, PAGE["2M"]) > 0.5

    print("\n  this is why databases and big scientific arrays use explicit hugepages")
    print("  (and often set THP=never — its background compaction adds p99 spikes).")
    print("\nPASS — bigger pages multiply TLB reach; the 4K penalty on large sets is ~15x+.")


if __name__ == "__main__":
    main()
