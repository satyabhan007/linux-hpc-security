#!/usr/bin/env python3
"""
HPC · Step 1 — the Slurm backfill scheduler.

Two passes every scheduling cycle:
  1. PRIORITY: sort pending jobs by priority. Walk the list; start any
     that fit now. The first one that does NOT fit gets a *reservation*:
     the earliest time enough nodes free up.
  2. BACKFILL: walk the rest of the queue; start a lower-priority job now
     IFF it finishes before the reservation time (so it cannot delay the
     top job). This is why an honest, short --time gets you in sooner.

We simulate one cycle on a small cluster.
"""

CLUSTER_NODES = 10


class Job:
    def __init__(self, jid, prio, nodes, walltime):
        self.jid, self.prio, self.nodes, self.walltime = jid, prio, nodes, walltime
        self.start = None


def schedule(running, pending, now=0):
    # running: list of (end_time, nodes). free-node timeline.
    free_now = CLUSTER_NODES - sum(n for _, n in running)
    events = sorted(set([now] + [e for e, _ in running]))

    def free_at(t):
        used = sum(n for e, n in running if e > t)
        return CLUSTER_NODES - used

    pending = sorted(pending, key=lambda j: -j.prio)
    started, reservation = [], None

    # ---- priority pass ----
    idx = 0
    for j in pending:
        if reservation is None and j.nodes <= free_now:
            j.start = now
            started.append(j)
            free_now -= j.nodes
            running.append((now + j.walltime, j.nodes))
        else:
            # first job that doesn't fit -> reserve its earliest start
            if reservation is None:
                for t in events + [max(events) + max(j.walltime for j in pending)]:
                    if free_at(t) >= j.nodes:
                        reservation = (j, t)
                        break
            break
        idx += 1

    # ---- backfill pass ----
    resv_job, resv_time = reservation if reservation else (None, None)
    for j in pending:
        if j in started or (resv_job and j is resv_job):
            continue
        if j.nodes <= free_now:
            # may we run without delaying the reservation?
            if resv_time is None or now + j.walltime <= resv_time:
                j.start = now
                started.append(j)
                free_now -= j.nodes
                running.append((now + j.walltime, j.nodes))
    return started, reservation


def main():
    # 6 of 10 nodes busy until t=100
    running = [(100, 6)]
    pending = [
        Job("big",   prio=1000, nodes=8, walltime=200),   # needs 8, only 4 free -> reserved
        Job("short", prio=500,  nodes=4, walltime=60),     # fits now, ends t=60 <= resv -> BACKFILL
        Job("long",  prio=400,  nodes=4, walltime=300),    # fits now but ends t=300 > resv -> BLOCKED
        Job("tiny",  prio=100,  nodes=2, walltime=30),     # 0 free left after 'short' -> not this cycle
    ]

    started, reservation = schedule(running, pending)
    started_ids = {j.jid for j in started}
    resv_job, resv_time = reservation

    print(f"cluster: {CLUSTER_NODES} nodes, 6 busy until t=100\n")
    for j in pending:
        state = f"START at t={j.start}" if j.start is not None else "pending"
        print(f"  {j.jid:<6} prio={j.prio:<5} {j.nodes} nodes {j.walltime:>3}s  -> {state}")
    print(f"\n  reservation: {resv_job.jid} can start at t={resv_time}")

    assert resv_job.jid == "big" and resv_time == 100
    assert "short" in started_ids, "short job must backfill (ends at 60 <= reservation 100)"
    assert "long" not in started_ids, "long job would end at 300 > 100 and delay 'big' — blocked"
    assert "tiny" not in started_ids, "no nodes left after short (4 free - 4)"

    # counter-check: if 'long' asked for --time=90 instead of 300, it WOULD backfill
    pending2 = [Job("big", 1000, 8, 200), Job("long", 400, 4, 90)]
    s2, _ = schedule([(100, 6)], pending2)
    assert any(j.jid == "long" for j in s2), "honest short walltime lets it backfill"

    print("\nPASS — short job backfills, long job is blocked; a tighter --time changes that.")


if __name__ == "__main__":
    main()
