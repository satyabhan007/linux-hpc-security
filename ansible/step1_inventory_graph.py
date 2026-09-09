#!/usr/bin/env python3
"""
Ansible · Step 1 — inventory groups + variable precedence resolution.

A host inherits variables from every group it belongs to (directly or
via `children`), plus its own host_vars, plus extra-vars. Ansible's
precedence (low -> high) for the parts we model here:

    role defaults
  < group_vars/all
  < group_vars/<child group>          (parent groups first, then children)
  < host_vars/<host>
  < play vars
  < extra-vars (-e)                    always wins

This builds the group graph, computes each host's group chain, and
resolves the effective value + where it came from.
"""

INVENTORY = {
    "all":     {"children": ["cluster"]},
    "cluster": {"children": ["login", "compute"]},
    "login":   {"hosts": ["login01", "login02"]},
    "compute": {"children": ["cpu", "gpu"]},
    "cpu":     {"hosts": ["cpu001", "cpu002"]},
    "gpu":     {"hosts": ["gpu001"]},
}

GROUP_VARS = {
    "all":     {"ntp_server": "pool.ntp.org", "slurm_role": "client", "swappiness": 60},
    "cluster": {"slurm_role": "node", "swappiness": 10},
    "compute": {"slurm_role": "compute"},
    "gpu":     {"nvidia_driver": "550", "swappiness": 1},
    "login":   {"slurm_role": "login"},
}
HOST_VARS = {
    "gpu001":  {"gpu_count": 8},
    "cpu002":  {"swappiness": 5},
}
ROLE_DEFAULTS = {"swappiness": 60, "ntp_server": "time.google.com", "mtu": 1500}
PLAY_VARS = {}
EXTRA_VARS = {"slurm_role": "drain"}      # -e "slurm_role=drain"

ROLE_DEFAULTS_ONLY = {"mtu"}              # keys only role defaults set


def parents_of(group, inv):
    for g, spec in inv.items():
        if group in spec.get("children", []):
            yield g


def group_chain(host, inv):
    """Groups a host belongs to, ordered parent -> child (Ansible-ish)."""
    direct = [g for g, spec in inv.items() if host in spec.get("hosts", [])]
    chain, seen = [], set()

    def walk_up(g):
        for p in parents_of(g, inv):
            walk_up(p)
        if g not in seen:
            seen.add(g)
            chain.append(g)

    for g in direct:
        walk_up(g)
    return chain


def resolve(host, key, inv):
    layers = []  # (source, value) low -> high
    if key in ROLE_DEFAULTS:
        layers.append((f"role default", ROLE_DEFAULTS[key]))
    for g in group_chain(host, inv):
        if g in GROUP_VARS and key in GROUP_VARS[g]:
            layers.append((f"group_vars/{g}", GROUP_VARS[g][key]))
    if host in HOST_VARS and key in HOST_VARS[host]:
        layers.append((f"host_vars/{host}", HOST_VARS[host][key]))
    if key in PLAY_VARS:
        layers.append(("play vars", PLAY_VARS[key]))
    if key in EXTRA_VARS:
        layers.append(("extra-vars (-e)", EXTRA_VARS[key]))
    return layers[-1] if layers else (None, None)


def main():
    hosts = sorted({h for spec in INVENTORY.values() for h in spec.get("hosts", [])})
    for h in hosts:
        print(f"  {h:>8}  groups: {' -> '.join(group_chain(h, INVENTORY))}")

    print()
    for h, key in [("gpu001", "swappiness"), ("cpu002", "swappiness"),
                   ("cpu001", "slurm_role"), ("login01", "slurm_role"),
                   ("cpu001", "mtu"), ("gpu001", "nvidia_driver")]:
        src, val = resolve(h, key, INVENTORY)
        print(f"  {h:>8}.{key:<14} = {str(val):>14}   <- {src}")

    # gpu001 swappiness: role default 60 < all 60 < cluster 10 < gpu 1 -> 1
    assert resolve("gpu001", "swappiness", INVENTORY) == ("group_vars/gpu", 1)
    # cpu002 has a host_var that beats every group
    assert resolve("cpu002", "swappiness", INVENTORY) == ("host_vars/cpu002", 5)
    # slurm_role: extra-vars beats the compute group value
    assert resolve("cpu001", "slurm_role", INVENTORY) == ("extra-vars (-e)", "drain")
    assert resolve("login01", "slurm_role", INVENTORY) == ("extra-vars (-e)", "drain")
    # mtu is only in role defaults
    assert resolve("cpu001", "mtu", INVENTORY) == ("role default", 1500)
    # child group (gpu) contributes a var no parent has
    assert resolve("gpu001", "nvidia_driver", INVENTORY) == ("group_vars/gpu", "550")

    print("\nPASS — group chain built parent->child; precedence resolves to the right layer.")


if __name__ == "__main__":
    main()
