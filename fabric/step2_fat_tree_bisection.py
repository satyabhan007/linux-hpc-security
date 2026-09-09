#!/usr/bin/env python3
"""
Fabric · Step 2 — fat-tree bisection bandwidth and oversubscription.

A 2-level fat tree: each leaf switch has `radix` ports, split into
`down` ports (to nodes) and `up` ports (to spine switches). The
oversubscription ratio is down:up. Bisection bandwidth = the bandwidth
across a cut that splits the machine in half; for a fat tree it is
bounded by the total uplink capacity of one half.

    nodes         = leaves * down
    oversub       = down / up
    bisection GB/s = (leaves/2) * up * link_GBps      (uplink-limited)
    full (1:1) bisection would be nodes/2 * link_GBps

We compute these for 1:1, 2:1 and 3:1 designs and check the tradeoffs.
"""

LINK_GBPS = 25.0        # per-port (e.g. HDR100-ish effective)


def design(radix, leaves, down):
    up = radix - down
    assert up > 0, "no uplinks left"
    nodes = leaves * down
    oversub = down / up
    bisection = (leaves / 2) * up * LINK_GBPS
    full_bisection = (nodes / 2) * LINK_GBPS
    per_node_bw = bisection / (nodes / 2)          # GB/s available per node across the cut
    switch_ports = leaves * radix + leaves * up    # leaf ports + spine ports (spine = leaves*up/ (radix) ... simplified)
    return {
        "up": up, "nodes": nodes, "oversub": oversub,
        "bisection": bisection, "full_bisection": full_bisection,
        "per_node_bw": per_node_bw,
        "efficiency": bisection / full_bisection,
    }


def main():
    RADIX, LEAVES = 36, 16

    print(f"{'design':>8}  {'down:up':>8}  {'nodes':>6}  {'oversub':>8}  "
          f"{'bisect GB/s':>12}  {'per-node':>9}  {'vs full':>8}")
    plans = {}
    for label, down in [("1:1", 18), ("2:1", 24), ("3:1", 27)]:
        d = design(RADIX, LEAVES, down)
        plans[label] = d
        print(f"{label:>8}  {down:>3}:{d['up']:<3}  {d['nodes']:>6}  "
              f"{d['oversub']:>7.1f}x  {d['bisection']:>10.0f}   "
              f"{d['per_node_bw']:>7.2f}   {d['efficiency']*100:>6.0f}%")

    # 1:1 is non-blocking: every node can use a full link across the cut
    assert abs(plans["1:1"]["per_node_bw"] - LINK_GBPS) < 1e-6
    assert abs(plans["1:1"]["efficiency"] - 1.0) < 1e-6

    # 3:1 gives each node only ~1/3 of a link across the bisection
    assert abs(plans["3:1"]["per_node_bw"] - LINK_GBPS / 3) < 0.5
    assert plans["3:1"]["oversub"] == 3.0

    # but 3:1 hosts far more nodes on the same 16 leaves
    assert plans["3:1"]["nodes"] > plans["1:1"]["nodes"]
    extra = plans["3:1"]["nodes"] - plans["1:1"]["nodes"]
    print(f"\n  3:1 fits {extra} more nodes on the same 16 leaf switches ...")
    print(f"  ... at 1/3 the cross-section bandwidth per node. Fine for local")
    print(f"  comms, painful for global all-to-all (Module 8 collectives).")

    # a communication-bound job doing all-to-all wants >= ~0.7 link/node;
    # only the 1:1 (and marginally 2:1) design delivers that
    ok_for_a2a = [k for k, v in plans.items() if v["per_node_bw"] >= 0.7 * LINK_GBPS]
    assert ok_for_a2a == ["1:1"]

    print("\nPASS — bisection math shows the exact node-count vs bandwidth trade of each ratio.")


if __name__ == "__main__":
    main()
