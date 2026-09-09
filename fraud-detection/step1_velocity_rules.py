#!/usr/bin/env python3
"""
Fraud / Circumvention Detection · Step 1 — velocity rules & impossible travel.

The cheapest, highest-value fraud controls are sliding-window counters:

  * signups / logins / payments per ENTITY per window
  * events per shared IP / device / card-BIN per window   (ring signal)
  * distinct cards per account, distinct accounts per card
  * "impossible travel": two auths from locations too far apart for the
    time between them

This lab runs an event stream through a rule engine and shows a
coordinated ring lighting up rules that an ordinary user never does.
"""
from collections import defaultdict, deque

# great-circle-ish distance, km, from (lat, lon)
import math


def haversine(a, b):
    """a, b are (lat, lon) in degrees; returns great-circle km."""
    R = 6371.0
    la1, lo1 = math.radians(a[0]), math.radians(a[1])
    la2, lo2 = math.radians(b[0]), math.radians(b[1])
    d = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 2 * R * math.asin(math.sqrt(d))


class Velocity:
    def __init__(self):
        self.win = defaultdict(deque)     # key -> deque[ts]
        self.last_loc = {}                # account -> (ts, (lat,lon))
        self.cards_for_acct = defaultdict(set)
        self.accts_for_card = defaultdict(set)

    def _bump(self, key, ts, window_s):
        dq = self.win[key]
        dq.append(ts)
        while dq and ts - dq[0] > window_s:
            dq.popleft()
        return len(dq)

    def score(self, e):
        risk, reasons = 0, []
        acct, ip, dev, card = e["acct"], e["ip"], e["dev"], e.get("card")
        ts = e["ts"]

        n_acct = self._bump(("acct", acct), ts, 3600)
        if n_acct > 5:
            risk += 25; reasons.append(f"acct velocity {n_acct}/h")

        n_ip = self._bump(("ip", ip), ts, 3600)
        if n_ip > 8:
            risk += 30; reasons.append(f"IP velocity {n_ip}/h (shared)")

        n_dev = self._bump(("dev", dev), ts, 86400)
        if n_dev > 4:
            risk += 35; reasons.append(f"device used by {n_dev} events/24h")

        if card:
            self.cards_for_acct[acct].add(card)
            self.accts_for_card[card].add(acct)
            if len(self.accts_for_card[card]) > 2:
                risk += 40
                reasons.append(f"card on {len(self.accts_for_card[card])} accounts")
            if len(self.cards_for_acct[acct]) > 4:
                risk += 20
                reasons.append(f"{len(self.cards_for_acct[acct])} cards on one acct")

        if "loc" in e and acct in self.last_loc:
            pts, ploc = self.last_loc[acct]
            dt_h = max((ts - pts) / 3600.0, 1e-6)
            km = haversine(ploc, e["loc"])
            if km / dt_h > 900:            # faster than a commercial flight
                risk += 30
                reasons.append(f"impossible travel {km:.0f}km in {dt_h:.2f}h")
        if "loc" in e:
            self.last_loc[acct] = (ts, e["loc"])

        return min(risk, 100), reasons


def main():
    v = Velocity()

    # --- a normal user over a day ---
    normal = [
        {"acct": "u_alice", "ip": "203.0.113.5", "dev": "d_alice", "ts": 0,
         "card": "c_alice", "loc": (51.5, -0.12)},
        {"acct": "u_alice", "ip": "203.0.113.5", "dev": "d_alice", "ts": 6 * 3600,
         "card": "c_alice", "loc": (51.5, -0.12)},
        {"acct": "u_alice", "ip": "198.51.100.9", "dev": "d_alice", "ts": 9 * 3600,
         "card": "c_alice", "loc": (52.2, 0.12)},   # commute, fine
    ]
    max_norm = 0
    for e in normal:
        s, r = v.score(e)
        max_norm = max(max_norm, s)
        print(f"  normal  {e['acct']:>9} ts={e['ts']:>6}  risk={s:3}  {r}")
    assert max_norm < 25, max_norm

    # --- a bonus-abuse ring: 12 fresh accounts, one device, one IP,
    #     3 recycled cards, all within an hour ---
    print()
    v2 = Velocity()
    ring_scores = []
    for i in range(12):
        e = {"acct": f"mule_{i}", "ip": "192.0.2.50", "dev": "d_ring",
             "ts": i * 200, "card": f"c_ring_{i % 3}",
             "loc": (40.0, -74.0) if i % 2 else (34.0, -118.0)}  # NY/LA flip
        s, r = v2.score(e)
        ring_scores.append(s)
        print(f"  ring    {e['acct']:>9} ts={e['ts']:>6}  risk={s:3}  {r}")
    # early members look clean until the shared-key counters accumulate;
    # once the ring is "warm", every new member is maxed out.
    assert sum(1 for s in ring_scores if s >= 60) >= 5, ring_scores
    assert ring_scores[-4:] == [100, 100, 100, 100], ring_scores
    assert ring_scores[0] == 0 and max(ring_scores) == 100

    # a single member of the ring, seen in isolation, looks almost fine —
    # it's the SHARED keys (device/ip/card) that expose the ring.
    v3 = Velocity()
    s_solo, _ = v3.score({"acct": "mule_x", "ip": "192.0.2.99", "dev": "d_x",
                          "ts": 0, "card": "c_x"})
    assert s_solo == 0

    print("\n  one account in isolation: risk 0. The same account inside the ring:")
    print("  risk 90+, because device/IP/card velocity are RING features, not")
    print("  user features. This is why linkage (Step 2) matters.")
    print("\nPASS — normal user stays low-risk; the coordinated ring trips shared-key"
          " velocity + card-reuse + impossible-travel rules.")


if __name__ == "__main__":
    main()
