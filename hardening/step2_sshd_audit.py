#!/usr/bin/env python3
"""
Hardening · Step 2 — audit an sshd_config the way a scanner does.

sshd_config is parsed first-match-wins for most keywords, defaults apply
to anything unset, and Match blocks override globally. This lab parses a
config with that precedence, applies the effective defaults, and grades
each security-relevant setting.
"""

SSHD_CONFIG = """\
# /etc/ssh/sshd_config
Port 22
Protocol 2
PermitRootLogin prohibit-password
MaxAuthTries 6
PubkeyAuthentication yes
PasswordAuthentication yes
ClientAliveInterval 0
X11Forwarding yes
LoginGraceTime 120
Ciphers aes256-gcm@openssh.com,aes128-ctr,3des-cbc

Match Group sftp-only
    ForceCommand internal-sftp
    PasswordAuthentication no
"""

# keyword -> (recommended value, why)
POLICY = {
    "permitrootlogin":        ("no",  "root must log in as a user then escalate — no shared root key"),
    "passwordauthentication": ("no",  "keys only; passwords are brute-forceable and reused"),
    "maxauthtries":           ("<=4", "limit guesses per connection"),
    "clientaliveinterval":    (">0",  "reap idle/hung sessions"),
    "x11forwarding":          ("no",  "X11 forwarding is a well-worn pivot on servers"),
    "logingracetime":         ("<=60","shrink the pre-auth window (CVE-2024-6387 class)"),
    "ciphers":                ("no-cbc", "CBC/3des ciphers are weak — GCM/CTR only"),
}


def parse_global(text):
    """First-match-wins, stop at the first Match block."""
    cfg = {}
    for raw in text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if not line:
            continue
        key, _, val = line.partition(" ")
        key = key.lower()
        if key == "match":
            break
        cfg.setdefault(key, val.strip())   # setdefault == first wins
    return cfg


def grade(cfg):
    findings = []

    def bad(k, got, rec, why):
        findings.append((k, got, rec, why))

    v = cfg.get("permitrootlogin", "prohibit-password")
    if v != "no":
        bad("PermitRootLogin", v, "no", POLICY["permitrootlogin"][1])

    v = cfg.get("passwordauthentication", "yes")
    if v != "no":
        bad("PasswordAuthentication", v, "no", POLICY["passwordauthentication"][1])

    v = int(cfg.get("maxauthtries", "6"))
    if v > 4:
        bad("MaxAuthTries", v, "<= 4", POLICY["maxauthtries"][1])

    v = int(cfg.get("clientaliveinterval", "0"))
    if v <= 0:
        bad("ClientAliveInterval", v, "> 0 (e.g. 300)", POLICY["clientaliveinterval"][1])

    v = cfg.get("x11forwarding", "no")
    if v != "no":
        bad("X11Forwarding", v, "no", POLICY["x11forwarding"][1])

    v = int(cfg.get("logingracetime", "120"))
    if v > 60:
        bad("LoginGraceTime", v, "<= 60", POLICY["logingracetime"][1])

    ciphers = cfg.get("ciphers", "")
    weak = [c for c in ciphers.split(",") if "cbc" in c or "3des" in c]
    if weak:
        bad("Ciphers", ",".join(weak), "GCM/CTR only", POLICY["ciphers"][1])

    return findings


def main():
    cfg = parse_global(SSHD_CONFIG)
    print("effective global config (first-match-wins, Match block ignored for global):")
    for k, v in cfg.items():
        print(f"  {k} = {v}")

    findings = grade(cfg)
    print(f"\n{len(findings)} findings:\n")
    for k, got, rec, why in findings:
        print(f"  ✗ {k}: '{got}'  ->  want {rec}")
        print(f"      {why}")

    keys = {f[0] for f in findings}
    # prohibit-password still allows a root key — scanners flag it
    assert "PermitRootLogin" in keys
    assert "PasswordAuthentication" in keys
    assert "MaxAuthTries" in keys
    assert "X11Forwarding" in keys
    assert "LoginGraceTime" in keys
    assert "Ciphers" in keys       # 3des-cbc present
    assert "ClientAliveInterval" in keys
    assert len(findings) == 7

    print("\n  note: PasswordAuthentication in the Match sftp-only block IS 'no',")
    print("  but that only narrows one group — the global setting is what bots hit.")
    print("\nPASS — 7/7 weak settings caught with defaults + first-match parsing.")


if __name__ == "__main__":
    main()
