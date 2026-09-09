#!/usr/bin/env python3
"""
HPC · Step 3 — topology-aware job placement on a fat-tree.

Slurm's topology/tree plugin knows which leaf switch each node hangs off.
For a communication-heavy job you want all its nodes under as few leaf
switches as possible, so traffic stays local instead of climbing to the
spine. This packs a job onto the fewest leaves (best-fit) and compares
against a naive "first free nodes in node-name order" placement.
"""

# leaf switch -> list of nodes on it (18 nodes per leaf, 8 leaves)
TOPOLOGY = {f"leaf{L}": [f"n{L*18 + i:03d}" for i in range(18)] for L in range(8)}


def leaf_of(node):
    for leaf, nodes in TOPOLOGY.items():
        if node in nodes:
            return leaf
    return None


def naive_place(free, k):
    return sorted(free)[:k]


def topo_place(free, k):
    # nodes free per leaf
    by_leaf = {}
    for n in free:
        by_leaf.setdefault(leaf_of(n), []).append(n)
    # prefer leaves that can host the most of the job (best-fit),
    # tie-break on fewer total free (leave big holes for big jobs)
    order = sorted(by_leaf, key=lambda L: (-min(len(by_leaf[L]), k), len(by_leaf[L])))
    chosen, need = [], k
    for L in order:
        take = by_leaf[L][:need]
        chosen += take
        need -= len(take)
        if need == 0:
            break
    return chosen


def leaves_used(nodes):
    return {leaf_of(n) for n in nodes}


def main():
    # fragment the cluster: leaf0..5 nearly full (only 3 free each),
    # leaf6 and leaf7 completely free. Naive (node-name order) will hop
    # across the fragmented low leaves; best-fit will land on leaf6/7.
    import itertools
    all_nodes = list(itertools.chain.from_iterable(TOPOLOGY.values()))
    free = []
    for L in range(8):
        nodes = TOPOLOGY[f"leaf{L}"]
        free += nodes if L >= 6 else nodes[:3]
    busy = [n for n in all_nodes if n not in set(free)]

    print(f"cluster: {len(all_nodes)} nodes / 8 leaves, {len(free)} free "
          f"(leaf0-5: 3 each, leaf6-7: full)\n")

    for k in (8, 16, 32):
        np = naive_place(free, k)
        tp = topo_place(free, k)
        ln, lt = leaves_used(np), leaves_used(tp)
        print(f"  job needs {k:>2} nodes:  naive spans {len(ln)} leaves, "
              f"topo spans {len(lt)} leaves   ({sorted(lt)})")
        assert len(np) == len(tp) == k
        assert len(lt) <= len(ln), "topo placement must never use MORE leaves than naive"

    # for a job that fits in ~2 leaves' worth of free nodes, topo should
    # get it well under naive
    k = 24
    np, tp = naive_place(free, k), topo_place(free, k)
    ln, lt = leaves_used(np), leaves_used(tp)
    print(f"\n  job needs {k}:  naive {len(ln)} leaves vs topo {len(lt)} leaves")
    assert len(lt) < len(ln), "topo should meaningfully reduce leaf spread here"

    # a fully-free cluster: topo packs a 18-node job onto exactly 1 leaf
    tp_full = topo_place(all_nodes, 18)
    assert len(leaves_used(tp_full)) == 1

    print("\nPASS — best-fit topology placement keeps jobs under fewer leaf switches.")


if __name__ == "__main__":
    main()
