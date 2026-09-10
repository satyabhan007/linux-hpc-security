#!/usr/bin/env python3
"""
SOC · Step 2 — a MITRE ATT&CK coverage matrix, weighted by prevalence.

"We have 400 detections" is not a security posture. The question is:
which tactics and techniques can you actually SEE, weighted by how often
adversaries use them, and where are the blind spots an intrusion would
walk straight through?

This maps a set of detections to ATT&CK techniques, computes per-tactic
coverage (plain and prevalence-weighted), and prints the gap list a
detection-engineering backlog is built from.
"""

# (technique_id, tactic, name, prevalence_weight 1-10)  -- a small realistic slice
TECHNIQUES = [
    ("T1566", "initial-access",   "Phishing",                        10),
    ("T1078", "initial-access",   "Valid Accounts",                   9),
    ("T1190", "initial-access",   "Exploit Public-Facing App",        7),
    ("T1059", "execution",        "Command / Scripting Interpreter", 10),
    ("T1204", "execution",        "User Execution",                   6),
    ("T1053", "persistence",      "Scheduled Task/Job",               7),
    ("T1543", "persistence",      "Create/Modify System Process",     6),
    ("T1547", "persistence",      "Boot/Logon Autostart",             5),
    ("T1548", "priv-esc",         "Abuse Elevation Control",          6),
    ("T1068", "priv-esc",         "Exploit for Priv Esc",            5),
    ("T1055", "defense-evasion",  "Process Injection",                7),
    ("T1027", "defense-evasion",  "Obfuscated/Packed Files",          6),
    ("T1562", "defense-evasion",  "Impair Defenses",                  8),
    ("T1003", "cred-access",      "OS Credential Dumping",            9),
    ("T1110", "cred-access",      "Brute Force",                      6),
    ("T1021", "lateral-movement", "Remote Services",                  8),
    ("T1570", "lateral-movement", "Lateral Tool Transfer",            4),
    ("T1071", "command-control",  "Application Layer Protocol",       8),
    ("T1105", "command-control",  "Ingress Tool Transfer",            7),
    ("T1041", "exfiltration",     "Exfil Over C2 Channel",            7),
    ("T1567", "exfiltration",     "Exfil Over Web Service",           6),
    ("T1486", "impact",           "Data Encrypted for Impact",        9),
]

# detections we have, by the technique they cover and their confidence 0-1
DETECTIONS = {
    "susp_powershell_encodedcommand": ("T1059", 0.8),
    "office_spawns_shell":            ("T1204", 0.7),
    "new_scheduled_task_sysmon":      ("T1053", 0.9),
    "lsass_handle_access":            ("T1003", 0.85),
    "impossible_travel_login":        ("T1078", 0.6),
    "smb_admin_share_write":          ("T1021", 0.7),
    "beaconing_jitter_low_entropy":   ("T1071", 0.65),
    "edr_disable_or_tamper":          ("T1562", 0.8),
    "mass_file_rename_extension":     ("T1486", 0.9),
    "rare_parent_child_lolbin":       ("T1059", 0.5),   # a second, weaker T1059 detection
}


def coverage():
    by_tech = {}
    for name, (tid, conf) in DETECTIONS.items():
        by_tech.setdefault(tid, []).append(conf)
    # a technique is "covered" if best detection confidence >= 0.5
    tech_cov = {tid: max(cs) for tid, cs in by_tech.items()}

    tactics = {}
    for tid, tactic, name, w in TECHNIQUES:
        d = tactics.setdefault(tactic, {"tot": 0, "cov": 0, "wtot": 0, "wcov": 0, "gaps": []})
        d["tot"] += 1
        d["wtot"] += w
        c = tech_cov.get(tid, 0.0)
        if c >= 0.5:
            d["cov"] += 1
            d["wcov"] += w * min(c, 1.0)
        else:
            d["gaps"].append((tid, name, w))
    return tactics


ORDER = ["initial-access", "execution", "persistence", "priv-esc",
         "defense-evasion", "cred-access", "lateral-movement",
         "command-control", "exfiltration", "impact"]


def main():
    tac = coverage()
    print(f"{'tactic':>17}  {'tech':>7}  {'plain':>6}  {'weighted':>9}")
    tot_w = tot_wc = 0
    for t in ORDER:
        d = tac[t]
        plain = d["cov"] / d["tot"]
        wtd = d["wcov"] / d["wtot"]
        tot_w += d["wtot"]
        tot_wc += d["wcov"]
        bar = "#" * round(wtd * 10)
        print(f"{t:>17}  {d['cov']}/{d['tot']:<5}  {plain:>5.0%}  {wtd:>7.0%} |{bar:<10}|")

    overall_w = tot_wc / tot_w
    print(f"\n  prevalence-weighted overall coverage: {overall_w:.0%}")

    print("\n  top blind spots (high prevalence, no detection):")
    gaps = []
    for t in ORDER:
        for tid, name, w in tac[t]["gaps"]:
            gaps.append((w, t, tid, name))
    for w, t, tid, name in sorted(gaps, reverse=True)[:6]:
        print(f"    [{w:>2}] {tid} {name:<28} ({t})")

    # assertions on the model's behaviour
    ia = tac["initial-access"]
    assert ia["cov"] == 1 and ia["tot"] == 3, "only Valid Accounts covered in initial-access"
    # a zero-coverage tactic must exist (priv-esc has no detections here)
    assert tac["priv-esc"]["cov"] == 0
    # execution is covered but the two T1059 detections don't double-count the technique
    assert tac["execution"]["cov"] == 2 and tac["execution"]["tot"] == 2
    # weighted overall differs from a naive technique count (prevalence matters)
    naive = sum(1 for tid, *_ in TECHNIQUES
                if max([c for n, (t, c) in DETECTIONS.items() if t == tid] or [0]) >= 0.5)
    naive_frac = naive / len(TECHNIQUES)
    assert abs(overall_w - naive_frac) > 0.02, "weighting should move the number"
    top_gap = max(gaps)[3]
    assert top_gap == "Phishing", "the biggest unweighted... err, weighted gap should be Phishing (w=10)"

    print("\nPASS — coverage is a weighted matrix with named blind spots, not a detection count.")


if __name__ == "__main__":
    main()
