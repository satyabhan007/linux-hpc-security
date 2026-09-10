#!/usr/bin/env python3
"""
Red vs Blue · Step 2 — lateral movement as a graph search.

Model the estate as a directed graph:
  nodes  = hosts and identities
  edges  = "attacker on A can reach B" because of a cached credential,
           an admin right, a service account, or a trust.

From a foothold, BFS finds the SHORTEST path to the crown jewel
("dc01" / domain admin). Then, for each candidate control (disable a
cached cred, tier the admins, isolate a host), we recompute the shortest
path -- the control that lengthens or severs it is the one worth doing.

This is BloodHound's core idea in ~50 lines.
"""
from collections import deque

# edge: (src, dst, reason, control_that_removes_it)
EDGES = [
    ("ws-user01",   "ws-adm-tools", "RDP as helpdesk (cached cred)",    "cred-cache:helpdesk"),
    ("ws-user01",   "fs01",         "user has a mapped admin share",    "least-priv:fs01"),
    ("ws-adm-tools", "dc01",        "member of Domain Admins (!)",      "tier0:domain-admins"),
    ("ws-adm-tools", "svc-backup",  "backup agent runs as svc-backup",  "gmsa:svc-backup"),
    ("svc-backup",  "dc01",         "svc-backup in Backup Operators",   "tier0:backup-operators"),
    ("fs01",        "svc-sql",      "SQL service acct cred on disk",    "cred-hygiene:fs01"),
    ("svc-sql",     "app01",        "linked server / sysadmin",         "sql-lockdown:app01"),
    ("app01",       "ws-adm-tools", "admin reuses password (spray)",    "unique-passwords"),
]

FOOTHOLD = "ws-user01"
CROWN = "dc01"


def build(edges):
    g = {}
    for s, d, reason, ctrl in edges:
        g.setdefault(s, []).append((d, reason, ctrl))
    return g


def shortest_path(edges, start, goal):
    g = build(edges)
    q = deque([(start, [start], [])])
    seen = {start}
    while q:
        node, path, why = q.popleft()
        if node == goal:
            return path, why
        for d, reason, ctrl in g.get(node, []):
            if d not in seen:
                seen.add(d)
                q.append((d, path + [d], why + [reason]))
    return None, None


def main():
    path, why = shortest_path(EDGES, FOOTHOLD, CROWN)
    print(f"foothold: {FOOTHOLD}   crown jewel: {CROWN}\n")
    print(f"  shortest attack path ({len(path)-1} hops):")
    for i, node in enumerate(path):
        print(f"    {node}" + (f"   <- {why[i-1]}" if i else "   (start)"))

    base_len = len(path) - 1

    print("\n  effect of each candidate control on the shortest path:")
    controls = sorted({c for *_, c in EDGES})
    results = {}
    for ctrl in controls:
        pruned = [e for e in EDGES if e[3] != ctrl]
        p, _ = shortest_path(pruned, FOOTHOLD, CROWN)
        newlen = (len(p) - 1) if p else None
        results[ctrl] = newlen
        verdict = ("SEVERS all paths" if newlen is None else
                   f"path now {newlen} hops (+{newlen - base_len})" if newlen > base_len else
                   "no change")
        print(f"    {ctrl:>28}  ->  {verdict}")

    # the current shortest path uses the 'Domain Admins' edge directly
    assert why[-1].startswith("member of Domain Admins")
    assert base_len == 2, "ws-user01 -> ws-adm-tools -> dc01 in 2 hops"

    # tiering Domain Admins removes the 1-hop-from-adm-tools jump; path gets longer
    assert results["tier0:domain-admins"] is not None
    assert results["tier0:domain-admins"] > base_len, "removing the DA edge lengthens the path"

    # there are MULTIPLE paths to dc01 (via svc-backup/Backup Operators, and via
    # unconstrained delegation on fs01), so no single control severs everything...
    severing = [c for c, v in results.items() if v is None]
    assert not severing, "defence in depth on the attacker's side: no single fix wins"

    # ...but the cached helpdesk credential is on the critical path of the
    # two shortest routes -- removing it is the highest-value single control
    assert results["cred-cache:helpdesk"] is not None
    assert results["cred-cache:helpdesk"] > base_len

    # a control on an edge that isn't on any short path does nothing
    assert results["sql-lockdown:app01"] == base_len

    print("\n  no single control saves you (the attacker has redundant paths), but")
    print("  the cached helpdesk cred sits on every short route -- fix that first.")
    print("\nPASS — shortest-path search + control ablation ranks the fixes by real effect.")


if __name__ == "__main__":
    main()
