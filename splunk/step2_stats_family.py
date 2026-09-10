#!/usr/bin/env python3
"""
Splunk · Step 2 — stats vs eventstats vs streamstats, and lookup.

The #1 SPL confusion:

    stats       collapses the pipeline to ONE row per group (you lose the events)
    eventstats  computes the same aggregate but ADDS it as a column to EVERY event
                (rows preserved) -- use it to compare each event to its group
    streamstats computes a RUNNING aggregate in event order (cumulative sum,
                moving count, "time since last") -- one row per event, value
                depends on position

    lookup      left-joins a table onto the pipeline by a key field (enrichment)

This runs all four on one dataset and checks they behave differently.
"""
import statistics as st

# (order, user, action, amount)
EVENTS = [
    {"i": 1, "user": "alice", "action": "login",    "amount": 0},
    {"i": 2, "user": "alice", "action": "transfer",  "amount": 40},
    {"i": 3, "user": "bob",   "action": "login",     "amount": 0},
    {"i": 4, "user": "alice", "action": "transfer",  "amount": 900},
    {"i": 5, "user": "bob",   "action": "transfer",  "amount": 25},
    {"i": 6, "user": "alice", "action": "transfer",  "amount": 60},
    {"i": 7, "user": "bob",   "action": "transfer",  "amount": 30},
]

# a lookup table: user -> risk tier / home country
USER_LOOKUP = {
    "alice": {"tier": "gold",   "home": "US"},
    "bob":   {"tier": "silver", "home": "DE"},
}


def stats_sum_by_user(events):
    g = {}
    for e in events:
        g.setdefault(e["user"], []).append(e["amount"])
    return [{"user": u, "total": sum(a), "events": len(a)} for u, a in g.items()]


def eventstats_avg_by_user(events):
    means = {}
    g = {}
    for e in events:
        g.setdefault(e["user"], []).append(e["amount"])
    for u, a in g.items():
        means[u] = round(st.mean(a), 1)
    out = []
    for e in events:
        e = dict(e)
        e["user_avg"] = means[e["user"]]
        e["vs_avg"] = round(e["amount"] - means[e["user"]], 1)
        out.append(e)
    return out


def streamstats_cumsum_by_user(events):
    running = {}
    cnt = {}
    out = []
    for e in events:                                  # event order matters
        e = dict(e)
        running[e["user"]] = running.get(e["user"], 0) + e["amount"]
        cnt[e["user"]] = cnt.get(e["user"], 0) + 1
        e["cum_amount"] = running[e["user"]]
        e["nth_for_user"] = cnt[e["user"]]
        out.append(e)
    return out


def lookup(events, table, key="user"):
    out = []
    for e in events:
        e = dict(e)
        e.update(table.get(e[key], {}))
        out.append(e)
    return out


def main():
    s = stats_sum_by_user(EVENTS)
    es = eventstats_avg_by_user(EVENTS)
    ss = streamstats_cumsum_by_user(EVENTS)
    lk = lookup(EVENTS, USER_LOOKUP)

    print("stats sum(amount) by user  (rows collapse):")
    for r in s: print("   ", r)
    print(f"\neventstats avg(amount) by user  ({len(es)} rows kept, column added):")
    for r in es: print("   ", {k: r[k] for k in ("i", "user", "amount", "user_avg", "vs_avg")})
    print(f"\nstreamstats sum(amount) by user  (running, event order):")
    for r in ss: print("   ", {k: r[k] for k in ("i", "user", "amount", "cum_amount", "nth_for_user")})
    print("\nlookup user -> tier/home:")
    for r in lk[:3]: print("   ", {k: r.get(k) for k in ("i", "user", "action", "tier", "home")})

    # stats: one row per user, events are gone
    assert len(s) == 2 and {r["user"] for r in s} == {"alice", "bob"}
    alice_total = next(r["total"] for r in s if r["user"] == "alice")
    assert alice_total == 1000

    # eventstats: every event survives, each carries its group's average
    assert len(es) == len(EVENTS)
    a_avg = round(st.mean([0, 40, 900, 60]), 1)          # alice's mean incl. the login 0
    assert all(r["user_avg"] == a_avg for r in es if r["user"] == "alice")
    big = next(r for r in es if r["i"] == 4)
    assert big["vs_avg"] > 600, "the $900 transfer is far above alice's own average"

    # streamstats: running total; the LAST alice event equals the stats total
    last_alice = [r for r in ss if r["user"] == "alice"][-1]
    assert last_alice["cum_amount"] == alice_total
    # ...but an earlier alice event has a smaller cumulative -> order-dependent
    first_alice_transfer = next(r for r in ss if r["user"] == "alice" and r["action"] == "transfer")
    assert first_alice_transfer["cum_amount"] == 40 < alice_total

    # lookup: enrichment, no row change
    assert len(lk) == len(EVENTS)
    assert all(("tier" in r) for r in lk)
    assert next(r for r in lk if r["user"] == "bob")["home"] == "DE"

    print("\n  stats -> summary table.  eventstats -> compare each event to its group.")
    print("  streamstats -> cumulative / 'so far' in time order.  lookup -> enrich.")
    print("\nPASS — the three stats verbs give genuinely different shapes from one dataset.")


if __name__ == "__main__":
    main()
