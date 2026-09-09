# Key Management Infrastructure — Deep Dive: Production Scenarios

---

## Scenario 1 — Encrypt an existing 400 TB data lake, then rotate the KEK

**Requirement.** Compliance mandates encryption at rest with customer-
controlled keys and annual key rotation. The lake is 400 TB of Parquet.

**Design.**
- One **KEK per dataset** in the cloud KMS (HSM-backed), tenant-scoped.
- Each object (or each 128 MB block) gets a fresh **DEK**; the wrapped
  DEK is stored in the object footer / a sidecar manifest.
- Readers call `KMS.Decrypt(wrapped_dek)` once per object open (cache the
  plaintext DEK in memory for the file's lifetime, never persist it).

**Annual rotation.**
- `KMS.rotate(KEK)` creates v2. New writes wrap under v2 automatically.
- A background job **re-wraps** existing DEKs: read wrapped DEK →
  `KMS.Decrypt` (v1) → `KMS.Encrypt` (v2) → overwrite the sidecar. It
  touches kilobytes per object, not the 400 TB. Millions of tiny KMS
  calls — rate-limit and batch.
- Old KEK version stays **enabled for decrypt** until every object is
  re-wrapped, then move to **disabled** (kept, not deleted) for a grace
  period, then schedule destruction with a 30-day hold.

**Gotchas.**
- KMS **request quotas** — a naive "re-wrap everything Monday" job will
  throttle; spread it, use `GenerateDataKeyWithoutPlaintext` where
  possible, cache aggressively.
- **Backups** written under v1 are still v1 — your restore path must be
  able to reach a disabled (not destroyed) old KEK version.
- **Cross-region**: readers in `eu` calling a KMS key in `us` add
  latency and a failure domain — use multi-region keys or per-region
  KEKs.

---

## Scenario 2 — JWT signing key rotation breaks logins for 20 minutes

**Symptom.** Ops rotated the JWT signing key at 02:00. From 02:00–02:20,
~15% of API calls returned `401 invalid signature`, then it healed by
itself.

**Root cause.** They swapped `kid=v1` for `kid=v2` and immediately
stopped serving `v1` in the JWKS. But:
- API pods cache the JWKS for 15 minutes → some verifiers still only had
  `v1`... no wait, the opposite: tokens *already issued* were signed with
  `v1`, and the moment `v1` left the JWKS, every verifier that refreshed
  its cache rejected them. Tokens live up to 1 hour, so in-flight `v1`
  tokens were valid for up to 59 more minutes.

**Correct procedure (Lab `step3`).**
```
1. publish v2 in JWKS alongside v1; keep SIGNING with v1
2. wait >= JWKS_TTL + fetch slack   (all verifiers now have v2)
3. switch SIGNING to v2
4. wait >= max_token_lifetime + clock_skew   (last v1 token has expired)
5. remove v1 from JWKS
```
Dual-**verify** window ≥ `JWKS_TTL + max_token_life + skew`. And keep
`max_token_life` far below the crypto-period, or step 4 never fits.

**Prevention.** Automate it (the IdP should do overlapping `kid`s
natively). Alert on `invalid signature` rate. Never hand-edit JWKS.

---

## Scenario 3 — HSM outage takes down the payment path

**Symptom.** The on-prem HSM cluster (2 nodes) loses quorum during a
firmware update. Every card authorization needs an HSM operation
(PIN block translation, CVV, key derivation). Payments stop.

**What went wrong.** Single HSM cluster, no tested failover, the
firmware update was applied to both nodes in the same window.

**Fixes.**
- **N+1 HSMs across failure domains**; treat firmware updates like any
  rolling deploy (one node, verify, next).
- **Key backup**: HSM keys are exported only as **cryptograms** wrapped
  by a backup key held under Shamir shares in separate safes. Test the
  restore into a spare HSM on a schedule — an untested backup is not a
  backup.
- **Graceful degradation**: a short offline-auth window with strict
  limits beats a hard decline (a business decision, pre-agreed).
- Cloud alternative: cloud payment HSM (AWS CloudHSM, Payshield-as-a-
  service) with multi-AZ.

---

## Scenario 4 — "Secret zero": how does the app get its first credential?

**Problem.** The app needs a DB password. You put it in a secrets
manager. But the app needs a *credential to authenticate to the secrets
manager*. Turtles all the way down.

**Solutions, best to worst.**
1. **Platform identity** — the workload proves what it is with something
   it didn't have to be given: a Kubernetes ServiceAccount JWT
   (projected, audience-bound, short TTL), a cloud instance's IAM
   role/metadata identity, a SPIFFE/SPIRE SVID from node attestation.
   Vault/KMS trusts that identity and issues a **short-lived, leased**
   DB credential. Nothing static is ever stored.
2. **TPM / hardware attestation** — the node's TPM quote (Module 13's
   IMA PCRs) gates secret release, so only a known-good boot state gets
   keys.
3. **Injected at deploy** by a trusted orchestrator (worse: the
   orchestrator is now the target; the secret is at rest in the pod
   spec / env).
4. **Baked into the image / committed to git** — the incident waiting to
   happen. `git-secrets`, `gitleaks`, `trufflehog` in CI to catch it;
   assume anything ever committed is burned and must be rotated.

---

## Scenario 5 — GDPR "right to erasure" across 40 backups

**Requirement.** A user requests deletion. Their data is in the primary
DB, a search index, an analytics warehouse, and 40 nightly backup
snapshots going back 90 days. You cannot rewrite immutable backups.

**Answer: crypto-shredding.** Every user's data is encrypted with a
**per-user DEK** (or per-user KEK wrapping per-object DEKs). Erasure =
**destroy that user's key**. The ciphertext remains in every backup,
now permanently unreadable. Document the design as the erasure
mechanism.

**Caveats.**
- Only works if the key was per-user *from the start* — retrofitting
  means a re-encryption pass.
- Shared/derived data (aggregates, ML features) needs its own handling.
- Key-destruction must itself be **irreversible and logged** (no
  30-day undelete for this key), and replicated key stores must all
  purge it.
- Some regulators want data-level deletion too — get legal sign-off that
  crypto-shred satisfies your obligation.

---

## Scenario 6 — The offline Root CA key ceremony

**Context.** You run an internal PKI. The Root CA private key signs only
the intermediate CAs, a few times a decade. If it leaks, every
certificate in the org is untrustworthy.

**Practice.**
- Root key generated **in an HSM**, on an **air-gapped** machine,
  during a scripted ceremony with named roles (ceremony admin, HSM
  operator, witnesses, auditor) and a written, pre-reviewed script.
- Key backup exported as an HSM cryptogram; the **backup key** is split
  with Shamir `k=3, n=5` (Lab `step2`); shares go to tamper-evident
  bags in separate physical safes held by separate people.
- The whole thing is **video-recorded**, every step initialled, the log
  archived.
- Root cert has a long validity (20+ years) but the key is used only to
  issue intermediates with shorter lives; **name constraints** and
  **path length** limit what a compromised intermediate can do.
- Practise the **recovery** ceremony too — the first time you reconstruct
  the Shamir shares should not be during an incident.

---

## Reference — choosing key scope

```
one key for everything            -> huge blast radius, can't rotate independently
per environment (dev/stage/prod)  -> minimum sane separation
per tenant / per customer         -> enables per-customer crypto-shred & BYOK
per purpose (encrypt/sign/HMAC)   -> a decrypt-only grant can't forge signatures
per object DEK + shared KEK       -> cheap rotation, tiny per-key exposure
```

## Quick reference

```bash
# AWS KMS
aws kms create-key ; aws kms enable-key-rotation --key-id K
aws kms generate-data-key --key-id K --key-spec AES_256
aws kms schedule-key-deletion --key-id K --pending-window-in-days 30
# Vault
vault write transit/keys/app type=aes256-gcm96
vault write transit/rotate/app ; vault write transit/config/app min_decryption_version=3
vault read database/creds/app-role     # short-lived leased DB creds
# PKCS#11 / HSM
pkcs11-tool --list-objects ; softhsm2-util --show-slots
# certs
step certificate inspect cert.pem ; openssl x509 -noout -dates -in cert.pem
cert-manager: kubectl get certificate,certificaterequest,order,challenge -A
# hygiene
gitleaks detect ; trufflehog filesystem . ; detect-secrets scan
```
