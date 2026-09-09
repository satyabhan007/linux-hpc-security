#!/usr/bin/env python3
"""
Fraud / Circumvention Detection · Step 2 — linkage graph & rings.

A single account is hard to judge. A *graph* of accounts joined by
shared identifiers is not:

  nodes  = accounts
  edges  = "share a strong identifier": device fingerprint, payment
           instrument, hashed SSN/phone, shipping address, cookie/localStorage
           id, referral parent

Edge weight ~ how uniquely that identifier ties two accounts (a shared
residential IP is weak; a shared device fingerprint + card is strong).
Connected components above a size/weight threshold are multi-accounting,
Sybil referral abuse, or a bust-out ring.

Pure-Python union-find; no libraries.
"""

# identifier strength (how surprising a match is)
W = {"device": 0.9, "card": 0.95, "ssn": 0.99, "phone": 0.7,
     "address": 0.6, "cookie": 0.8, "ip": 0.15, "referrer": 0.5}


class DSU:
    def __init__(self):
        self.p = {}
        self.r = {}

    def find(self, x):
        self.p.setdefault(x, x)
        while self.p[x] != x:
            self.p[x] = self.p[self.p[x]]
            x = self.p[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        self.p[ra] = rb


def build(accounts, links, min_edge_w=0.65):
    """links: list of (acctA, acctB, id_type). Returns components + a
    per-component risk from size and cumulative edge strength."""
    dsu = DSU()
    for a in accounts:
        dsu.find(a)
    kept = [(a, b, t) for a, b, t in links if W.get(t, 0) >= min_edge_w]
    for a, b, _ in kept:
        dsu.union(a, b)

    comps = {}
    for a in accounts:
        comps.setdefault(dsu.find(a), set()).add(a)

    edge_w = {}
    for a, b, t in kept:
        r = dsu.find(a)
        edge_w[r] = edge_w.get(r, 0.0) + W[t]

    out = []
    for r, members in comps.items():
        n = len(members)
        strength = edge_w.get(r, 0.0)
        # risk: grows with size and with dense strong linkage
        risk = min(100, int(18 * (n - 1) + 12 * strength))
        out.append({"members": sorted(members), "size": n,
                    "link_strength": round(strength, 2), "risk": risk})
    return sorted(out, key=lambda c: -c["risk"])


def main():
    accounts = [f"a{i}" for i in range(1, 14)]

    links = [
        # a1..a2 : a couple who share a household (weak links only) -> NOT a ring
        ("a1", "a2", "address"), ("a1", "a2", "ip"),
        # a3..a8 : referral-bonus ring, all on one device + 2 cards + a cookie
        ("a3", "a4", "device"), ("a4", "a5", "device"), ("a5", "a6", "device"),
        ("a6", "a7", "device"), ("a7", "a8", "device"),
        ("a3", "a6", "card"), ("a4", "a8", "card"), ("a5", "a7", "cookie"),
        ("a3", "a4", "referrer"), ("a3", "a5", "referrer"), ("a3", "a6", "referrer"),
        # a9..a10 : same person, new phone (device + card) -> small multi-acct
        ("a9", "a10", "device"), ("a9", "a10", "card"),
        # a11 shares only a coffee-shop IP with a3 -> must NOT merge the ring
        ("a11", "a3", "ip"),
        # a12, a13 : unrelated singletons
    ]

    comps = build(accounts, links)
    for c in comps:
        tag = "RING" if c["risk"] >= 60 else ("pair" if c["size"] == 2 else "ok")
        print(f"  [{tag:>4}] size={c['size']:>2} strength={c['link_strength']:>5} "
              f"risk={c['risk']:>3}  {c['members']}")

    top = comps[0]
    assert set(top["members"]) == {"a3", "a4", "a5", "a6", "a7", "a8"}, top["members"]
    assert top["risk"] >= 80

    # the household pair (weak links only) is filtered out entirely
    hh = [c for c in comps if set(c["members"]) == {"a1", "a2"}]
    assert hh == [], "weak-only links (address+ip) must not form a component"

    # the coffee-shop IP did NOT drag a11 into the ring
    ring = [c for c in comps if "a3" in c["members"]][0]
    assert "a11" not in ring["members"], "weak IP edge must not merge a11"

    # the 'same person, new phone' pair is a small component, lower risk
    dup = [c for c in comps if set(c["members"]) == {"a9", "a10"}][0]
    assert dup["risk"] < top["risk"] and dup["size"] == 2

    print("\n  strong identifiers (device, card, ssn, cookie) build the graph;")
    print("  weak ones (shared IP, address) are context, not edges — otherwise")
    print("  every airport-wifi user joins one giant component.")
    print("\nPASS — the 6-account referral ring is one high-risk component; the")
    print("  household and the coffee-shop-IP user are correctly left out.")


if __name__ == "__main__":
    main()
