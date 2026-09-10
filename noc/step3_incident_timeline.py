#!/usr/bin/env python3
"""
NOC · Step 3 — the incident lifecycle: SEV classification, MTT* metrics,
and the escalation timer.

An incident moves through states:
  OPEN -> ACK -> MITIGATING -> MITIGATED -> RESOLVED  (-> POSTMORTEM)

From the timestamps you get the metrics leadership actually tracks:
  MTTD = detect  - begin        (how long it was happening unseen)
  MTTA = ack     - detect       (paging / on-call responsiveness)
  MTTM = mitigate - detect      (time to stop the bleeding)
  MTTR = resolve - detect       (time to fully fixed)

SEV is a function of user impact x scope. An unacked page past the
escalation SLA auto-escalates to the next tier / the IC.
"""

ESCALATION_SLA_MIN = {"SEV1": 5, "SEV2": 15, "SEV3": 30, "SEV4": 120}


def classify_sev(pct_users_affected, revenue_impacting, data_loss):
    if data_loss or pct_users_affected >= 50:
        return "SEV1"
    if revenue_impacting or pct_users_affected >= 10:
        return "SEV2"
    if pct_users_affected >= 1:
        return "SEV3"
    return "SEV4"


def metrics(ev):
    """ev: dict of state -> minute-offset from t0. 'begin' and 'detect' required."""
    d = ev["detect"]
    out = {
        "MTTD": d - ev["begin"],
        "MTTA": ev.get("ack", d) - d,
        "MTTM": ev.get("mitigate", ev.get("resolve", d)) - d,
        "MTTR": ev.get("resolve", d) - d,
    }
    return out


def escalated(ev, sev):
    ack_delay = ev.get("ack", 10 ** 9) - ev["detect"]
    return ack_delay > ESCALATION_SLA_MIN[sev]


INCIDENTS = [
    dict(name="checkout 500s",   users=35, rev=True,  data=False,
         begin=0, detect=6,  ack=3 + 6,  mitigate=6 + 18, resolve=6 + 55),
    dict(name="search slow",     users=8,  rev=False, data=False,
         begin=0, detect=12, ack=12 + 22, mitigate=12 + 40, resolve=12 + 70),  # slow ack
    dict(name="full outage",     users=100, rev=True, data=False,
         begin=0, detect=2,  ack=2 + 1,  mitigate=2 + 9,  resolve=2 + 40),
    dict(name="stale cache",     users=2,  rev=False, data=False,
         begin=0, detect=25, ack=25 + 8, mitigate=25 + 20, resolve=25 + 35),
    dict(name="backup DB purge", users=0,  rev=False, data=True,
         begin=0, detect=45, ack=45 + 4, mitigate=45 + 30, resolve=45 + 240),
]


def main():
    print(f"{'incident':>16} {'SEV':>5} {'MTTD':>5} {'MTTA':>5} {'MTTM':>5} {'MTTR':>6} esc?")
    agg = {"MTTD": [], "MTTA": [], "MTTM": [], "MTTR": []}
    sev_count = {}
    for inc in INCIDENTS:
        sev = classify_sev(inc["users"], inc["rev"], inc["data"])
        sev_count[sev] = sev_count.get(sev, 0) + 1
        m = metrics(inc)
        for k in agg:
            agg[k].append(m[k])
        esc = escalated(inc, sev)
        print(f"{inc['name']:>16} {sev:>5} {m['MTTD']:>5} {m['MTTA']:>5} "
              f"{m['MTTM']:>5} {m['MTTR']:>6} {'YES' if esc else '-'}")

    print("\n  fleet MTT* (mean minutes):")
    for k, vals in agg.items():
        print(f"    {k}: {sum(vals) / len(vals):.1f}")

    # SEV classification checks
    assert classify_sev(100, True, False) == "SEV1"
    assert classify_sev(0, False, True) == "SEV1"            # data loss -> SEV1 regardless
    assert classify_sev(35, True, False) == "SEV2"
    assert classify_sev(8, False, False) == "SEV3"
    assert classify_sev(0.2, False, False) == "SEV4"

    # 'search slow' had a 22-min ack on a SEV3 (SLA 30) -> not escalated;
    # but 'checkout 500s' is SEV2 (SLA 15) with a 3-min ack -> not escalated
    assert not escalated(INCIDENTS[0], "SEV2")
    # craft one that breaches: SEV1 with a 9-min ack
    slow = dict(detect=0, ack=9)
    assert escalated(slow, "SEV1"), "9-min ack on a SEV1 (SLA 5) must escalate"

    # the data-loss incident has the worst MTTD and MTTR (found late, long restore)
    by_mttd = max(INCIDENTS, key=lambda i: metrics(i)["MTTD"])
    by_mttr = max(INCIDENTS, key=lambda i: metrics(i)["MTTR"])
    assert by_mttd["name"] == "backup DB purge" == by_mttr["name"]

    # the full outage was detected fastest (monitoring catches 100% impact quickest)
    by_fast = min(INCIDENTS, key=lambda i: metrics(i)["MTTD"])
    assert by_fast["name"] == "full outage"

    print("\n  MTTD is the metric teams under-invest in — you can't ack what you")
    print("  can't see. Improving detection often beats improving response.")
    print("\nPASS — SEV from impact x scope; MTT* from timestamps; escalation on ack SLA.")


if __name__ == "__main__":
    main()
