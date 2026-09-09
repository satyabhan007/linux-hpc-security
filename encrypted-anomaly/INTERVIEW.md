# Anomaly Detection on Encrypted Activity — Interview Q&A

---

## What's visible

**Q: TLS 1.3 is everywhere. What can a network sensor still use?**
Packet sizes and directions, inter-arrival timing, byte counts,
duration; the handshake's cipher/extension/curve list and (pre-ECH) SNI;
the server certificate; QUIC initial packets. Enough for traffic
classification, C2/beacon detection, and exfil detection without
decryption.

**Q: What does ECH (Encrypted ClientHello) take away?**
The SNI and the ClientHello fields that feed JA3/JA4 — they're encrypted
to the server's ECH public key. You keep flow features, JARM (active
server fingerprint), destination IP/ASN/reputation, and timing.

**Q: TLS record sizes vs TCP segment sizes — which do you want and why?**
TLS record sizes, because a record boundary often aligns with an
application message boundary, so the record-size sequence leaks
structure. TCP segmentation (and TSO/GRO on the NIC) muddies raw packet
sizes; reassemble to records where you can.

---

## Fingerprinting

**Q: What is JA3?**
An MD5 hash of the TLS ClientHello's `version,cipherlist,extensionlist,
ellipticcurves,ecpointformats` (GREASE values stripped). It fingerprints
the client's TLS *library/stack*, not the user.

**Q: JA3 vs JA4?**
JA4 (FoxIO, 2023) is structured and human-readable
(`t13d1516h2_...`), GREASE-resilient by construction, sorts fields for
stability, and comes as a family (JA4S server, JA4H HTTP, JA4X cert,
JA4L latency). JA3 is a single opaque MD5, sensitive to library minor
versions and GREASE ordering. Prefer JA4 for new work.

**Q: JA3 vs JARM?**
JA3 is passive (hash what the client sent). JARM is active — you send 10
crafted ClientHellos to a server and hash its responses; it fingerprints
the *server's* TLS config and clusters C2 infrastructure across
different IPs/domains.

**Q: A host's JA3 matches Chrome but you saw no DNS lookup for the SNI. Suspicious?**
Yes — a real browser resolves the name first. No preceding A/AAAA (or
DoH) query for that SNI suggests a hard-coded IP with a spoofed
ClientHello, or DNS done out-of-band.

**Q: How would you use JA3/JA4 defensively at an egress proxy?**
Build a per-destination (or global) allowlist of fingerprints produced
by sanctioned software (browsers, the patch agent, known SaaS SDKs) and
alert on anything outside it. Encrypted or not, a TLS stack no approved
software produces is a strong lead.

**Q: Limitation of fingerprint blocklists?**
Attackers can mimic a common browser's ClientHello (utls, "JA3
spoofing"), and legitimate software churns fingerprints on every update.
Allowlisting + anomaly on *rarity* beats maintaining a blocklist.

---

## Beaconing

**Q: How do you detect C2 beaconing without decryption?**
Score the regularity of connection inter-arrival times to each
destination: low coefficient of variation, a tight unimodal interval
histogram, a peak in the autocorrelation/FFT of the connection time
series, plus small consistent byte sizes and a long-lived, high-count
relationship.

**Q: The implant adds 50% jitter. Still detectable?**
Usually. Jitter widens the intervals but keeps the distribution
**bounded and unimodal** around the mean period — nothing human looks
like that over hours. You lose the sharp FFT peak but keep low-ish CV,
the "% within ±25% of mean", and the sheer connection count at all
hours.

**Q: What actually defeats timing analysis?**
Genuinely aperiodic check-ins — random 0–24 h sleeps, human-in-the-loop
triggering, or traffic that only rides real user activity. The cost to
the operator is responsiveness/control.

**Q: FFT vs autocorrelation vs CV for periodicity — trade-offs?**
CV is cheap and robust but only says "regular", not the period. ACF
gives the period and tolerates missing samples. FFT gives a clean
spectral peak but needs even sampling / binning and enough cycles.
Production tools (RITA) mostly use interval-distribution statistics +
data-size consistency + connection count.

---

## Flow classification & exfil

**Q: Which flow features separate bulk upload (exfil) from browsing?**
`bytes_up / bytes_down` ratio (exfil ≫ 1, browsing ≪ 1), sustained
MTU-sized client→server packets, high pps over a long duration, low
size entropy (all full packets), few/small server responses.

**Q: Why baseline per host instead of a global threshold for exfil?**
A 1 GB upload is routine for the backup server and a red flag from a
Finance laptop. Model each entity's own history (with a population
prior for cold start) and alert on deviation from *its* norm.

**Q: "Low and slow" exfil under the daily threshold — counter?**
Model weekly/monthly aggregates and the cumulative volume to *new*
destinations; track first-seen destinations per host; correlate with
data-access logs.

**Q: First ~20 packet sizes as a feature vector — why so powerful?**
The handshake + first requests encode the protocol and often the app
(the "front" of a flow is very distinctive). Sequence models on this
prefix classify app and even malware family before the flow finishes —
which also lets you act early.

---

## Building & operating detectors

**Q: Rules vs supervised ML vs unsupervised — when each?**
Rules for known, stable shapes (SNI/cert mismatch, self-signed to a
"CDN", JA3 rarity). Supervised ML for traffic classification and
known-family C2 (needs labels, drifts). Unsupervised/baselining for
"this entity never did this" (cold start, seasonality, alert volume).
Real stacks layer all three.

**Q: Biggest operational problem with these detectors?**
Base rate. Even 0.1% FPR on millions of flows/day buries analysts.
Mitigate with per-environment tuning, enrichment (asset value, user,
prior behaviour, dst reputation), tiered outputs (page/ticket/hunt/
dashboard), and a feedback loop from dispositions.

**Q: How do you detect that your model has drifted?**
Monitor precision/recall per class in prod against a labelled hold-out;
track feature-distribution divergence (PSI / KL) vs the training set;
watch for external triggers (OS TLS-stack updates shift every JA3, new
VPN/SaaS). Retrain on a cadence and on drift alarms.

**Q: Name real tools in this space.**
Zeek (`conn/ssl/x509.log`), Suricata, RITA (beacons), Arkime/Malcolm,
JA4+ tooling, JARM; commercial NDR: Corelight, Darktrace, Vectra,
ExtraHop, Cisco ETA (which added telemetry to routers specifically for
encrypted-traffic analytics).

**Q: Privacy / legality caveat?**
Metadata analysis still processes communications data — scope it to
enterprise-owned assets and networks, document it, and prefer
aggregate/behavioural features over anything that reconstructs content.
Corporate TLS interception (MITM proxy) is a separate, heavier decision
with its own legal and security trade-offs (breaks pinning, becomes a
target, and is incompatible with ECH).
