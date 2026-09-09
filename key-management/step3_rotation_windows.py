#!/usr/bin/env python3
"""
Key Management · Step 3 — rotation windows, overlap, and crypto-periods.

Rotating a SIGNING key (JWT, mTLS CA, package signing, DNSSEC ZSK) is
not "swap it out". Tokens signed with the old key are still in flight;
verifiers learn the new key only after propagation. You need an
OVERLAP window where BOTH keys verify.

  t0            new key published (kid=v2), still signing with v1
  t0 + P        every verifier has fetched JWKS -> start signing with v2
  t0 + P + L    last v1-signed token has expired -> retire v1

Constraints modelled:
  * P  = key-distribution propagation delay (JWKS TTL + fetch)
  * L  = max token lifetime
  * S  = max clock skew allowed
  * C  = crypto-period: the key MUST be retired by C (policy/limits on
         data-per-key, exposure time)

We check candidate schedules and flag the two classic failures:
  - retiring the old key too early  -> valid in-flight tokens rejected
  - keeping a key past its crypto-period -> policy / exposure violation
"""

DAY = 86400


def plan_rotation(t0, P, L, S, C):
    dual_sign_start = t0
    single_sign_start = t0 + P
    old_retire = t0 + P + L + S           # safe: last old token has expired
    events = {
        "publish_v2_and_dual_verify": dual_sign_start,
        "switch_signing_to_v2": single_sign_start,
        "retire_v1": old_retire,
        "v1_age_at_retire": old_retire - t0,
        "crypto_period": C,
    }
    events["ok"] = old_retire - t0 <= C
    return events


def simulate(retire_offset, P, L, S):
    """Given we retire v1 at t0+retire_offset, does any still-valid
    v1-signed token get rejected?"""
    # worst case: a token was signed with v1 the instant before we
    # switched signing to v2 (at t0+P), lifetime L, plus skew S.
    last_v1_token_expiry = P + L + S
    return "REJECTS valid tokens" if retire_offset < last_v1_token_expiry else "safe"


def main():
    t0 = 1_000_000
    P = 2 * 3600          # JWKS TTL 1h + slack -> ~2h to fully propagate
    L = 1 * DAY           # access tokens live up to 24h
    S = 300               # 5 min clock skew
    C = 90 * DAY          # 90-day crypto-period policy

    plan = plan_rotation(t0, P, L, S, C)
    for k, v in plan.items():
        if k in ("v1_age_at_retire", "crypto_period"):
            print(f"  {k:>28}: {v/DAY:.2f} days")
        elif k == "ok":
            print(f"  {k:>28}: {v}")
        else:
            print(f"  {k:>28}: +{(v - t0)/3600:.1f} h")
    assert plan["ok"], "rotation completes within the crypto-period"

    # --- failure 1: retire the old key too fast ---
    too_fast = plan_rotation(t0, P, L, S, C)
    bad_retire = t0 + P + 3600          # retire only 1h after switching signing
    print(f"\n  if we retire v1 at +{(bad_retire-t0)/3600:.1f}h instead of "
          f"+{(too_fast['retire_v1']-t0)/3600:.1f}h:")
    verdict = simulate(bad_retire - t0, P, L, S)
    print(f"    -> {verdict}")
    assert verdict.startswith("REJECTS")
    # the safe schedule does not
    assert simulate(too_fast["retire_v1"] - t0, P, L, S) == "safe"

    # --- failure 2: key kept past its crypto-period ---
    # long-lived tokens (L = 30d) push the safe retirement past C = 90d?
    long_tokens = plan_rotation(t0, P, L=30 * DAY, S=S, C=C)
    print(f"\n  with 30-day tokens, safe retirement is at "
          f"{long_tokens['v1_age_at_retire']/DAY:.1f} days "
          f"(crypto-period {C/DAY:.0f}) -> ok={long_tokens['ok']}")
    assert long_tokens["ok"]
    # ...but 120-day tokens do NOT fit a 90-day crypto-period:
    absurd = plan_rotation(t0, P, L=120 * DAY, S=S, C=C)
    print(f"  with 120-day tokens: safe retirement at "
          f"{absurd['v1_age_at_retire']/DAY:.1f} days -> ok={absurd['ok']}  "
          f"(token lifetime must be << crypto-period)")
    assert not absurd["ok"]

    # --- risk accumulation: 'we never rotate' ---
    print("\n  'never rotated' key, exposure risk ~ 1 - (1 - p_leak_per_day)^age:")
    p = 0.002
    for age_days in (30, 180, 365, 1095):
        risk = 1 - (1 - p) ** age_days
        print(f"    age {age_days:>4}d  cumulative compromise probability ~ {risk:.0%}")
    assert 1 - (1 - p) ** 1095 > 0.8

    print("\n  rules of thumb: dual-verify window >= JWKS_TTL + max_token_life + skew;")
    print("  token life << crypto-period; automate rotation (KMS/Vault/cert-manager)")
    print("  so it's routine, not a feared annual event.")
    print("\nPASS — safe schedule respects propagation + token life + skew and fits the"
          " crypto-period; both classic failure modes are detected.")


if __name__ == "__main__":
    main()
