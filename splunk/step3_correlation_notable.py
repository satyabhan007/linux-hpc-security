#!/usr/bin/env python3
"""
Splunk · Step 3 — a correlation search -> notable events, with throttling
and risk-based alerting (RBA).

A scheduled correlation search runs every few minutes over a sliding
window. Classic form:

    ... | bin _time span=10m | stats count by user, _time
        | where count > 5 | ...create notable...

Two things that separate a real ES rule from a naive one:
  * throttle / suppression: don't re-fire the same notable for the same
    entity within a window (else one incident = 200 notables)
  * risk-based alerting: instead of one rule = one alert, each rule adds
    a risk score to an entity; a notable fires only when an entity's
    summed risk over 24h crosses a threshold (fewer, higher-fidelity).

This models both over a synthetic auth-failure stream.
"""

WINDOW_S = 600           # 10-minute correlation window
FAIL_THRESHOLD = 5
THROTTLE_S = 3600        # suppress repeat notables per user for 1h
RISK_THRESHOLD = 100     # RBA: notable when an entity's 24h risk sum exceeds this


def make_events():
    """(t_seconds, user, kind) — kind in {auth_fail, mfa_deny, impossible_travel}"""
    ev = []
    # alice: a sustained brute force from t=100, ~1 fail / 30s for 40 min
    for k in range(80):
        ev.append((100 + k * 30, "alice", "auth_fail"))
    ev.append((300, "alice", "impossible_travel"))
    # bob: two fat-finger failures, well under threshold
    ev += [(500, "bob", "auth_fail"), (1200, "bob", "auth_fail")]
    # carol: a short burst of 6 in one window, then stops (one real notable)
    for k in range(6):
        ev.append((2000 + k * 20, "carol", "auth_fail"))
    ev.append((2050, "carol", "mfa_deny"))
    ev.sort()
    return ev


def correlation_search(events, throttle=True):
    """Sliding 10-min window; fire when a user has > FAIL_THRESHOLD auth_fail
    in the window. With throttle: at most one notable per user per THROTTLE_S."""
    fails_by_user = {}
    notables = []
    last_fire = {}
    for t, user, kind in events:
        if kind != "auth_fail":
            continue
        dq = fails_by_user.setdefault(user, [])
        dq.append(t)
        while dq and t - dq[0] > WINDOW_S:
            dq.pop(0)
        if len(dq) > FAIL_THRESHOLD:
            if throttle and user in last_fire and t - last_fire[user] < THROTTLE_S:
                continue
            notables.append((t, user, len(dq)))
            last_fire[user] = t
    return notables


RISK = {"auth_fail": 8, "mfa_deny": 25, "impossible_travel": 60}


def risk_based(events, window_s=86400):
    """Sum risk per entity over a rolling 24h window; notable when it
    crosses RISK_THRESHOLD (once per crossing)."""
    per_user = {}
    fired = set()
    notables = []
    for t, user, kind in events:
        dq = per_user.setdefault(user, [])
        dq.append((t, RISK.get(kind, 1)))
        while dq and t - dq[0][0] > window_s:
            dq.pop(0)
        total = sum(r for _, r in dq)
        if total >= RISK_THRESHOLD and user not in fired:
            notables.append((t, user, total))
            fired.add(user)
    return notables


def main():
    events = make_events()
    n_fail = sum(1 for _, _, k in events if k == "auth_fail")
    print(f"events: {len(events)}  ({n_fail} auth_fail)\n")

    raw = correlation_search(events, throttle=False)
    throttled = correlation_search(events, throttle=True)
    rba = risk_based(events)

    print(f"  naive correlation search : {len(raw)} notables "
          f"(alice alone: {sum(1 for _,u,_ in raw if u=='alice')})")
    print(f"  + throttle (1 / user / 1h): {len(throttled)} notables -> {[u for _,u,_ in throttled]}")
    print(f"  risk-based alerting        : {len(rba)} notables -> "
          f"{[(u, r) for _,u,r in rba]}")

    # naive fires once per event past the threshold -> notable storm for alice
    assert sum(1 for _, u, _ in raw if u == "alice") > 20, "no throttle = notable storm"

    # throttle collapses alice's storm to ~1 per hour; carol's single burst -> 1
    a_throttled = [x for x in throttled if x[1] == "alice"]
    assert 1 <= len(a_throttled) <= 3, "40 min of brute force -> at most a few notables/hour"
    assert any(u == "carol" for _, u, _ in throttled)
    assert not any(u == "bob" for _, u, _ in throttled), "2 fails is under threshold"

    # RBA: alice crosses on volume+context (fails + impossible_travel),
    # carol crosses (6 fails * 8 = 48, + mfa_deny 25 = 73 -> under 100, so NO)
    rba_users = {u for _, u, _ in rba}
    assert "alice" in rba_users
    assert "carol" not in rba_users, "carol's 73 risk is below the 100 threshold - correctly quiet"
    assert "bob" not in rba_users
    assert len(rba) == 1, "RBA yields ONE high-fidelity notable, not a pile"

    # RBA notable count << throttled << naive
    assert len(rba) < len(throttled) < len(raw)

    print("\n  naive: 1 alert per event.  throttle: 1 per entity per hour.")
    print("  RBA: 1 per entity per day, only when accumulated risk says so.")
    print("\nPASS — throttling and RBA turn a 30-notable storm into 1 actionable alert.")


if __name__ == "__main__":
    main()
