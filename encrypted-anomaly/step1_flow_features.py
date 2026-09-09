#!/usr/bin/env python3
"""
Encrypted Anomaly · Step 1 — features from a flow you cannot decrypt.

TLS/QUIC hide the payload. You still see, per flow:
  * packet SIZES and their sequence  (TLS record framing leaks structure)
  * DIRECTION of each packet (client->server / server->client)
  * INTER-ARRIVAL times
  * total bytes up / down, duration, packet count

These "side-channel" features separate a lot of behaviour without ever
decrypting anything. This lab builds the feature vector and shows that
web browsing, bulk exfiltration, and interactive C2 land in different
regions of feature space.
"""
import math
import statistics as st

# Each flow: list of (t_seconds, signed_size)  ; +size = client->server, -size = server->client
BENIGN_BROWSE = [
    (0.00, 220), (0.03, -1460), (0.03, -1460), (0.04, -1460), (0.05, -820),
    (0.20, 190), (0.22, -1460), (0.23, -1460), (0.24, -410),
    (1.10, 175), (1.14, -1460), (1.15, -1460), (1.15, -1460), (1.16, -300),
    (3.90, 165), (3.95, -980),
]
BULK_EXFIL = [(i * 0.002, 1460) for i in range(600)] + [(1.3, -120)]
INTERACTIVE_C2 = [
    (0.0, 74), (0.4, -66), (5.1, 120), (5.5, -410),
    (10.2, 88), (10.6, -66), (15.3, 300), (15.9, -1200),
    (20.1, 74), (20.4, -66), (25.2, 512), (25.7, -260),
]


def features(flow):
    ts = [t for t, _ in flow]
    sizes = [s for _, s in flow]
    up = [s for s in sizes if s > 0]
    down = [-s for s in sizes if s < 0]
    iats = [b - a for a, b in zip(ts, ts[1:])] or [0.0]
    dur = (ts[-1] - ts[0]) or 1e-6
    tot_up, tot_down = sum(up), sum(down)
    return {
        "pkts": len(flow),
        "dur_s": round(dur, 3),
        "bytes_up": tot_up,
        "bytes_down": tot_down,
        "updown_ratio": round(tot_up / max(tot_down, 1), 3),
        "mean_size": round(st.fmean(abs(s) for s in sizes), 1),
        "size_entropy": round(_entropy([abs(s) for s in sizes]), 2),
        "mean_iat_ms": round(1000 * st.fmean(iats), 1),
        "iat_cv": round((st.pstdev(iats) / st.fmean(iats)) if st.fmean(iats) else 0, 2),
        "pps": round(len(flow) / dur, 1),
    }


def _entropy(vals):
    n = len(vals)
    counts = {}
    for v in vals:
        b = v // 256  # coarse buckets
        counts[b] = counts.get(b, 0) + 1
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def classify(f):
    """A tiny rule model standing in for a trained detector."""
    if f["updown_ratio"] > 8 and f["bytes_up"] > 200_000 and f["pps"] > 100:
        return "EXFIL (large sustained upload, few responses)"
    if f["pkts"] < 40 and f["dur_s"] > 8 and f["mean_size"] < 600 \
            and 0.2 < f["iat_cv"] < 1.5 and f["mean_iat_ms"] > 1500:
        return "C2 (sparse, small, periodic request/response)"
    if f["bytes_down"] > 3 * max(f["bytes_up"], 1) and f["dur_s"] < 8:
        return "WEB (bursty download, short, server-heavy)"
    return "unclassified"


def main():
    cases = [("benign browsing", BENIGN_BROWSE, "WEB"),
             ("bulk exfiltration", BULK_EXFIL, "EXFIL"),
             ("interactive C2", INTERACTIVE_C2, "C2")]
    for name, flow, expect in cases:
        f = features(flow)
        verdict = classify(f)
        print(f"\n== {name} ==")
        for k, v in f.items():
            print(f"   {k:>14}: {v}")
        print(f"   -> {verdict}")
        assert verdict.startswith(expect), (name, verdict)

    # the point: these three are trivially separable on metadata alone
    fb = features(BENIGN_BROWSE)
    fe = features(BULK_EXFIL)
    fc = features(INTERACTIVE_C2)
    assert fe["updown_ratio"] > 20 * fb["updown_ratio"]
    assert fc["mean_iat_ms"] > 5 * fb["mean_iat_ms"]      # C2 is far more spread out in time
    assert fc["pps"] < 0.2 * fb["pps"]                    # ...and far sparser
    assert fb["bytes_down"] > 3 * fb["bytes_up"]          # browsing pulls down, not up

    print("\n  no payload was decrypted. Direction + size + timing did the work.")
    print("  Real systems (Zeek + ML, Corelight, RITA, ET's encrypted-traffic")
    print("  models) use exactly these features at scale.")
    print("\nPASS — web / exfil / C2 separate cleanly on encrypted-flow metadata.")


if __name__ == "__main__":
    main()
