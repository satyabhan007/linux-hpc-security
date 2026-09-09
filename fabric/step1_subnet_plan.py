#!/usr/bin/env python3
"""
Fabric · Step 1 — plan the cluster's IPv4 subnets (CIDR math you do in your head).

A cluster needs several non-overlapping L3 networks: provisioning, IPMI/BMC,
in-band management, storage, and often IPoIB. A clean scheme encodes
"rack in the third octet, node in the fourth" so inventories and firewall
rules almost write themselves.

This lab does the address math with only integers (no ipaddress import
tricks beyond parsing), carves the plan, and proves the ranges do not
overlap.
"""


def ip2int(s):
    a, b, c, d = (int(x) for x in s.split("."))
    return (a << 24) | (b << 16) | (c << 8) | d


def int2ip(n):
    return ".".join(str((n >> s) & 0xFF) for s in (24, 16, 8, 0))


def block(cidr):
    net, bits = cidr.split("/")
    bits = int(bits)
    base = ip2int(net) & (~0 << (32 - bits) & 0xFFFFFFFF)
    size = 1 << (32 - bits)
    return base, size, bits


def usable_hosts(bits):
    return (1 << (32 - bits)) - 2 if bits <= 30 else (1 << (32 - bits))


def overlaps(b1, b2):
    (a, sa, _), (c, sc, _) = b1, b2
    return a < c + sc and c < a + sa


PLAN = [
    ("provisioning", "10.10.0.0/16", "PXE/DHCP/HTTP, node OS traffic"),
    ("ipmi",         "10.20.0.0/16", "BMC / out-of-band, isolated VLAN"),
    ("mgmt",         "10.30.0.0/16", "in-band admin, monitoring"),
    ("storage",      "10.40.0.0/16", "Lustre/NFS clients <-> servers"),
    ("ipoib",        "10.50.0.0/16", "IP over InfiniBand"),
]


def rack_subnet(base_cidr, rack, prefix=24):
    """Carve /24 per rack out of a /16: 10.X.<rack>.0/24."""
    base, size, bits = block(base_cidr)
    assert prefix > bits
    step = 1 << (32 - prefix)
    net = base + rack * step
    assert net < base + size, "rack index outside the parent block"
    return f"{int2ip(net)}/{prefix}"


def main():
    blocks = [(name, block(cidr), desc) for name, cidr, desc in PLAN]

    print(f"{'network':>13}  {'CIDR':>15}  {'usable':>7}  purpose")
    for name, (base, size, bits), desc in blocks:
        print(f"{name:>13}  {int2ip(base)+'/'+str(bits):>15}  "
              f"{usable_hosts(bits):>7}  {desc}")

    # no two networks overlap
    for i in range(len(blocks)):
        for j in range(i + 1, len(blocks)):
            assert not overlaps(blocks[i][1], blocks[j][1]), \
                f"{blocks[i][0]} overlaps {blocks[j][0]}"
    print("\n  ✓ all 5 networks are disjoint")

    # per-rack /24s inside provisioning
    print("\n  provisioning, per rack (10.10.<rack>.0/24, 254 usable each):")
    seen = []
    for rack in (0, 1, 2, 17, 42):
        s = rack_subnet("10.10.0.0/16", rack)
        b = block(s)
        for prev in seen:
            assert not overlaps(b, prev)
        seen.append(b)
        node5 = int2ip(b[0] + 5)
        print(f"    rack {rack:>2}: {s:>15}   (node 5 -> {node5})")

    # a /22 has 1022 usable, a /26 has 62 — the numbers you must know cold
    assert usable_hosts(22) == 1022
    assert usable_hosts(26) == 62
    assert usable_hosts(24) == 254
    # rack 42's /24 base is 10.10.42.0
    assert rack_subnet("10.10.0.0/16", 42) == "10.10.42.0/24"

    print("\nPASS — 5 disjoint networks, per-rack /24s carved and non-overlapping.")


if __name__ == "__main__":
    main()
