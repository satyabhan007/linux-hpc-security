#!/usr/bin/env python3
"""
Linux internals · Step 2 — the page cache, minor vs major faults, thrashing.

A process touches memory-mapped pages. If the page is already resident
(in the page cache, a shared library, or previously faulted), the MMU
takes a *minor* fault: cheap, ~sub-microsecond. If it must be read from
disk/swap, it is a *major* fault: ~milliseconds, ~10,000x worse.

This models a fixed-size LRU page cache and a workload that scans a
working set. When the working set fits, majors go to zero after warm-up.
When it does not, every scan evicts pages it is about to need again ->
thrashing, and majors track the whole working set forever.
"""

MINOR_NS = 200          # ~0.2 us to wire up a resident page
MAJOR_NS = 3_000_000    # ~3 ms to fault one page in from disk


class PageCache:
    def __init__(self, capacity_pages):
        self.cap = capacity_pages
        self.lru = []          # most-recently-used at the end
        self.resident = set()
        self.minor = 0
        self.major = 0

    def access(self, page):
        if page in self.resident:
            self.minor += 1
            self.lru.remove(page)
            self.lru.append(page)
            return
        # not resident -> major fault, read from disk
        self.major += 1
        if len(self.lru) >= self.cap:
            victim = self.lru.pop(0)
            self.resident.discard(victim)
        self.lru.append(page)
        self.resident.add(page)


def run(working_set_pages, cache_pages, scans=6):
    pc = PageCache(cache_pages)
    per_scan_majors = []
    for _ in range(scans):
        before = pc.major
        for page in range(working_set_pages):   # sequential scan of the WSS
            pc.access(page)
        per_scan_majors.append(pc.major - before)
    nanos = pc.minor * MINOR_NS + pc.major * MAJOR_NS
    return pc, per_scan_majors, nanos


def main():
    WSS = 4000  # pages (~16 MiB at 4 KiB)

    print(f"working set: {WSS} pages\n")
    print(f"{'cache':>8}  {'fit?':>5}  {'majors/scan (last 4)':>28}  {'wall':>10}")
    results = {}
    for cache in (1000, 2000, 4000, 6000):
        pc, majors, nanos = run(WSS, cache)
        fits = cache >= WSS
        results[cache] = majors
        print(f"{cache:>8}  {('yes' if fits else 'NO'):>5}  "
              f"{str(majors[-4:]):>28}  {nanos/1e9:>8.2f} s")

    # When the cache is smaller than the working set, a sequential scan
    # evicts the oldest page right before the next scan needs it first:
    # every scan re-faults the ENTIRE working set. Classic thrash.
    thrash = results[1000]
    assert thrash[-1] == WSS, "under-sized cache should re-fault the whole WSS every scan"

    # When it fits, warm-up costs WSS majors once, then steady state is 0.
    fit = results[6000]
    assert fit[0] == WSS and fit[-1] == 0, "over-sized cache should stop faulting after warm-up"

    # 2000-page cache (half the WSS) with an LRU scan is the pathological
    # case: still ~full re-fault every pass.
    half = results[2000]
    assert half[-1] >= WSS * 0.9

    print("\n  takeaway: sizing RAM below the working set does not slow you down")
    print("  a little — it collapses to disk speed. 'available' must cover the WSS.")
    print("\nPASS — page cache hit/miss explains the cliff, not a gentle slope.")


if __name__ == "__main__":
    main()
