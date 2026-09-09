#!/usr/bin/env python3
"""
Hardening · Step 3 — find privilege-escalation paths from an unprivileged user.

Model the host as a graph. Nodes are privilege states ("user:alice",
"group:docker", "root"). Edges are escalation primitives with a
precondition and a technique (GTFOBins-style). BFS from the user's
starting privileges to "root" enumerates every path; the shortest is
what an attacker takes.
"""
from collections import deque

# facts about the host / the compromised account
FACTS = {
    "user:alice",
    "group:alice",
    "group:wheel",                       # alice is in wheel
    "sudo:/usr/bin/less *",              # NOPASSWD-ish broad sudo rule
    "suid:/usr/bin/find",                # find has the SUID bit (misconfig)
    "writable:/etc/cron.d",              # world-writable cron dir
    "cap:cap_setuid+ep:/opt/app/helper", # a binary with cap_setuid
}

# (from_priv, needs {facts}, gains_priv, technique)
EDGES = [
    ("user:alice", {"sudo:/usr/bin/less *"}, "root",
     "sudo less /etc/profile  then  !/bin/sh   (pager shell escape)"),
    ("user:alice", {"suid:/usr/bin/find"}, "root",
     "find . -exec /bin/sh -p \\; -quit   (SUID find runs shell as owner=root)"),
    ("user:alice", {"writable:/etc/cron.d"}, "root",
     "drop a cron job running /bin/sh -> root cron executes it"),
    ("user:alice", {"cap:cap_setuid+ep:/opt/app/helper"}, "root",
     "call helper -> setuid(0) -> exec shell   (file capability, no SUID needed)"),
    ("user:alice", {"group:docker"}, "root",
     "docker run -v /:/host --privileged ...   (docker group == root)"),
    ("user:alice", {"group:lxd"}, "root",
     "lxc init + mount host rootfs   (lxd group == root)"),
]


def escalation_paths(facts, start, target="root"):
    paths = []
    q = deque([(start, [start])])
    seen = {start}
    # BFS over privilege states; collect ALL simple paths to target
    while q:
        node, path = q.popleft()
        for frm, needs, gains, tech in EDGES:
            if frm != node:
                continue
            if not needs <= facts:
                continue
            step = f"{gains}  via  {tech}"
            new_path = path + [step]
            if gains == target:
                paths.append(new_path)
            elif gains not in seen:
                seen.add(gains)
                q.append((gains, new_path))
    return paths


def main():
    paths = escalation_paths(FACTS, "user:alice")

    print(f"privilege-escalation paths from 'user:alice' to root: {len(paths)}\n")
    for i, p in enumerate(paths, 1):
        print(f"  path {i}:")
        for step in p:
            print(f"    -> {step}" if step != p[0] else f"    {step}")
        print()

    # every one of these is a single hop — that is the point: each misconfig
    # is directly root, no chaining needed.
    assert len(paths) == 4, "expected 4 distinct one-hop root paths from the given facts"
    for p in paths:
        assert len(p) == 2, "each path should be exactly one escalation primitive"
    techniques = {p[1].split("via")[1].strip() for p in paths}
    assert any("pager shell escape" in t for t in techniques)
    assert any("SUID find" in t for t in techniques)

    print("  takeaway: 'alice is only a normal user' is false the moment ANY of")
    print("  {broad sudo, stray SUID, writable cron, setuid capability} exists.")
    print("\nPASS — 4 independent one-hop paths to root enumerated.")


if __name__ == "__main__":
    main()
