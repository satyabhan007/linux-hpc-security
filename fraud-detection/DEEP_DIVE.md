# Fraud & Circumvention Detection — Deep Dive: Production Scenarios

---

## Scenario 1 — Referral-bonus abuse ($20 per friend, 4,000 "friends")

**Symptom.** Growth reports a great week. Finance reports the referral
line item is 12× budget. Most "new users" never come back.

**Investigate.**
- Group new signups by **device fingerprint**, **cookie id**, **payout
  instrument** (the PayPal/bank account the bonus goes to), and
  **referral parent**.
- Linkage graph (`step2`): one component of 3,800 accounts, joined by ~40
  devices and 6 payout accounts, all created in a 9-day window, each
  account doing exactly the minimum qualifying action then going idle.

**Response.**
1. Freeze payouts for the component pending review (reversible).
2. Claw back where ToS allows; write off the rest.
3. **Fix the incentive**: pay the bonus *after* the referred user's
   first real purchase / 30-day retention, not on signup. Cap payouts
   per device / per payout-instrument / per household. Add a step-up
   (phone verification) at bonus-claim time.
4. Add the devices/instruments to a blocklist; add "component size at
   signup" as a real-time risk feature.

**Lesson.** Most "fraud" here is an **incentive-design** bug the fraud
system merely surfaces. The detector buys time; the fix is the payout
rule.

---

## Scenario 2 — Card testing / BIN attack

**Symptom.** Auth rate drops; the payment processor warns about a rising
decline ratio (which threatens your account); a spike of $0-$1
authorizations.

**What's happening.** A stolen-card list is being validated against
your checkout (it's a cheap, always-on endpoint). Valid cards are then
sold or used elsewhere; some are used on you for real purchases hours
later.

**Signals & controls.**
- Velocity (`step1`): many attempts per **IP / device / session**, many
  **distinct card numbers** with the same billing pattern, sequential
  BINs/PANs, high **decline rate** per source, tiny or round amounts.
- Controls: aggressive rate-limits on the payment endpoint, CAPTCHA /
  proof-of-work after N failures, require CVV + AVS, **don't** reveal
  *why* an auth failed, block on decline-rate per IP/device, and enable
  the processor's own card-testing protection.
- Add friction only to the risky slice — a global CAPTCHA kills
  conversion.

---

## Scenario 3 — Account takeover (ATO), then a "trusted" fraudulent order

**Symptom.** A long-tenured account with good history suddenly ships a
high-value order to a new address, paid with the card on file.

**Why simple models miss it.** The *account* is trusted; the *card* is
legitimate (it's the real user's). The fraud is the **session**, not the
instrument.

**Signals.**
- Login from a **new device fingerprint + new ASN + new geo**, often
  after a credential-stuffing burst elsewhere.
- **Impossible travel** vs the last known-good session (`step1`).
- Immediately after login: change email/phone/password, add a shipping
  address, disable notifications, place the order — a scripted sequence
  with machine-fast timing.
- Behavioural-biometric mismatch (typing/mouse dynamics unlike this
  user's history).

**Response.** Risk-score the **session**, not just the payment. Step-up
on sensitive actions (address change, payout change) *independently* of
checkout. Notify on the *old* contact channel. Hold new-address
high-value orders for a short review window.

---

## Scenario 4 — Sybil / multi-accounting behind residential proxies

**Symptom.** Marketplace: hundreds of "independent" sellers leaving each
other 5-star reviews; or a game economy being farmed; or trial abuse
(new free trial every week).

**The evasion.** Each account gets a fresh **residential proxy** IP (a
real ISP address, rented by the minute from a proxy network — often
someone's malware-infected router), an **anti-detect browser** profile
(unique canvas/WebGL/fonts), and a burner email/phone.

**What still links them.**
- **Timing & workflow**: accounts act in the same order, same
  dwell-times, same working hours, same clumsy pauses — behavioural
  fingerprint.
- **Payout convergence**: money always ends up at a small set of
  cash-out accounts (`step2` edge on payout instrument).
- **Content reuse**: near-duplicate profile text/images (minhash /
  embedding similarity).
- **IP still leaks sometimes**: residential proxies reuse IPs; a brief
  window where 20 "unrelated" accounts share one ISP IP is damning.
- **Device tells**: proxy latency inconsistent with claimed geo;
  timezone/locale/GPU mismatch; the anti-detect browser's own
  fingerprint (they have tells too).

**Response.** Graph + community detection on strong edges; a
"coordination score" from behavioural similarity; raise friction
(phone + ID) at the moment of value extraction (payout, listing,
review), not at signup where it kills real users.

---

## Scenario 5 — The model that quietly stopped working

**Symptom.** Chargeback rate crept from 0.4% back to 1.1% over a
quarter. The fraud model's offline AUC still looks fine.

**Causes.**
- **Feedback bias**: the model trained mostly on transactions it
  *allowed* (blocked ones have no outcome), so it's blind to the fraud
  it already misses. Offline AUC on that biased data flatters it.
- **Concept drift**: fraudsters moved to ATO + on-file card (Scenario 3),
  which the instrument-centric features don't capture.
- **Label lag**: recent months look "clean" only because chargebacks
  haven't arrived yet.
- **A checkout redesign** shifted feature distributions (device/timing).

**Fixes.**
- A permanent **random-allow holdout** (e.g. 0.5% of would-be-blocks) to
  get unbiased recall estimates — a real, budgeted cost.
- **Reject inference** / propensity weighting when retraining.
- Monitor **PSI/KL** on feature distributions and **precision at fixed
  review volume** weekly, with alerting.
- Session-level ATO features; behavioural biometrics; graph features.
- Treat the last 90 days as **partially labelled** and weight
  accordingly.

---

## Scenario 6 — A false-decline problem (the other failure mode)

**Symptom.** Support tickets: "my card was declined, it works
everywhere else." Good-customer churn measurable in cohort data. Fraud
loss is *low* — because the model is far too aggressive.

**Diagnosis.** The threshold was set to minimise fraud loss alone,
ignoring the **friction cost**: a wrongly-declined good customer has a
lifetime value you just forfeited, plus support cost, plus reputation.
(`step3` folds `P(lost good customer)·CLV` into the FP cost.)

**Fix.** Re-derive the threshold with the *true* FP cost. Move from
"block" to "step-up challenge" for the mid-risk band — a 3-D Secure
prompt annoys far less than a decline and recovers most good customers.
Give known-good customers (long tenure, prior successful step-ups) a
lower-friction path. Track **decline rate on known-good segments** as a
first-class metric next to fraud loss.

---

## Metric & threshold reference

```
precision      = TP / (TP + FP)              "of what we flagged, how much was fraud"
recall (TPR)   = TP / (TP + FN)              "of all fraud, how much we caught"
FPR            = FP / (FP + TN)              "of legit, how much we hassled"
PR-AUC                                        preferred over ROC-AUC under heavy imbalance
review budget  = analysts * cases/analyst/day -> fixes the operating point
expected cost  = FN*C_fn + FP*(C_review + P_lost*CLV)
C_fn           = chargeback + goods + network fine + ops + fraud-rate penalty risk
challenge rate = fraction sent to 3-DS / OTP / ID  (annoyance, but recoverable)
```

Report a table of (threshold, precision, recall, FPR, challenge-rate,
expected-cost) and pick by cost at a sustainable review + challenge
volume — never by accuracy.

---

## Quick reference (patterns to alert on)

```
# shared strong-identifier fan-out
distinct_accounts_per(device_fp | card | payout_acct | ssn_hash)  > k   in window
# ring forming
new component of size >= K within T days, members each doing only the
  minimum qualifying action
# card testing
attempts_per(ip|session) high, distinct_cards high, decline_rate high, amount tiny/round
# ATO
login: new device_fp AND new ASN AND geo jump; then <sensitive action> within seconds
# proxy/location evasion
dst ASN in {hosting, known-VPN}; Accept-Language != IP geo != instrument country
  != device timezone
# incentive abuse
promo_redemptions_per(device|household|payout) > cap; retention of referred users ~ 0
# feedback health
precision@fixed-review-volume trend; PSI(feature) vs training; random-allow holdout recall
```
