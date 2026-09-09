#!/usr/bin/env python3
"""
Hardening · Step 1 — score a host against a CIS-style baseline.

A benchmark is a list of checks, each with a weight and a level
(L1 = safe everywhere, L2 = defense-in-depth, may break things). A
scanner runs the checks against the live host and produces a compliance
percentage plus a prioritized remediation list.

This models that: a set of checks, a fake "host state", the evaluation,
and a weighted score with L1 vs L2 broken out.
"""

# (id, title, level, weight, predicate over host state)
CHECKS = [
    ("1.1.1", "cramfs filesystem module disabled", "L1", 1,
     lambda h: "cramfs" in h["blacklisted_modules"]),
    ("1.5.1", "bootloader password set", "L2", 2,
     lambda h: h["grub_password"]),
    ("2.2.1", "no X11/display manager on server", "L1", 1,
     lambda h: not h["packages"] & {"xorg-x11-server-Xorg", "gdm"}),
    ("3.3.1", "rp_filter enabled (all + default)", "L1", 2,
     lambda h: h["sysctl"].get("net.ipv4.conf.all.rp_filter") == 1),
    ("4.1.3", "auditd records privileged commands", "L2", 3,
     lambda h: h["auditd_rules"] >= 60),
    ("5.2.10", "sshd PermitRootLogin no", "L1", 3,
     lambda h: h["sshd"].get("permitrootlogin") == "no"),
    ("5.2.11", "sshd PasswordAuthentication no", "L1", 3,
     lambda h: h["sshd"].get("passwordauthentication") == "no"),
    ("5.3.1", "pam_pwquality enforced", "L1", 2,
     lambda h: h["pam"].get("minlen", 0) >= 14),
    ("5.4.2", "no non-root accounts with UID 0", "L1", 5,
     lambda h: h["uid0_accounts"] == ["root"]),
    ("6.1.2", "/etc/passwd perms 644 or stricter", "L1", 1,
     lambda h: h["passwd_mode"] <= 0o644),
]

HOST = {
    "blacklisted_modules": {"cramfs", "udf"},
    "grub_password": False,                       # fail (L2)
    "packages": {"openssh-server", "slurm", "gdm"},  # fail 2.2.1
    "sysctl": {"net.ipv4.conf.all.rp_filter": 1},
    "auditd_rules": 12,                            # fail (L2)
    "sshd": {"permitrootlogin": "no",
             "passwordauthentication": "yes"},    # fail 5.2.11
    "pam": {"minlen": 8},                          # fail 5.3.1
    "uid0_accounts": ["root", "backupadmin"],      # fail 5.4.2 — critical
    "passwd_mode": 0o644,
}


def evaluate(checks, host):
    rows = []
    for cid, title, level, weight, pred in checks:
        try:
            ok = bool(pred(host))
        except Exception:
            ok = False
        rows.append((cid, title, level, weight, ok))
    return rows


def score(rows, level=None):
    sel = [r for r in rows if level is None or r[2] == level]
    got = sum(w for *_, w, ok in sel if ok)
    tot = sum(w for *_, w, ok in sel)
    return got, tot, (100 * got / tot if tot else 100.0)


def main():
    rows = evaluate(CHECKS, HOST)

    print(f"{'id':>7}  {'lvl':>3}  {'wt':>2}  result  title")
    for cid, title, level, weight, ok in rows:
        print(f"{cid:>7}  {level:>3}  {weight:>2}  {'PASS' if ok else 'FAIL'}   {title}")

    g1, t1, p1 = score(rows, "L1")
    g2, t2, p2 = score(rows, "L2")
    g, t, p = score(rows)
    print(f"\n  L1 compliance: {p1:5.1f}%  ({g1}/{t1} weighted)")
    print(f"  L2 compliance: {p2:5.1f}%  ({g2}/{t2} weighted)")
    print(f"  overall:       {p:5.1f}%  ({g}/{t} weighted)")

    fails = [r for r in rows if not r[4]]
    fails.sort(key=lambda r: -r[3])   # remediate highest weight first
    print("\n  remediation queue (highest impact first):")
    for cid, title, level, weight, _ in fails:
        print(f"    [{weight}] {cid} {level}  {title}")

    top = fails[0]
    assert top[0] == "5.4.2", "the UID-0 account must surface as the top finding"
    assert p1 < 100 and p2 < 100
    # L1 should score better than L2 here (fewer L1 gaps) — sanity of weighting
    assert p1 > p2
    print("\nPASS — weighted scoring puts 'extra UID 0 account' at the top of the list.")


if __name__ == "__main__":
    main()
