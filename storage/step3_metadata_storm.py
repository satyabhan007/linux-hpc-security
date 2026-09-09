#!/usr/bin/env python3
"""
Storage · Step 3 — a metadata storm, and why DNE fixes it.

The MDS handles a finite metadata ops/sec (open, stat, create, unlink).
When thousands of ranks each hammer it, requests queue. Model it as a
single server with service rate mu; offered load lambda; mean response
time (M/M/1) = 1 / (mu - lambda) once lambda < mu, and unbounded past
that. A recursive `ls -l` of a million-entry dir injects a huge burst.

DNE (Distributed Namespace, multiple MDTs) shards directories across
`n_mdt` servers, multiplying effective mu.
"""

MU_PER_MDT = 80_000        # metadata ops/sec one MDT sustains


def response_time_ms(lam, mu):
    if lam >= mu:
        return float("inf")            # saturated: queue grows without bound
    return 1000.0 / (mu - lam)


def scenario(name, background_ops, burst_ops, n_mdt):
    mu = MU_PER_MDT * n_mdt
    lam = background_ops + burst_ops
    rt = response_time_ms(lam, mu)
    util = lam / mu
    print(f"  {name:<34} lambda={lam:>8}/s  mu={mu:>8}/s  "
          f"util={util:>5.0%}  ls latency={('SATURATED' if rt==float('inf') else f'{rt:.2f} ms')}")
    return rt, util


def main():
    # steady state: 300 users doing light interactive work
    bg = 20_000

    print("single MDT (no DNE):")
    calm, _ = scenario("normal interactive load", bg, 0, 1)
    storm, u = scenario("+ recursive ls -l of 1M-file dir", bg, 120_000, 1)

    assert calm < 1.0, "an unloaded MDT answers stat in well under a millisecond"
    assert storm == float("inf"), "the storm pushes offered load past mu -> everything hangs"
    assert u > 1.0

    print("\nwith DNE across 4 MDTs (directory sharded):")
    d_calm, _ = scenario("normal interactive load", bg, 0, 4)
    d_storm, du = scenario("+ recursive ls -l of 1M-file dir", bg, 120_000, 4)

    assert d_storm != float("inf"), "4x mu absorbs the same burst"
    assert d_storm < 5.0, "sharded, the storm is a blip not an outage"
    assert du < 1.0

    # the behavioural fixes matter too: `lfs find` avoids per-entry stat,
    # archiving small files removes the create load entirely
    lfs_find_ops = 120_000 * 0.15        # ~1 readdir-plus vs many stats
    r, _ = scenario("+ lfs find instead of ls -l (1 MDT)", bg, int(lfs_find_ops), 1)
    assert r != float("inf") and r < 2.0

    print("\nPASS — one MDT saturates on the storm; DNE (or lfs find) keeps latency sane.")


if __name__ == "__main__":
    main()
