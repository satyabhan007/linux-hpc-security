# Key Management Infrastructure — Interview Q&A

---

## Hierarchy & envelope encryption

**Q: What is envelope encryption?**
Encrypt data with a per-object data-encryption key (DEK); encrypt
(wrap) the DEK with a key-encryption key (KEK) that lives in a KMS/HSM
and never leaves it; store the wrapped DEK next to the ciphertext. To
read: one KMS call to unwrap the DEK, then decrypt locally.

**Q: Why not just encrypt everything directly with the KMS key?**
Throughput and coupling: KMS/HSM ops are rate-limited and add latency
per call, and you'd send all your plaintext to the KMS. Envelope
encryption keeps bulk crypto local and the KMS call tiny and rare.

**Q: KEK rotation on a petabyte store — what actually happens?**
You re-wrap the DEKs (decrypt-with-old, encrypt-with-new — kilobytes
each), not re-encrypt the data. Cost is O(number of keys). Old KEK
version stays enabled for decrypt until re-wrap completes, then
disabled, then destroyed after a hold.

**Q: Blast radius of a leaked DEK vs KEK vs root key?**
DEK: one object. KEK: every DEK it wrapped (one app/tenant/env) — bad,
rotate + re-wrap + investigate. Root/master key: everything under it —
full incident, and if it's an HSM-resident non-exportable key, "leaked"
usually means the HSM or its access was compromised.

**Q: What is crypto-shredding?**
Rendering data unrecoverable by destroying its key instead of the
ciphertext. Works across immutable backups and replicas. Requires the
data to have been encrypted under a sufficiently granular key
(per-user/per-tenant) from the start, and the key destruction to be
irreversible and logged.

---

## KMS / HSM

**Q: KMS vs HSM?**
HSM: tamper-resistant hardware where keys are generated and used and
**cannot be exported**; FIPS 140-2/3 L3; used for CA roots, code/payment
signing. KMS: a key-management service/API (usually HSM-backed) that
does crypto ops for you over the network; used for app secrets and
envelope KEKs.

**Q: What are PKCS#11 and KMIP?**
PKCS#11 ("Cryptoki"): the standard C API to talk to a token/HSM
(sessions, slots, objects, sign/decrypt). KMIP: a standard *protocol*
for key lifecycle management (create, rotate, activate, destroy) between
clients and a key-management server, vendor-neutral.

**Q: FIPS 140-2 Level 3 — what does it add over Level 2?**
Identity-based authentication and physical tamper *response* (zeroize
keys on intrusion), plus separation of the crypto module's interfaces.
Level 4 adds environmental attack protection (voltage/temperature).

**Q: Your HSM cluster is 2 nodes. What's the risk and fix?**
No fault tolerance for quorum, and firmware updates can take both out.
Fix: N+1 across failure domains, rolling updates one node at a time,
tested wrapped-key backup restorable into a spare, and (for payments) a
pre-agreed degraded-mode plan.

---

## Rotation & lifecycle

**Q: What is a crypto-period?**
The maximum time a key may remain in active use, driven by policy,
volume of data protected, and exposure. The key must be rotated out
before it elapses. NIST SP 800-57 gives guidance per key type.

**Q: How do you rotate a JWT/OIDC signing key without breaking anyone?**
Overlap: publish the new key (new `kid`) in the JWKS while still signing
with the old; after propagation (JWKS TTL + fetch), switch signing to
the new key; after the max token lifetime + clock skew, remove the old
key from the JWKS. Dual-*verify* window ≥ JWKS_TTL + max_token_life +
skew.

**Q: Why must token lifetime be ≪ crypto-period?**
The safe retirement time for the old signing key is roughly
`propagation + token_life + skew` after the switch. If token_life is
close to the crypto-period, you can't retire the key on schedule without
rejecting valid in-flight tokens.

**Q: "Deactivate" vs "destroy" a key — why the two states?**
A retired signing key must still *verify* historical artifacts (old
JWTs, signed packages, archived documents) for a grace period, so it
goes to verify-only/disabled first. Destroy only after nothing needs it,
and with a recovery hold (e.g. AWS KMS 7–30 days) so a mistaken or
malicious deletion is reversible.

**Q: Risk of a key that's "never rotated"?**
Compromise probability accumulates with exposure time (more copies made,
more chances of leak, more data under one key if it breaks). Also you've
never tested that rotation *works*, so the first rotation — often forced
by an incident — is high-risk.

---

## Quorum / Shamir

**Q: Explain Shamir's Secret Sharing.**
Encode the secret as `f(0)` of a random degree-`k-1` polynomial over a
prime field; share `i` is `(i, f(i))`. Any `k` shares uniquely determine
`f` (Lagrange interpolation → `f(0)`); any `k-1` shares leave `f(0)`
uniformly random — information-theoretically zero leakage.

**Q: `n=5, k=3` — what does it tolerate?**
Lose any 2 shares and still reconstruct (availability); an attacker with
any 2 shares learns nothing (confidentiality). You choose `k` for the
secrecy/availability balance.

**Q: Does Shamir detect a tampered or forged share?**
No — plain Shamir reconstructs a *wrong* secret silently from a bad
share. Add a verifiable secret sharing scheme (Feldman/Pedersen
commitments) or verify the reconstructed key against a Key Check Value.

**Q: Shamir vs multi-party computation / threshold signatures?**
Shamir reconstructs the key in one place (a brief single point of
exposure during the ceremony). Threshold cryptography (threshold RSA/
ECDSA, MPC) never reconstructs the key — the parties jointly produce a
signature/decryption — stronger, more complex, used by custody and some
CAs.

**Q: What is a key ceremony?**
A scripted, witnessed, logged (often video-recorded, often air-gapped)
procedure to generate or reconstruct a root key, with named roles and
separation of duties, so no individual can perform or subvert it alone.

---

## Operations & pitfalls

**Q: "Secret zero" problem and the modern answer?**
The app needs a credential to fetch its credentials. Solve it with
platform identity the workload didn't have to be handed: Kubernetes
projected ServiceAccount token, cloud IAM instance identity, SPIFFE
SVID from node attestation — the secrets manager trusts that identity
and issues short-lived leased secrets. No static secret at rest.

**Q: Why prefer short-lived leased secrets over long-lived ones?**
Revocation actually works (it expires on its own), a leak has a bounded
window, and rotation is continuous and invisible instead of a scary
event.

**Q: A secret was committed to git 8 months ago and later removed. Safe?**
No. It's in history, forks, clones, CI logs, and backups. Treat it as
compromised: rotate it now, purge history if feasible, and add
`gitleaks`/`trufflehog` to CI so it can't recur.

**Q: BYOK / HYOK / external key store — what and why?**
BYOK: customer generates the key and imports it into the provider's KMS
(provider still operates it). HYOK / External Key Store: the key stays
in the customer's own HSM and the cloud calls out to it for every op —
maximum control, adds latency and a hard dependency. Both let a customer
revoke provider access by withholding the key.

**Q: How do you make key usage auditable?**
Every KMS/HSM op emits a log (who/what identity, which key, which
operation, when) → SIEM. Alert on: decrypt volume spikes, use from a new
principal or region, `ScheduleKeyDeletion`/`DisableKey`, failed
`Decrypt` bursts (key-guessing / misconfig), and any use of a key
outside its expected service.

**Q: cloud KMS single-region key — the failure mode?**
Every consumer of that key now depends on one region's KMS being up and
reachable, and cross-region callers pay latency. Use multi-region keys
or per-region KEKs, and make sure your DR region can decrypt DR backups.
