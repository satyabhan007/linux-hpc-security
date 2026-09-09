#!/usr/bin/env python3
"""
eBPF · Step 3 — a log2 latency histogram, the way bpftrace/bcc build one.

An eBPF program timestamps a syscall on entry, subtracts on return, and
does `hist[log2(delta_ns)]++` in a per-CPU array map. Userspace reads the
map and prints power-of-two buckets. This reproduces that: feed a stream
of latencies, bucket them, draw the ASCII histogram, and recover p50/p99
from the bucket boundaries.
"""
import random
import math


def log2_bucket(ns):
    if ns < 1:
        return 0
    return ns.bit_length() - 1        # floor(log2(ns))


def build_hist(samples):
    hist = {}
    for ns in samples:
        b = log2_bucket(ns)
        hist[b] = hist.get(b, 0) + 1
    return hist


def render(hist):
    lo_hi = lambda b: (1 << b, (1 << (b + 1)) - 1)
    total = sum(hist.values())
    maxc = max(hist.values())
    print(f"{'nsec':>26} : {'count':>7}  distribution")
    for b in range(min(hist), max(hist) + 1):
        c = hist.get(b, 0)
        lo, hi = lo_hi(b)
        bar = "#" * int(40 * c / maxc) if c else ""
        print(f"[{lo:>10}, {hi:>10}] : {c:>7}  |{bar:<40}|")
    return total


def percentile_from_hist(hist, pct):
    """Return the bucket UPPER bound that contains the pct-th percentile."""
    total = sum(hist.values())
    target = pct / 100 * total
    seen = 0
    for b in sorted(hist):
        seen += hist[b]
        if seen >= target:
            return (1 << (b + 1)) - 1
    return None


def main():
    random.seed(42)
    samples = []
    # a bimodal syscall latency: mostly fast page-cache hits ~1-8 us,
    # a long tail of disk / lock stalls ~1-30 ms
    for _ in range(9000):
        samples.append(int(random.lognormvariate(math.log(3000), 0.5)))   # ~3 us
    for _ in range(1000):
        samples.append(int(random.lognormvariate(math.log(4_000_000), 0.6)))  # ~4 ms

    hist = build_hist(samples)
    total = render(hist)

    p50 = percentile_from_hist(hist, 50)
    p99 = percentile_from_hist(hist, 99)
    print(f"\n  samples: {total}")
    print(f"  p50 ~ <= {p50:>12,} ns   ({p50/1000:.1f} us)")
    print(f"  p99 ~ <= {p99:>12,} ns   ({p99/1e6:.1f} ms)")

    # the fast mode dominates the median; the tail sets p99
    assert p50 < 20_000, "median should be in the single-digit microseconds"
    assert p99 > 1_000_000, "p99 must land in the millisecond disk/lock tail"
    # bucket counts sum to the sample count
    assert sum(hist.values()) == len(samples)
    # genuinely bimodal: a populated fast bucket (~microseconds, log2 ~11-13)
    # and a populated slow bucket (~milliseconds, log2 >= 20), octaves apart
    fast = [b for b in hist if b <= 14 and hist[b] > 50]
    slow = [b for b in hist if b >= 20 and hist[b] > 20]
    assert fast and slow, "expected both a microsecond hump and a millisecond hump"
    assert min(slow) - max(fast) >= 5, "the two modes should be many octaves apart"

    print("\n  this five-line pattern (entry ts, return delta, log2 bucket, ++) is")
    print("  biolatency, runqlat, and every *latency tool in bcc.")
    print("\nPASS — log2 histogram built; p50/p99 recovered from bucket edges.")


if __name__ == "__main__":
    main()
