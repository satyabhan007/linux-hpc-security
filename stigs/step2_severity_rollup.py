#!/usr/bin/env python3
"""
STIGs · Step 2 — roll up a scan into CAT I/II/III and an ATO-readiness call.

An accreditor does not read 400 individual results. They look at:
  - open CAT I  (must be zero, or a signed exception)
  - open CAT II (a plan / POA&M, trending down)
  - overall %   (contractual floor, often 90-95%)
This lab takes raw scan results + a POA&M list and produces that verdict.
"""

# rule_id -> (cat, result)   result in {pass, fail, notapplicable, notchecked}
# The interesting handful, then realistic filler so the overall % is
# near a real accredited system (~92%).
RESULTS = {
    "telnet_removed":        ("CAT I",  "pass"),
    "root_login_disabled":   ("CAT I",  "pass"),
    "no_nullok_pam":         ("CAT I",  "fail"),      # but covered by a POA&M
    "ssh_idle_timeout":      ("CAT II", "pass"),
    "audit_privileged_cmds": ("CAT II", "fail"),      # covered by a POA&M
    "aide_installed":        ("CAT II", "fail"),      # OPEN
    "gpgcheck_enabled":      ("CAT II", "pass"),
    "sysctl_rp_filter":      ("CAT II", "pass"),
    "banner_text":           ("CAT III", "fail"),     # OPEN
    "motd_configured":       ("CAT III", "pass"),
    "usb_storage_disabled":  ("CAT II", "notapplicable"),  # no USB on server
    "fips_mode":             ("CAT II", "notchecked"),      # scanner couldn't test
}
# realistic filler: 8 more CAT I pass, 34 CAT II pass, 6 CAT III pass
for i in range(8):
    RESULTS[f"cat1_ok_{i}"] = ("CAT I", "pass")
for i in range(34):
    RESULTS[f"cat2_ok_{i}"] = ("CAT II", "pass")
for i in range(6):
    RESULTS[f"cat3_ok_{i}"] = ("CAT III", "pass")

# accepted deviations signed by the AO: rule_id -> reason
POAM = {
    "audit_privileged_cmds": "SIEM-side auditing compensates; host rule breaks a vendor agent. Fix Q2.",
    "no_nullok_pam": "third-party auth module ships nullok; vendor patch tracked. Compensating: MFA enforced.",
}

CONTRACT_FLOOR = 90.0


def rollup(results, poam):
    cats = {"CAT I": [0, 0, 0], "CAT II": [0, 0, 0], "CAT III": [0, 0, 0]}
    # index: 0=pass 1=fail(open) 2=fail(poam-covered)
    scored_pass = scored_total = 0
    open_findings = []
    for rid, (cat, res) in results.items():
        if res in ("notapplicable", "notchecked"):
            continue
        scored_total += 1
        if res == "pass":
            cats[cat][0] += 1
            scored_pass += 1
        else:  # fail
            if rid in poam:
                cats[cat][2] += 1
            else:
                cats[cat][1] += 1
                open_findings.append((cat, rid))
    pct = 100 * scored_pass / scored_total
    return cats, pct, open_findings


def verdict(cats, pct, open_findings):
    open_cat1 = cats["CAT I"][1]
    reasons = []
    if open_cat1:
        reasons.append(f"{open_cat1} open CAT I (unmitigated)")
    if pct < CONTRACT_FLOOR:
        reasons.append(f"overall {pct:.1f}% below {CONTRACT_FLOOR}% floor")
    return ("NOT READY", reasons) if reasons else ("READY (with POA&Ms)", [])


def main():
    cats, pct, open_findings = rollup(RESULTS, POAM)

    print(f"{'category':>8}  {'pass':>4}  {'open':>4}  {'POA&M':>5}")
    for cat in ("CAT I", "CAT II", "CAT III"):
        p, o, m = cats[cat]
        print(f"{cat:>8}  {p:>4}  {o:>4}  {m:>5}")
    print(f"\n  overall (scored only, NA/NC excluded): {pct:.1f}%")

    print("\n  open findings (no accepted POA&M):")
    for cat, rid in open_findings:
        print(f"    {cat}  {rid}")

    v, reasons = verdict(cats, pct, open_findings)
    print(f"\n  ATO readiness: {v}")
    for r in reasons:
        print(f"    - {r}")

    # 'no_nullok_pam' HAS a POA&M -> it should NOT be an open CAT I here...
    assert cats["CAT I"][2] == 1                 # one CAT I covered by POA&M
    assert cats["CAT I"][1] == 0                 # ...so zero OPEN CAT I
    assert ("CAT II", "aide_installed") in open_findings
    assert v.startswith("READY")                 # zero open CAT I + pct >= 90

    # sanity: NA and NC are excluded from the percentage denominator
    assert 90.0 <= pct <= 100.0
    print("\nPASS — a POA&M-covered CAT I is not an OPEN CAT I; verdict is READY-with-POA&Ms.")


if __name__ == "__main__":
    main()
