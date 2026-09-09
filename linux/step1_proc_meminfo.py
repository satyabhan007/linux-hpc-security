#!/usr/bin/env python3
"""
Linux internals · Step 1 — read /proc/meminfo the way the kernel means it.

"free memory" is a number people panic about and should not. The kernel
uses spare RAM as page cache and hands it back instantly under pressure.
The field that actually predicts "can I start a big process without
swapping" is MemAvailable, not MemFree.

This lab parses a realistic /proc/meminfo, then re-derives MemAvailable
using the kernel's own heuristic (mm/page_alloc.c: si_mem_available) so
you can see what it is really counting.
"""

# A realistic snapshot from a 128 GiB compute node mid-job. Values in kB.
MEMINFO = """\
MemTotal:       131760616 kB
MemFree:         2015232 kB
MemAvailable:   96328244 kB
Buffers:         1893760 kB
Cached:         89417216 kB
SwapCached:            0 kB
Active:        41234944 kB
Inactive:      74811392 kB
Active(file):  38122880 kB
Inactive(file):58899200 kB
SReclaimable:   4213248 kB
Shmem:           612352 kB
SwapTotal:      8388604 kB
SwapFree:       8388604 kB
Dirty:            48192 kB
Writeback:           0 kB
"""


def parse(text):
    out = {}
    for line in text.strip().splitlines():
        key, _, rest = line.partition(":")
        out[key] = int(rest.strip().split()[0])  # kB
    return out


def derive_available(m, low_watermark_kb):
    """Reimplements si_mem_available() from the kernel, roughly.

    available = free - low_watermark
              + (pagecache - min(pagecache/2, low_watermark))
              + (reclaimable_slab - min(reclaimable_slab/2, low_watermark))
    where pagecache = Active(file) + Inactive(file), minus a bit for shmem.
    """
    free = m["MemFree"]
    pagecache = m["Active(file)"] + m["Inactive(file)"]
    pagecache -= min(pagecache // 2, m.get("Shmem", 0))
    reclaimable = m["SReclaimable"]

    available = free - low_watermark_kb
    available += pagecache - min(pagecache // 2, low_watermark_kb)
    available += reclaimable - min(reclaimable // 2, low_watermark_kb)
    return max(available, 0)


def main():
    m = parse(MEMINFO)
    gib = lambda kb: kb / 1024 / 1024

    # The low watermark scales with machine size; ~0.7% of RAM is a good
    # stand-in for the sum of per-zone min watermarks on a big node.
    low_wmark = int(m["MemTotal"] * 0.007)

    print(f"MemTotal      {gib(m['MemTotal']):8.1f} GiB")
    print(f"MemFree       {gib(m['MemFree']):8.1f} GiB   <- the scary number")
    print(f"Cached        {gib(m['Cached']):8.1f} GiB   <- reclaimable, working FOR you")
    print(f"MemAvailable  {gib(m['MemAvailable']):8.1f} GiB   <- what you can actually use")
    print()

    derived = derive_available(m, low_wmark)
    print(f"re-derived MemAvailable ~ {gib(derived):.1f} GiB "
          f"(kernel reported {gib(m['MemAvailable']):.1f} GiB)")

    # "Percent free" is a bad alert. "Percent available" is a good one.
    pct_free = 100 * m["MemFree"] / m["MemTotal"]
    pct_avail = 100 * m["MemAvailable"] / m["MemTotal"]
    print(f"\n  alert on free:      {pct_free:4.1f}%  -> would page you at 2am for nothing")
    print(f"  alert on available: {pct_avail:4.1f}%  -> healthy, ignore")

    # swap untouched => no memory pressure yet, despite 1.5% free
    swap_used = m["SwapTotal"] - m["SwapFree"]
    print(f"\n  swap used: {gib(swap_used):.1f} GiB  (0 => the low free number is fine)")

    # Our re-derivation should land within 5% of the kernel's figure.
    rel_err = abs(derived - m["MemAvailable"]) / m["MemAvailable"]
    assert rel_err < 0.05, f"available heuristic off by {rel_err:.1%}"
    assert swap_used == 0
    assert pct_avail > 70 > pct_free
    print("\nPASS — MemAvailable, not MemFree, is the number that matters.")


if __name__ == "__main__":
    main()
