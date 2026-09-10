# SOC & Detection Engineering — Deep Dive: Production Scenarios

---

## Scenario 1 — The queue has 800 alerts and two analysts

**Symptom.** Every morning the overnight queue is 600–900 alerts. Two
T1s clear maybe 90 between them. The backlog grows; criticals age past
SLA.

**Do not** hire first. Triage the *rules*.

```
# per-rule stats over 30 days (SIEM query, pseudocode)
rule_name | fired | escalated | true_positive | FP_rate | mean_severity
----------|-------|-----------|---------------|---------|-------------
geo_anomaly_login        | 4200 | 12 |  2 | 99.95% | medium
port_scan_internal       | 3100 |  4 |  0 | 100%   | low
dlp_keyword_match        | 2600 | 30 |  5 | 98.8%  | medium
lsass_handle_access      |   40 | 22 | 19 |  5%    | critical
```

**Actions, in order.**
1. **Retire or demote** `port_scan_internal` (100% FP, 0 escalations) —
   convert to a risk contributor (Module 19 RBA), not a standalone alert.
2. **Tune** `geo_anomaly_login`: exclude corporate VPN egress ranges,
   require a second signal (new device OR failed MFA), raise to "medium
   only if the account is privileged".
3. **Keep and protect** `lsass_handle_access` — low volume, high
   escalation rate, critical. This is what the analysts *should* be
   spending time on.
4. **Auto-close** low-fidelity + low-asset + no-corroboration alerts
   with a SOAR playbook that still logs them for hunt review.

**Outcome pattern:** 800 → ~120 alerts/day, criticals worked within SLA,
and the analysts are looking at things that matter.

---

## Scenario 2 — A real intrusion was batch-closed

**Post-incident finding.** An `impossible_travel` alert for a finance
user fired at 02:14. The T1 closed it at 08:30 along with 40 others in a
"bulk close — VPN noise" action. The account was used for wire fraud at
11:00.

**Root causes.**
- `impossible_travel` had a ~97% FP rate (VPN, mobile roaming) → analyst
  reflex was "close".
- No corroboration required. A single weak signal became a standalone
  alert.
- Bulk-close was allowed with one comment for N alerts.

**Fixes.**
- Require **two** signals for a notable: impossible travel **+**
  (new device | MFA fatigue | access to a sensitive app).
- Move to **risk-based alerting** (Module 19): impossible travel adds
  30 risk; a notable fires at 100 accumulated risk for the entity.
- Disable one-comment bulk-close for medium+; require a per-alert
  disposition reason.
- Add a **hunt** query that reviews auto-closed and bulk-closed alerts
  weekly for missed clusters.

---

## Scenario 3 — Building a detection from a hunt hypothesis

**Hypothesis.** "An attacker using `rundll32.exe` to proxy-execute a DLL
will have an unusual parent process and no command-line DLL that exists
on disk in a normal path."

**Detection-as-code lifecycle.**
```
1. hypothesis     -> written in the rule's docstring, linked to ATT&CK T1218.011
2. logic          -> Sigma rule (portable), or SPL / KQL / EQL
3. test data      -> Atomic Red Team T1218.011 run in a lab -> should FIRE
4. benign data    -> 30 days of prod rundll32 events        -> should be quiet
5. tune           -> allowlist known-good parents (explorer, some installers)
6. deploy         -> PR review, CI runs it against the test corpus, merge
7. measure        -> FP rate + escalation rate for 2 weeks; keep / tune / kill
```

**Sigma example (abridged):**
```yaml
title: Rundll32 Without DLL on Disk
logsource: { category: process_creation, product: windows }
detection:
  sel:
    Image|endswith: '\rundll32.exe'
    CommandLine|re: 'rundll32(\.exe)?\s+[^,\s]+,[A-Za-z]'
  filter_known_parents:
    ParentImage|endswith: ['\explorer.exe', '\services.exe']
  condition: sel and not filter_known_parents
falsepositives: [ 'legacy line-of-business apps', 'some MSI installers' ]
level: high
```

---

## Scenario 4 — The ATT&CK coverage review

Quarterly, run adversary emulation (Module 21) and score coverage.

```
tactic            covered/total   weighted   top gap
initial-access        1/3            25%      T1566 Phishing (prev 10)
execution             2/2           100%      —
persistence           1/3            32%      T1053 Scheduled Task (prev 7)
priv-esc              0/2             0%      T1548 Abuse Elevation (prev 6)
defense-evasion       1/3            47%      T1055 Process Injection (prev 7)
cred-access           1/2            75%      T1110 Brute Force (prev 6)
lateral-movement      1/2            47%      T1570 Lateral Tool Transfer
command-control       1/2            35%      T1105 Ingress Tool Transfer
exfiltration          0/2             0%      T1041 Exfil Over C2 (prev 7)

prevalence-weighted overall: 36%
```

**The backlog writes itself:** phishing detection, a priv-esc rule,
exfil-over-C2 (beacon + volume anomaly). Prioritize by
`prevalence × (1 − current_coverage)`, not alphabetically. (Lab:
`step2_attack_coverage.py`.)

---

## Scenario 5 — SOAR playbook that made things worse

**What happened.** A phishing-response playbook auto-disabled any
account that clicked a flagged link. An attacker sent a "phishing" email
*to the CEO and 30 execs* with a benign-looking link, many clicked, the
playbook disabled 25 executive accounts during a board meeting.
Self-inflicted DoS.

**Fixes.**
- Reversible + low-blast-radius actions auto-run (pull the message,
  block the sender, enrich).
- Irreversible or high-blast-radius actions (disable account, isolate
  host) become a **one-click approval** for the analyst, never fully
  automatic.
- Rate-limit the playbook: "if this fires for >5 accounts in 10
  minutes, page a human instead of acting".
- Exec accounts (and service accounts, and prod hosts) are in a
  **protected set** the playbook can flag but not touch.

---

## A detection engineering repo layout

```
detections/
  windows/
    T1003.001_lsass_handle_access.yml      # Sigma
    T1218.011_rundll32_no_dll.yml
  identity/
    T1078_impossible_travel_plus_signal.yml
  tests/
    atomic_map.yml                          # detection -> Atomic Red Team test id
    benign_corpus/                          # sampled prod events per sourcetype
  ci/
    run_sigma_against_corpus.py             # every PR: must fire on attack, stay quiet on benign
  metrics/
    fp_rates.md                             # updated weekly, drives tune/retire decisions
```

Every rule PR: links an ATT&CK technique, includes a test that fires,
includes a benign sample it stays quiet on, and a named owner.
