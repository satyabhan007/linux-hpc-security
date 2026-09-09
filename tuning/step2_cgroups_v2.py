#!/usr/bin/env python3
"""
Tuning · Step 2 — cgroups v2 CPU and memory control.

Three controls, modelled:
  cpu.max    "QUOTA PERIOD" — a hard ceiling: at most QUOTA microseconds
             of CPU per PERIOD microseconds (so "50000 100000" = 0.5 CPU).
  cpu.weight proportional share (default 100) of whatever is LEFT after
             quotas, when the CPU is contended.
  memory.max hard cap; a cgroup that tries to exceed it after reclaim
             gets an OOM kill scoped to that cgroup.

Slurm's cgroup plugin uses exactly these so a job that asked for 4 cores
and 16 GiB physically cannot exceed them.
"""


def cpu_max_ceiling(quota, period, host_cpus):
    if quota is None:            # "max" -> no ceiling
        return host_cpus
    return quota / period        # in CPUs


def distribute_by_weight(demands_weights, capacity):
    """demands_weights: {name: (cpu_demand, weight)}; share `capacity` CPUs
    proportionally to weight, capped by each cgroup's own demand. Unused
    share of a capped cgroup spills to the rest by weight (water-filling)."""
    alloc = {n: 0.0 for n in demands_weights}
    demand = {n: d for n, (d, w) in demands_weights.items()}
    weight = {n: w for n, (d, w) in demands_weights.items()}
    active = {n for n, (d, w) in demands_weights.items() if d > 0}
    remaining = capacity

    for _ in range(100):
        if remaining <= 1e-9 or not active:
            break
        tw = sum(weight[n] for n in active)
        pass_alloc = {n: remaining * weight[n] / tw for n in active}
        newly_full = []
        for n in list(active):
            give = min(demand[n] - alloc[n], pass_alloc[n])
            alloc[n] += give
            remaining -= give
            if alloc[n] >= demand[n] - 1e-9:
                newly_full.append(n)
        for n in newly_full:
            active.discard(n)
        if not newly_full:            # everyone took their full weighted share
            break
    return alloc


def mem_event(current_mb, alloc_mb, limit_mb):
    """Return 'ok' | 'reclaim' | 'oom' for an allocation attempt."""
    want = current_mb + alloc_mb
    if want <= limit_mb:
        return "ok", want
    # kernel tries reclaim (page cache, clean pages) — model as up to 20% headroom
    reclaimable = 0.20 * limit_mb
    if want - reclaimable <= limit_mb:
        return "reclaim", limit_mb
    return "oom", current_mb          # cgroup OOM kills the offender; usage snaps back


def main():
    HOST_CPUS = 8

    print("cpu.max ceilings:")
    for q, p in [(None, 100000), (400000, 100000), (50000, 100000), (25000, 50000)]:
        c = cpu_max_ceiling(q, p, HOST_CPUS)
        print(f"  cpu.max = {str(q):>7} {p}  ->  {c:g} CPU ceiling")
    assert cpu_max_ceiling(400000, 100000, HOST_CPUS) == 4.0
    assert cpu_max_ceiling(25000, 50000, HOST_CPUS) == 0.5
    assert cpu_max_ceiling(None, 100000, HOST_CPUS) == HOST_CPUS

    print("\ncpu.weight under contention (8 CPUs, all cgroups want a lot):")
    # jobA weight 200 wants 8, jobB weight 100 wants 8, jobC weight 100 wants 1
    dw = {"jobA(w200)": (8, 200), "jobB(w100)": (8, 100), "jobC(w100)": (1, 100)}
    alloc = distribute_by_weight(dw, HOST_CPUS)
    for n, a in alloc.items():
        print(f"  {n:>12}: {a:.2f} CPU")
    assert abs(sum(alloc.values()) - HOST_CPUS) < 1e-6, "all CPU handed out"
    assert alloc["jobC(w100)"] <= 1.0 + 1e-9, "capped at its own demand"
    # jobC only needs 1; its unused share spills to A and B by weight (2:1)
    assert alloc["jobA(w200)"] > alloc["jobB(w100)"]
    assert abs(alloc["jobA(w200)"] / alloc["jobB(w100)"] - 2.0) < 0.1

    print("\nmemory.max = 16384 MiB, a job that leaks:")
    cur, events = 12000, []
    for step_mb, label in [(3000, "grow to ~15G"),
                           (1400, "push past the cap -> reclaim"),
                           (5000, "spike +5G -> cgroup OOM")]:
        ev, cur = mem_event(cur, step_mb, 16384)
        events.append(ev)
        print(f"  +{step_mb:>5} MiB ({label:<30}) -> {ev:<8} usage now {cur:.0f} MiB")
    assert events == ["ok", "reclaim", "oom"], events
    assert cur == 16384, "OOM refuses the offending allocation; usage stays at the cap"

    print("\n  a job on a shared node is boxed in on all three axes — it cannot")
    print("  starve neighbours (weight), exceed its cores (cpu.max), or OOM the box.")
    print("\nPASS — cpu.max caps, cpu.weight shares the remainder, memory.max OOMs in-cgroup.")


if __name__ == "__main__":
    main()
