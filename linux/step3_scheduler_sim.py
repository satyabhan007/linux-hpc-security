#!/usr/bin/env python3
"""
Linux internals · Step 3 — a fair scheduler in ~40 lines (CFS-style vruntime).

CFS (and its successor EEVDF) keep one idea: track each task's *virtual
runtime* (real CPU time it has consumed, divided by its weight), and
always run whoever has the smallest vruntime. Higher weight (lower
`nice`) => vruntime grows slower => the task is picked more often =>
it gets a proportionally larger share of the CPU.

We run a set of tasks on one CPU for many ticks and check the CPU time
each receives matches its weight share.
"""
import heapq

# nice value -> scheduler weight (from kernel/sched/core.c prio_to_weight,
# nice 0 == 1024, each nice step is ~1.25x).
NICE_TO_WEIGHT = {
    -5: 3121, -1: 1277, 0: 1024, 1: 820, 5: 335, 10: 110,
}

TICK = 1  # ms per scheduling slice


class Task:
    def __init__(self, name, nice):
        self.name = name
        self.weight = NICE_TO_WEIGHT[nice]
        self.nice = nice
        self.vruntime = 0.0
        self.cpu_ms = 0

    def run_one_tick(self):
        self.cpu_ms += TICK
        # vruntime advances by real_time * (base_weight / my_weight)
        self.vruntime += TICK * (NICE_TO_WEIGHT[0] / self.weight)


def schedule(tasks, total_ms):
    # min-heap keyed by (vruntime, name) — "run the one furthest behind"
    heap = [(t.vruntime, t.name, t) for t in tasks]
    heapq.heapify(heap)
    clock = 0
    while clock < total_ms:
        vr, name, t = heapq.heappop(heap)
        t.run_one_tick()
        clock += TICK
        heapq.heappush(heap, (t.vruntime, t.name, t))


def main():
    tasks = [
        Task("batch_lo", nice=10),
        Task("normal_a", nice=0),
        Task("normal_b", nice=0),
        Task("latency_hi", nice=-5),
    ]
    TOTAL = 20_000  # 20 seconds of CPU on one core

    schedule(tasks, TOTAL)

    total_weight = sum(t.weight for t in tasks)
    print(f"{'task':>12}  {'nice':>4}  {'weight':>6}  {'CPU %':>7}  {'fair %':>7}")
    max_err = 0.0
    for t in tasks:
        got = 100 * t.cpu_ms / TOTAL
        fair = 100 * t.weight / total_weight
        err = abs(got - fair)
        max_err = max(max_err, err)
        print(f"{t.name:>12}  {t.nice:>4}  {t.weight:>6}  {got:>6.1f}%  {fair:>6.1f}%")

    print(f"\n  max deviation from weight-proportional share: {max_err:.2f} pp")

    # The high-priority task should get many times the low-priority one.
    hi = next(t for t in tasks if t.name == "latency_hi")
    lo = next(t for t in tasks if t.name == "batch_lo")
    ratio = hi.cpu_ms / lo.cpu_ms
    print(f"  latency_hi got {ratio:.1f}x the CPU of batch_lo "
          f"(weights differ {hi.weight / lo.weight:.1f}x)")

    assert max_err < 1.5, "fair scheduler should track weight share within ~1pp"
    assert abs(ratio - hi.weight / lo.weight) < 3
    # the two equal-nice tasks should get near-identical time
    a = next(t for t in tasks if t.name == "normal_a")
    b = next(t for t in tasks if t.name == "normal_b")
    assert abs(a.cpu_ms - b.cpu_ms) <= 2 * TICK

    print("\nPASS — smallest-vruntime-first gives weight-proportional CPU shares.")


if __name__ == "__main__":
    main()
