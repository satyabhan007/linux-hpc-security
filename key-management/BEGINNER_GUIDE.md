# Key Management Infrastructure — The Amateur's Guide

> A bank doesn't hide its gold in a bigger drawer. It builds a vault: one
> hardened room, a locked hierarchy of doors, a rule that no single
> person can open it, a log of every visit, and a plan for changing the
> locks without closing the bank. Key management is that vault for the
> secrets that make encryption, signing, and authentication mean
> anything.

Encryption is easy. **Key management is the hard 90%** — because a key
that is generated badly, stored next to the data, never rotated, or
impossible to revoke gives you the *cost* of cryptography with none of
the *protection*.

---

## 1. The core idea: a key hierarchy

Never protect a lot of data with one key you also have to move around.
Build a tree:

```
Root of trust        HSM / KMS master key — never leaves the device
   │  wraps
KEK  (key-encryption key)   per app / per tenant / per environment
   │  wraps
DEK  (data-encryption key)  per object / per table / per file
   │  encrypts
data
```

This is **envelope encryption**. To read an object you make one small
call to unwrap its DEK, then decrypt locally. It buys three things
(Lab: `step1`):

- **KEK rotation is cheap** — re-wrap the DEKs, don't re-encrypt
  petabytes. Rotation is `O(number of keys)`, not `O(bytes)`.
- **Small blast radius** — a leaked DEK exposes *one* object, not the
  store. A leaked KEK is bad; a leaked *master* key is the incident.
- **Crypto-shredding** — destroy a key and its data is instantly,
  provably unrecoverable, even though the ciphertext still sits on disk
  and backups. "Delete the user's data" can mean "delete one key".

---

## 2. Where keys live: KMS and HSM

| | Software KMS (Vault, cloud KMS API) | HSM (hardware security module) |
|---|---|---|
| Key material | in memory / encrypted store | inside tamper-resistant hardware, **never exportable** |
| Operations | encrypt/decrypt/sign via API | encrypt/decrypt/sign **on the device** |
| Assurance | good | FIPS 140-2/3 Level 3, physical tamper response |
| Cost / speed | cheap, elastic | expensive, throughput-limited |
| Use | app secrets, envelope KEKs | CA roots, code-signing, payment (PCI), root of trust |

Cloud KMS (AWS KMS, GCP Cloud KMS, Azure Key Vault) is HSM-backed under
the hood; you get the "key never leaves" property via an API. **PKCS#11**
is the standard C API to talk to an HSM/token; **KMIP** is the standard
protocol for a KMS to manage keys across vendors.

> **Analogy.** An HSM is a safe-deposit box you can *use* but never take
> home: you slide a document through a slot, it comes back stamped
> (signed) or opened (decrypted), and the key that did it never leaves
> the vault.

---

## 3. Secrets managers vs key managers

- **Key manager / KMS**: manages *cryptographic keys* and does crypto
  operations with them (wrap, sign, HMAC). You often never see the key.
- **Secrets manager** (Vault KV, AWS Secrets Manager, GCP Secret
  Manager, Sealed Secrets, External Secrets Operator): stores *arbitrary
  secrets* (DB passwords, API tokens, TLS private keys) and hands them
  to workloads with authentication, leasing, and audit.

They compose: the secrets manager encrypts its store with a KMS KEK, and
issues **short-lived, leased** credentials (a 1-hour DB password) so a
leaked secret expires on its own. Workloads authenticate to it by
*identity* (Kubernetes ServiceAccount, cloud IAM role, SPIFFE SVID),
not by another static secret — solving the "secret zero" bootstrap.

---

## 4. The key lifecycle

```
generate → distribute → use (active) → rotate → deactivate → destroy
   │           │            │             │          │           │
 CSPRNG /   wrapped,     least-priv    overlap    verify-only  crypto-
 HSM        authn'd      grants        window     grace        shred
```

- **Generate** with a real CSPRNG or in the HSM. Never a timestamp seed,
  never `Math.random`.
- **Distribute** wrapped, over an authenticated channel, to the minimum
  set of principals. Log it.
- **Use** with least privilege: separate keys for encrypt vs decrypt vs
  sign; per-environment; per-purpose.
- **Rotate** on a schedule (the **crypto-period**) and on suspicion.
- **Deactivate** before **destroy**: a decommissioned signing key must
  still *verify* old artifacts for a grace period.
- **Destroy** with a delay/hold (AWS KMS: 7–30 day waiting period) so a
  mistake or an attacker's `DeleteKey` is recoverable.

---

## 5. Rotation without an outage

Rotating a *data* key: re-wrap DEKs (cheap), re-encrypt lazily on next
write, or run a background re-wrap.

Rotating a *signing* key (JWT, mTLS CA, package/DNSSEC) is subtler —
tokens signed with the old key are still valid and in flight. You need
an **overlap window** where both keys verify (Lab: `step3`):

```
publish new key (kid=v2), keep signing with v1     ── verifiers still fetching v2
        └─ after JWKS TTL + fetch (propagation P) ─┘
switch signing to v2
        └─ after max token lifetime L + clock skew S ─┘
retire v1
```

Two classic failures the lab detects:

1. **Retire the old key too soon** → valid in-flight tokens get
   rejected (an outage that looks like an auth bug).
2. **Token lifetime ≈ crypto-period** → you can't retire the key on time
   without breaking tokens. Rule: **token life ≪ crypto-period**.

And the slow failure: *never rotating*. Compromise probability
accumulates with exposure time — a key untouched for 3 years is very
likely already copied somewhere.

---

## 6. No single point of trust: quorum & Shamir

The root/unseal key must not exist whole anywhere. **Shamir's Secret
Sharing** splits it into `n` shares such that any `k` reconstruct it and
any `k-1` reveal *nothing* (Lab: `step2`). This is how Vault unseals and
how offline CA roots are protected: `n=5` custodians, quorum `k=3`, so
two shares can be lost (availability) or stolen (confidentiality)
without failure. The reconstruction happens in a controlled **key
ceremony** — scripted, witnessed, logged, often air-gapped.

(Plain Shamir doesn't detect a forged share — a wrong share yields a
wrong key *silently*. Real systems add a per-share commitment (VSS) or
check a Key Check Value after reconstruction.)

---

## 7. What good key management gives you

| Property | Mechanism |
|---|---|
| Key never in the app's memory | KMS/HSM does the crypto op |
| Data key leak ≠ breach | envelope encryption, per-object DEKs |
| "Delete my data" is instant & complete | crypto-shredding |
| Rotation is routine, not scary | automation + overlap windows |
| No one person can exfiltrate the root | Shamir quorum + separation of duties |
| Every use is attributable | KMS audit log → SIEM (Module 2/5) |
| Revocation actually works | short-lived leased secrets, CRL/OCSP for certs |
| Survives an HSM failure | multi-region KMS, tested key backup/restore |

---

## 8. Run the labs

```bash
python3 key-management/step1_envelope_encryption.py  # KEK/DEK, rotation re-wraps, crypto-shred
python3 key-management/step2_shamir_split.py         # k-of-n secret sharing, the key ceremony
python3 key-management/step3_rotation_windows.py     # signing-key overlap windows & crypto-periods
```

You've now walked the whole stack: the machine (`linux`, `tuning`), the
kernel's guardrails (`linux-security`), automation and provisioning
(`ansible`, `warewulf`), HPC (`hpc`, `fabric`, `storage`,
`benchmarking`), observability (`ebpf`), and the three security-analytics
modules — detecting attacks you can't decrypt (`encrypted-anomaly`),
people pretending to be many people (`fraud-detection`), and the keys
that anchor all of it (`key-management`). 🎉
