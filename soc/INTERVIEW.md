# SOC & Detection Engineering — Interview Q&A

---

## SOC fundamentals

**Q: What are the SOC tiers and what does each do?**
T1 triages every alert (close FPs, escalate, follow playbooks). T2
investigates and scopes incidents (pivot, timeline, contain). T3 hunts
proactively and engineers/tunes detections. Incident responders/IC run
major incidents.

**Q: What's a realistic alert throughput per T1 analyst?**
~40 alerts per shift at ~10–15 min each. A queue several times that is a
detection-tuning problem, not (only) a staffing one.

**Q: Walk me through triaging an alert.**
Validate it's not a known FP; establish what fired and why; check the
asset and account criticality; pivot for corroborating signals (same
user/host, related timeframe); decide disposition — false positive,
benign true positive, or escalate with a scoped summary.

**Q: How do you prioritize the queue?**
`severity × asset_criticality × confidence × fidelity`, with an SLA per
severity. Work highest priority first; auto-close or sink low-fidelity
low-asset noise.

**Q: What is alert fatigue and why is it dangerous?**
High-volume low-fidelity alerts train analysts to batch-close without
reading, so the rare true positive is closed unseen. A noisy rule is
worse than no rule.

---

## Detection engineering

**Q: What does "detections as code" mean?**
Detections are written from a hypothesis, version-controlled, peer
-reviewed, tested in CI against attack data (must fire) and benign data
(must stay quiet), have an owner, and are measured (FP rate, escalation
rate) after deploy.

**Q: Define precision and recall for a detection.**
Precision = TP/(TP+FP): of the alerts it raised, how many were real.
Recall = TP/(TP+FN): of the real attacks, how many it caught.

**Q: Why is there no threshold that "catches everything"?**
Precision and recall trade on the same knob. Lower the threshold and
recall rises but false positives flood the queue; raise it and you miss
intrusions. You tune to sustainable fidelity.

**Q: A rule has 99% recall and 2% precision. Ship it?**
No. 2% precision means 50 false positives per true positive — analysts
will learn to ignore it. Add a corroborating signal, raise the bar, or
make it a risk contributor (RBA) rather than a standalone alert.

**Q: What's the difference between an IOC-based and a
behavior/TTP-based detection?**
IOC (hash, IP, domain) is precise but brittle — trivially changed by the
attacker, "lowest on the Pyramid of Pain". TTP/behavior (e.g. "process
injection pattern") is harder for the attacker to change and catches
variants, but is noisier to tune.

**Q: What is Sigma?**
A vendor-neutral YAML format for SIEM detection rules, converted
(`sigma convert` / pySigma) to SPL, KQL, EQL, Elastic, etc. Lets you
write a detection once and deploy across backends.

**Q: How do you test a new detection before production?**
Run the matching Atomic Red Team / Caldera technique in a lab and
confirm it fires; run it over a sampled benign production corpus and
confirm it stays quiet; tune allowlists; then canary with metrics for
1–2 weeks.

**Q: What's the "Pyramid of Pain"?**
David Bianco's model ranking IOCs by how much it hurts the adversary to
change them: hash values (trivial) < IP < domain < network/host
artifacts < tools < **TTPs** (very painful). Aim detections up the
pyramid.

---

## MITRE ATT&CK

**Q: Tactic vs technique vs procedure?**
Tactic = the adversary's goal (e.g. Persistence). Technique = how they
achieve it (T1053 Scheduled Task). Sub-technique = a specific variant.
Procedure = the exact implementation a given actor uses.

**Q: How do you measure detection coverage with ATT&CK?**
Map every detection to technique(s), build the tactic×technique matrix,
and weight by real-world prevalence (from threat intel / Red Canary /
your own IR history). Coverage is `weighted covered / weighted total`;
gaps ranked by `prevalence × (1 − coverage)`.

**Q: Why weight by prevalence?**
A count of techniques treats phishing (used everywhere) the same as an
obscure technique used by one APT. Weighting focuses the backlog on what
actually gets used against you.

**Q: What is ATT&CK Navigator used for?**
Visualizing coverage / gaps / a specific actor's TTPs on the matrix as a
color-coded layer — for planning and communicating detection posture.

**Q: MITRE D3FEND?**
A knowledge graph of *defensive* countermeasures mapped to ATT&CK
techniques — "what mitigations/detections counter T-XXXX".

---

## SIEM / SOAR / metrics

**Q: SIEM vs EDR vs XDR vs SOAR?**
SIEM: central log aggregation, search, correlation. EDR: endpoint
telemetry + response. XDR: vendor-integrated cross-domain
detection/response. SOAR: playbook automation and case management on top.

**Q: What belongs in a SOAR playbook vs a human?**
Automate reversible, low-blast-radius steps (enrichment, message
purge, sender block, ticketing). Keep irreversible or high-impact
actions (disable account, isolate host, block a business-critical
service) behind one-click human approval, with rate limits and a
protected asset set.

**Q: Define MTTD, MTTA, MTTR.**
Mean time to Detect (unseen dwell), to Acknowledge (paging/response
latency), to Respond/Recover (contained/fixed). Teams under-invest in
MTTD — you can't ack what you can't see.

**Q: A rule fires 200×/day, ~all FPs, but analysts "handle it". Problem?**
Yes: it erodes trust in the whole queue and causes reflexive closing, so
the rare TP is missed. Tune it, raise its threshold, convert to a risk
contributor, or retire it. Track FP rate per rule and act at ~5%.

**Q: What is threat hunting?**
Proactively searching telemetry for adversary activity that no alert
caught, driven by a hypothesis (from intel, ATT&CK, or an anomaly).
Output: findings, and new detections so the SOC catches it next time.

**Q: What is a "notable event"?**
In Splunk ES: an alert object created by a correlation search, with
severity, owner, status, and drill-down — the SOC's case-management
unit. (Module 19 covers throttling and risk-based alerting.)

**Q: You're handed a brand-new SOC. First three priorities?**
1) Log coverage + a working SIEM pipeline for the crown-jewel systems
and identity. 2) A small set of high-fidelity detections mapped to the
most prevalent ATT&CK techniques, with playbooks. 3) Metrics + a
tuning/hunt loop so coverage improves and FP rates stay low.

**Q: How do you know your SOC is actually working?**
Purple-team exercises (Module 21) that measure which emulated techniques
fired an alert and how fast; a coverage trend that's improving;
per-rule FP rates staying low; and MTTD/MTTR trending down on real
incidents.
