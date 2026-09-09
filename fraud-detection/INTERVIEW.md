# Fraud & Circumvention Detection — Interview Q&A

---

## Framing

**Q: Why is accuracy the wrong metric for fraud?**
Fraud is ~0.1–3% of events, so a model that predicts "never fraud"
scores 97–99.9%. Use precision, recall, FPR, and PR-AUC, reported at a
fixed review budget, and ultimately optimise expected dollar cost.

**Q: Write the expected-cost objective.**
`E[cost] = FN · C_fn + FP · C_fp` where `C_fn` = chargeback + lost goods
+ network fee/fine + ops (+ portfolio-level penalty risk if the
chargeback ratio breaches the scheme threshold), and `C_fp` = manual
review cost + `P(good customer churns) · CLV`. Pick the threshold that
minimises it at a sustainable review + challenge volume.

**Q: ROC-AUC vs PR-AUC here?**
PR-AUC. ROC-AUC is dominated by the huge true-negative mass under
extreme imbalance and looks good even for a weak model; precision-recall
focuses on the rare positive class you actually care about.

**Q: Recall at the cost-optimal threshold is only ~0.6. Bug or expected?**
Expected. Chasing the last 40% of fraud drives FPR (and review/friction
cost) up faster than it reduces fraud loss. You accept some fraud
because eliminating it costs more than it saves. Layered actions
(challenge vs block) recover some of that recall cheaply.

---

## Rules & velocity

**Q: Give five velocity checks for a signup/payment flow.**
Signups per IP/hour, payments per card/day, distinct cards per
account, distinct accounts per card/device, failed-auth burst per
session, refund requests per account/week, promo redemptions per
device/household.

**Q: What is "impossible travel"?**
Two authenticated sessions from geolocations farther apart than any
plausible travel could cover in the elapsed time (e.g. > ~900 km/h
implied speed). A strong ATO / shared-credential signal; watch for
CGNAT and VPN-induced false positives.

**Q: Downside of hard rule thresholds, and the mitigation?**
Fraudsters probe and operate just under them. Keep thresholds
server-side, randomise/shadow them, alert on "activity tightly clustered
just below every limit", and back rules with ML + graph so there's no
single line to feel for.

**Q: A single account looks fine but you know it's part of a ring. What feature exposes it?**
Shared-key velocity: the device/IP/card/payout-instrument it shares is
used by many "unrelated" accounts. Those are *ring* features, computed
by aggregating over the shared identifier, not over the account.

---

## Linkage graphs

**Q: How do you model coordinated multi-accounting?**
A graph: nodes = accounts, edges = shared *strong* identifiers (device
fingerprint, payment/payout instrument, hashed phone/SSN, cookie,
address, referral parent), edge weight = how uniquely that identifier
ties two entities. Connected components (or dense communities) above a
size/strength threshold are rings.

**Q: Why not use shared IP as an edge?**
Households, offices, coffee shops, CGNAT and mobile carriers put
thousands of unrelated users behind one IP — using it as an edge
collapses the graph into one giant component. Keep IP as a *context
feature* / weak signal, not a hard link.

**Q: Techniques beyond connected components?**
Weighted community detection (Louvain/Leiden), label propagation /
"guilt by association" risk diffusion from known-bad nodes, graph neural
networks for node/edge classification, temporal graphs to catch a ring
*forming*, and motif detection (star = one device many accounts;
bipartite core = accounts↔cards).

**Q: How do you keep a fraud graph fast at scale?**
Only materialise strong edges; cap fan-out per identifier (an identifier
seen on 10k accounts is a shared service, not a link); incremental
component maintenance (union-find / streaming); precompute component
features (size, age, strength, cash-out convergence) for real-time
scoring.

---

## Devices, bots, proxies

**Q: What goes into a device fingerprint?**
Canvas/WebGL/audio rendering quirks, installed fonts, screen & timezone,
`navigator` fields, WebRTC-exposed local IPs, plus network-layer JA3/JA4
TLS fingerprint, HTTP/2 SETTINGS, header order. Dozens of weak signals
hashed/modelled into one fairly-stable id.

**Q: Tells that a "user" is a bot?**
`navigator.webdriver`, headless-browser artifacts, zero mouse/scroll
entropy, superhuman form-fill speed, perfectly uniform inter-action
timing, datacenter ASN, and behavioural uniformity across many
"different" accounts.

**Q: Residential proxies — why hard, and what still catches them?**
They give each fraud account a real ISP IP, defeating IP reputation and
geo rules. Catches: brief IP reuse across "unrelated" accounts,
latency/geo inconsistency, behavioural-workflow similarity, payout
convergence, content near-duplication, and the anti-detect browser's own
fingerprint.

**Q: Should a VPN/Tor connection be an automatic block?**
No — plenty of legitimate privacy-conscious users. It's a risk feature
that raises the score and can trigger a step-up challenge; auto-blocking
it creates false declines and bad press.

---

## Operations & pitfalls

**Q: What is feedback bias / selection bias in fraud models?**
You only observe outcomes (chargeback / not) for transactions you
*allowed*. Blocked ones are unlabeled, so the training data — and
offline metrics on it — are blind to the fraud the current model
already misses. Mitigate with a small random-allow holdout and
reject-inference / propensity weighting.

**Q: Why are chargeback labels tricky?**
They arrive 30–90+ days late (recent data looks artificially clean),
they're incomplete (friendly fraud vs true fraud, un-disputed fraud),
and "no chargeback" is a weak negative. Supplement with analyst
dispositions and manual-review outcomes.

**Q: How do you detect model drift in production?**
Track precision at a fixed review volume and recall on the random-allow
holdout over time; monitor feature-distribution divergence (PSI/KL) vs
the training set; alert on external triggers (checkout redesign, new
device models, BIN changes, a tactic shift in confirmed fraud).

**Q: "Block" vs "challenge" vs "review" — when each?**
Block only the clearest, highest-cost fraud. Challenge (3-D Secure, OTP,
ID verification) the mid-risk band — cheap friction, recovers most good
customers. Review (human) the ambiguous high-value cases within a budget.
Allow the rest. A binary block model leaves money on both sides.

**Q: Regulatory constraints on fraud models?**
Adverse-action / decline notifications in some jurisdictions, limits on
automated decisioning and profiling (GDPR Art. 22), disparate-impact
scrutiny (don't proxy for protected classes via zip code etc.), PCI-DSS
for card data, data-retention limits on the identifiers you graph on,
and SAR/AML obligations when fraud overlaps money laundering.

**Q: First 3 things you'd build for a new payments product with no fraud system.**
(1) Velocity/rate limits + basic device fingerprint + a review queue.
(2) A chargeback/label pipeline and a dashboard of loss + decline rate
by segment. (3) A linkage graph on device + instrument + payout. ML
comes after you have labels and a baseline.
