# Anomaly Detection on Encrypted Activity — Deep Dive: Production Scenarios

---

## Scenario 1 — TLS C2 on a "quiet" segment, no payload to inspect

**Symptom.** Threat intel drops a note that a peer org was hit by a
loader that uses HTTPS C2 with a valid Let's Encrypt cert. You have full
packet capture but no decryption on the OT/lab segment.

**Hunt, using only what's visible.**
```bash
# Zeek over the pcap
zeek -r capture.pcap
# 1. beaconing candidates: (src,dst) pairs with many small, regular conns
cat conn.log | zeek-cut id.orig_h id.resp_h duration orig_bytes resp_bytes \
 | awk '$3>0 && $4<1500 && $5<4000' | sort | uniq -c | sort -rn | head
# 2. rare JA3 across the whole capture
cat ssl.log | zeek-cut ja3 id.resp_h server_name | sort | uniq -c | sort -n | head
# 3. certs: issued recently, CN != SNI, or SAN is a dynamic-DNS domain
cat x509.log | zeek-cut certificate.subject certificate.not_valid_before san.dns
```

**What flags it.**
- A `10.x → 185.x` pair with 300 connections over 6 h, each ~600 bytes
  up / ~1.2 KB down, inter-arrival CV = 0.18 → **beacon** (`step3`).
- The JA3 on those flows appears **nowhere else** in the environment and
  doesn't match any browser/updater → unknown TLS stack (`step2`).
- The cert CN is `*.workers.dev` while SNI claims `api.company-cdn.com`
  → domain fronting.

Any one is a lead; all three on the same flow is a finding. You never
decrypted a byte.

---

## Scenario 2 — Data exfiltration disguised as normal HTTPS

**Symptom.** DLP (which only sees cleartext) reports nothing. Finance
data appears on a paste site a week later.

**Behavioural detection that would have caught it.**
Per-host **egress baseline**: for each internal host, learn its normal
`bytes_up` distribution per destination category and per hour.

- Workstation `WS-4471` normally uploads < 5 MB/day total, mostly to
  `*.office365.com` and the git server.
- One night it opens a single TLS flow to a personal cloud-storage
  domain and pushes **900 MB** over 40 minutes, `updown_ratio` ≈ 250.
- That's > 30σ from its own history → alert, enrich with user + asset
  sensitivity + "is this domain sanctioned" → analyst.

**Why baselining beats a global threshold.** A 900 MB upload is normal
for the backup server and abnormal for a laptop. The model is
**per-entity**. Cold-start with a population prior ("laptops in
Finance"), then personalise.

**Evasion & counter.** Slow exfil ("low and slow", 50 MB/day for 3
weeks) beats a daily threshold → also model the **weekly** aggregate and
the *cumulative* upload to *new* destinations.

---

## Scenario 3 — Beacon with heavy jitter and "sleep mask"

**Symptom.** Suspected implant, but the operator set `sleep 3600` with
`jitter 50%`, so intervals range 30–90 min. Naive periodicity checks
miss it.

**What still works.**
- The interval distribution is **bounded and unimodal** (30–90 min,
  peak ~60) — humans produce a heavy-tailed, multimodal distribution
  with hours-long gaps and second-scale bursts.
- **Data-size consistency**: every check-in is 400–700 bytes up. Human
  traffic sizes vary by orders of magnitude.
- **Autocorrelation** of a coarse (5-min-bin) connection count series
  still shows a bump near the mean period.
- **Connection count over time**: 24 beacons/day, every day, including
  weekends and 3 a.m. — no human pattern.

`step3` models exactly this: jittered beacons still score as
"LIKELY BEACON" via CV + within-±25% + autocorrelation, while generated
human traffic does not.

**Where it genuinely fails.** Truly aperiodic C2 (random 0–24 h,
human-in-the-loop, or triggered by a dead-drop resolver) defeats timing
analysis. Then you lean on `step1` flow shape, `step2` fingerprint,
destination reputation, and endpoint telemetry.

---

## Scenario 4 — DNS-over-HTTPS hiding both C2 and the domain

**Symptom.** Endpoint has DoH enabled (browser or malware using
`https://doh.example/dns-query`). You lose DNS visibility entirely.

**Approach.**
- **Detect the DoH itself.** DoH to non-sanctioned resolvers is a
  policy signal: known DoH provider IP/SNI list, plus the traffic shape
  (many tiny request/response pairs, ~100–500 bytes, to one host). Block
  or force through the enterprise resolver.
- **If DoH is allowed**, the *pattern* of lookups still leaks: a burst
  of DoH queries immediately before every beacon connection, or DoH to a
  resolver that also serves as the C2 (same IP).
- **Policy**: `resolv.conf` / browser policy to disable app-level DoH,
  RPZ on the enterprise resolver, and alert on outbound :853 (DoT) and
  known-DoH SNIs from anything but the resolver.

---

## Scenario 5 — Model drift and the alert-fatigue spiral

**Symptom.** The encrypted-traffic classifier had 92% precision at
launch. Six months later analysts ignore its alerts.

**Causes.**
- **Concept drift** — a new VPN client, an OS TLS-stack update (every
  JA3 shifts), a new SaaS tool → the "normal" cluster moved.
- **Seasonality** — quarter-end backups, a product launch, WFH spikes.
- **Feedback starvation** — analyst dispositions (TP/FP) never fed back,
  so the model can't learn its mistakes.

**Fixes.**
- **JA4 over JA3** — robust to GREASE and minor version churn.
- **Retraining cadence** with a labelled hold-out; monitor precision/
  recall per class in prod (a `model card` + a dashboard).
- **Feedback loop**: every analyst disposition becomes a label;
  weekly retrain or online update; track PSI/KL-divergence on feature
  distributions to *detect* drift before precision craters.
- **Tiered output**: high-confidence → ticket; medium → hunt queue;
  low → dashboard only. Never page on a single ML score.

---

## Feature reference (what a Zeek→features pipeline computes per flow)

```
directional size sequence      s1..sN   (first 20–30, padded/truncated)
byte counts                    orig_bytes, resp_bytes, ratio
packet counts                  orig_pkts, resp_pkts
duration, pps, bytes/sec
size stats                     mean, std, min, max, entropy (orig/resp)
IAT stats                      mean, std, CV, min; burstiness
TLS                            version, ja3, ja3s, ja4, cipher, curve, alpn
                               cert: issuer, validity_days, self_signed,
                               san_count, sni, sni_cert_match
QUIC                           version, spin-bit transitions, cid changes
context                        hour-of-day, dst_asn, dst_reputation,
                               is_new_dst_for_host, dst_domain_age
```

---

## Quick reference

```bash
zeek -r x.pcap ; cat conn.log ssl.log x509.log | zeek-cut ...
rita import conn.log ssl.log -d ds && rita show-beacons ds        # beacon scoring
ja3 --json x.pcap        # or Zeek's built-in ja3 / the ja4 plugin
tshark -r x.pcap -Y 'tls.handshake.type==1' -T fields \
   -e tls.handshake.ciphersuite -e tls.handshake.extension.type
zeek-cut -d < ssl.log | awk -F'\t' '$X ~ /self signed/'
suricata -r x.pcap ; jq 'select(.event_type=="tls")' eve.json
# beacon quick-look: interval CV per (src,dst)
zeek-cut ts id.orig_h id.resp_h < conn.log | sort -k2,3 -k1,1n | \
  awk '{k=$2" "$3; if(p[k])print k, $1-p[k]; p[k]=$1}' | \
  awk '{s[$1" "$2]+=$3; ss[$1" "$2]+=$3*$3; n[$1" "$2]++} END{for(k in n){m=s[k]/n[k]; print k, n[k], m, sqrt(ss[k]/n[k]-m*m)/m}}' | sort -k5 -n
```
