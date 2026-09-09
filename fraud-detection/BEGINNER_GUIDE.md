# Fraud & Circumvention Detection — The Amateur's Guide

> A bouncer doesn't read minds. They watch: is this the tenth person
> tonight wearing the same distinctive jacket? Did someone just hand
> their wristband back over the fence? Is that ID's birthday
> suspiciously round? Fraud detection is that bouncer, at machine scale,
> for accounts, payments, and referral bonuses.

"Circumvention" is the important half: fraudsters aren't one-shot, they
**adapt** — one person pretending to be a thousand (Sybil), a bot
shaped like a human, a stolen card tested in $1 increments. The system
has to detect the *pattern of evasion*, not just a bad transaction.

---

## 1. The shape of the problem

| Property | Consequence for the detector |
|---|---|
| **Rare** (0.1–3% of events) | "accuracy" is a useless metric; a "never fraud" model scores 98%+ |
| **Asymmetric cost** | a missed chargeback ≫ a false decline (which also loses a *good* customer) |
| **Adversarial & adaptive** | static rules decay; the fraudster A/B-tests against you |
| **Coordinated** | the signal is often *between* accounts (shared device/card), not in one |
| **Labels are late & noisy** | chargebacks arrive 30–90 days later; "not charged back" ≠ "legit" |
| **Regulated** | declines, adverse-action notices, and profiling have legal limits |

So the toolkit is: fast **rules** for known evasion shapes, a **linkage
graph** for coordination, **ML** for the fuzzy middle, and an
**economic** evaluation that optimises dollars, not error count — all
wrapped in a **review queue + step-up challenge + feedback loop**.

---

## 2. Velocity & rules — the cheap 80%

Sliding-window counters catch most volume fraud:

```
signups per IP / hour           logins per account / minute
payments per card / day         redemptions per promo / hour
distinct cards per account      distinct accounts per card / device
failed-auth burst               refund requests per account / week
```

Plus **impossible travel**: two authenticated sessions from locations
farther apart than any flight could cover in the elapsed time.

The key insight (Lab: `step1`): a *single* account in isolation looks
fine. The same account inside a ring trips **shared-key** velocity —
device used by 12 signups in an hour, one card across 6 accounts — because
those are *ring* features, not user features.

> **Analogy.** One person buying one concert ticket is normal. One credit
> card buying 400 tickets in 90 seconds from 30 "different" accounts on
> the same phone is a scalper bot, and every one of those counters says
> so.

**Trap:** rules are a floor a fraudster feels for. Keep the exact
thresholds server-side, randomise/shadow them, and treat "activity
clustered just under every limit" as its own signal.

---

## 3. Linkage graphs — catching coordination

Build a graph:

- **nodes** = accounts
- **edges** = "share a strong identifier": device fingerprint, payment
  instrument, hashed phone/SSN, cookie/localStorage id, shipping
  address, referral parent
- **edge weight** = how *surprising* that match is. Shared residential IP
  ≈ weak (whole households, coffee shops, CGNAT). Shared device
  fingerprint + card ≈ strong.

**Connected components** above a size/strength threshold are
multi-accounting, Sybil referral abuse, or a bust-out ring. (Lab:
`step2` — a 6-account referral ring becomes one high-risk component,
while a household and a coffee-shop-wifi user are correctly left out
*because* weak identifiers aren't used as edges.)

Real systems go further: **community detection** on weighted graphs,
**graph neural networks** for node classification, temporal graphs to
see a ring *forming*, and "guilt by association" scores that propagate
risk from a confirmed-bad node to its neighbourhood.

---

## 4. Device fingerprinting & bot detection

You can't trust a cookie (cleared) or an IP (rotated). A **device
fingerprint** combines dozens of weak signals into one fairly-stable id:

- canvas / WebGL / audio rendering quirks, installed fonts, timezone,
  screen metrics, `navigator` fields, WebRTC local IPs
- TLS/HTTP client fingerprint (JA3/JA4 — see the `encrypted-anomaly`
  module), header order, HTTP/2 settings frame

**Bot / automation tells:** headless-browser artifacts, no mouse
entropy, form filled faster than humanly possible, perfectly uniform
timing, `navigator.webdriver`, datacenter ASN, residential-proxy
patterns (many unrelated accounts from one "home" IP in an hour).

**Anti-fingerprinting is the arms race:** anti-detect browsers
(Multilogin, GoLogin), fingerprint spoofing, farms of real phones. The
counter is *consistency* checks (does the claimed timezone match the IP
geo? does the GPU match the user-agent?) and behavioural biometrics.

---

## 5. Proxy / VPN / location evasion

Fraud loves to hide origin. Detect the hiding:

| Technique | Tell |
|---|---|
| Datacenter VPN | destination ASN is a hosting provider; known VPN IP lists |
| Residential proxy | many unrelated accounts share one ISP IP briefly; ASN mismatch with behaviour |
| Tor | Tor exit-node list; specific TLS/timing profile |
| GPS spoofing (mobile) | mock-location flag, sensor inconsistency, teleporting between sessions |
| Timezone / locale spoof | `Accept-Language` ≠ IP geo ≠ payment-instrument country ≠ device timezone |

None is proof of fraud (privacy-conscious users exist) — it's a
**risk feature** that raises the score and can trigger a step-up
challenge, not an auto-block.

---

## 6. Evaluating it in dollars, not accuracy

(Lab: `step3`.) With a ~1% fraud rate:

- **Accuracy is a trap** — "block nothing" scores 99%.
- Report **precision / recall / FPR** at a *fixed review budget*
  (analysts can only look at N cases/day), and a **precision-recall
  curve**, not ROC-AUC alone.
- Choose the threshold by **expected cost**:
  `cost = FN · (chargeback + goods + fee + ops) + FP · (review + P(lost good customer)·CLV)`
- The cost-optimal point is usually a **moderate** threshold with
  *partial* recall — chasing the last few percent of fraud costs more in
  friction and review than it saves.

Then layer **actions** instead of a binary block: allow / step-up
(3-D Secure, OTP, ID check) / hold for review / decline. Most risk gets a
challenge, not a wall.

---

## 7. The feedback loop (or the model rots)

```
decision  ->  outcome (chargeback? confirmed-fraud? analyst label? customer complaint?)
          ->  labels  ->  retrain / re-tune thresholds  ->  monitor precision & drift
```

- Chargebacks are **delayed and incomplete** labels — supplement with
  analyst dispositions and manual-review outcomes.
- Watch for **feedback bias**: you only see outcomes for transactions you
  *allowed*; blocked ones are unlabeled. Reserve a tiny random
  "allow anyway" holdout to measure what your model misses.
- Track **feature drift** (a new checkout flow, a new device model, a
  bank BIN change) and **concept drift** (fraudsters changed tactics).

---

## 8. Run the labs

```bash
python3 fraud-detection/step1_velocity_rules.py   # sliding-window rules + impossible travel
python3 fraud-detection/step2_device_graph.py     # linkage graph, rings vs households
python3 fraud-detection/step3_eval_costs.py       # threshold selection by expected $ cost
```

Next: **`key-management/`** — the infrastructure that decides *who and
what* can decrypt, sign, and authenticate, and how keys are rotated and
destroyed without an outage.
