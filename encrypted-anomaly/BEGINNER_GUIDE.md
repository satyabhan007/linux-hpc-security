# Anomaly Detection on Encrypted Activity — The Amateur's Guide

> You can't hear what people are saying through the wall, but you can
> still tell a dinner party from a burglary: how many people, how long,
> how much comes in and out the door, whether someone leaves on a
> perfectly regular schedule. Encrypted-traffic analysis is listening to
> the *shape* of the conversation instead of the words.

By 2024, ~95% of web traffic is TLS, most malware C2 is TLS, and
DNS-over-HTTPS hides even the domain. Deep-packet inspection of the
payload is over. What replaced it is **metadata and behaviour analysis**
— and it works surprisingly well.

---

## 1. What you still see when everything is encrypted

| Layer | Still visible (pre-ECH) | Visible with ECH / QUIC |
|---|---|---|
| IP / TCP / UDP | src/dst IP, ports, TCP flags, TTL | same |
| Timing | every packet's arrival time | same |
| Sizes | every packet/record size + direction | same |
| TLS handshake | version, **cipher list, extensions, curves, ALPN**, **SNI**, server cert | cert only (SNI encrypted) |
| QUIC | initial packet, SNI (unless ECH), version | connection IDs, spin bit |
| DNS | queried domain (plain DNS) | nothing (DoH/DoT) — but the DoH *flow* is visible |

Three independent signal families fall out of that:

1. **Flow features** — direction/size/timing sequences (Lab: `step1`).
2. **Handshake fingerprints** — JA3/JA4 client, JARM server, cert
   anomalies (Lab: `step2`).
3. **Behavioural rhythm** — beaconing, periodicity, session cadence
   (Lab: `step3`).

---

## 2. Flow features — the shape of a session

TLS frames application data into **records**; a record boundary often
lines up with a message boundary, so the **sequence of packet sizes and
directions** leaks the structure of the exchange.

```
web page load : small request  -> burst of MTU-sized responses -> tail
file upload    : small handshake -> long run of MTU client->server packets
interactive C2 : tiny request  <-> small response, seconds apart, repeat
video stream   : periodic ~2 s bursts of a stable size (the segment)
```

Features a detector computes per flow (no payload):

- bytes up / down and their **ratio** (upload-heavy = exfil-shaped)
- packet count, duration, packets-per-second
- mean / stdev / entropy of packet sizes
- inter-arrival time mean and **coefficient of variation** (CV)
- the first N packet sizes as an ordered vector (great for classifiers)
- TLS record-size histogram

A model trained on these separates app categories, spots data
exfiltration (sustained upload where that host normally downloads), and
flags "this IoT sensor suddenly has a 4 MB upload flow". (Lab: `step1`
shows web / exfil / C2 landing in different regions of this space.)

---

## 3. Handshake fingerprints — *which software* is talking

The TLS **ClientHello** is chosen by the client's TLS *library*, not the
user. Its exact contents — ordered cipher suites, ordered extensions,
supported groups, EC formats, ALPN — are a stable signature.

- **JA3** = MD5 of `version,ciphers,extensions,curves,ecformats`.
  Simple, widely deployed, but sensitive to library minor versions and
  confused by GREASE.
- **JA4** (2023, by FoxIO) = a structured, human-readable fingerprint
  (`t13d1516h2_8daaf6152771_...`) that is GREASE-resilient and splits
  into comparable parts. JA4+ adds JA4S (server), JA4H (HTTP), JA4L
  (latency), JA4X (x509).
- **JARM** = an *active* server fingerprint: send 10 crafted
  ClientHellos, hash the responses. Clusters C2 servers even behind
  different domains/IPs.

Why it matters: a stock browser, `curl`, Go `net/http`, Python
`requests`, and Cobalt Strike's / Sliver's TLS stack all have
**different** fingerprints. On a corporate egress you can allowlist the
handful of fingerprints your sanctioned software produces and alert on
anything else — even though every byte after the handshake is
encrypted. (Lab: `step2`.)

Plus cheap handshake anomalies: **SNI ↔ certificate name mismatch**
(domain fronting), self-signed cert to a "CDN", a cert issued five
minutes ago, JA3 of a browser but no prior DNS lookup for the SNI.

> **Analogy.** You can't read the letter, but the *handwriting on the
> envelope* is unmistakable. Everyone in the office uses the company
> stationery; a ransom-note font is worth a second look.

---

## 4. Beaconing — the rhythm of a machine

Implants call home on a timer. Even with **jitter** (`sleep 60 ±20%`),
the *distribution* of inter-arrival times is tight and unimodal — nothing
a human does looks like that over hours.

Detectors score:

- **CV of inter-arrival times** — beacon ≈ 0.0–0.35, jittered ≈ 0.3–0.55,
  human ≫ 1.0
- fraction of intervals within ±25% of the mean (tight = beacon)
- **autocorrelation** / **FFT** of the connection time series — a sharp
  peak at the period
- combined with: many connections, tiny and *consistent* byte counts,
  long overall lifetime, connections outside business hours

(Lab: `step3` catches clean and jittered beacons and leaves human
browsing alone.) Only genuinely aperiodic ("jitter" that's a real random
delay from 0 to N, or human-triggered) C2 defeats timing analysis — and
that costs the operator responsiveness.

---

## 5. How detectors are actually built

| Approach | Good for | Watch out for |
|---|---|---|
| **Rules / thresholds** (Zeek scripts, Suricata) | known-shape stuff: SNI mismatch, self-signed, JA3 blocklist, `updown_ratio` | brittle; attackers tune to just under the line |
| **Supervised ML** (RF / GBM / small NN on flow features) | traffic classification, known-family C2 | needs labels; drifts; a model card and retraining loop |
| **Unsupervised / baselining** (per-host, per-service profiles; isolation forest; clustering) | "this host never did this before" | cold start; seasonality; alert volume |
| **Sequence models** (LSTM/transformer on packet-size/direction sequences) | app & malware family ID from the first ~20 packets | compute; evasion via padding |

Real stacks combine them: **Zeek** produces `conn.log` / `ssl.log` /
`x509.log` → features → a model + rules → SIEM. Commercial NDR (Corelight,
Darktrace, Vectra, ExtraHop) and open tools (**RITA**, **Zeek**,
**Malcolm**, **Arkime**) are all variations on this pipeline.

---

## 6. The honest limits

- **Padding & traffic shaping** (TLS record padding, QUIC, Tor, some VPNs,
  MASQUE) blunt size/timing features by design.
- **ECH (Encrypted ClientHello)** removes SNI and the JA3 input fields
  from view — rolling out now. Fingerprinting then falls back to flow
  features + JARM + destination reputation.
- **Base-rate problem** — 0.1% false-positive rate on 10M flows/day is
  10,000 alerts. Detectors must be tuned per-environment and paired with
  enrichment (asset value, user, prior behaviour) and triage automation.
- **It's a signal, not proof** — an unknown JA3 might be a new laptop
  build; a beacon might be a monitoring agent. Output should be a scored
  lead for an analyst, not an auto-block, until you've earned the
  precision.
- **Adversary adaptation** — malleable C2 profiles (Cobalt Strike),
  domain fronting, "living off trusted sites" (C2 over Slack/GitHub/
  Google Docs) all specifically target these detectors.

---

## 7. Run the labs

```bash
python3 encrypted-anomaly/step1_flow_features.py    # web / exfil / C2 from metadata alone
python3 encrypted-anomaly/step2_tls_fingerprint.py  # JA3-style fingerprint + egress allowlist
python3 encrypted-anomaly/step3_beacon_detect.py    # periodicity scoring, jitter-resistant
```

Next: **`fraud-detection/`** — the same "judge behaviour you can't fully
observe" problem, moved from packets to accounts, payments, and people
trying to look like many people.
