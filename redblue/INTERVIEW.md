# Red / Blue / Purple Teaming — Interview Q&A

---

## Definitions

**Q: Red team vs penetration test?**
A pentest enumerates and validates vulnerabilities in a scoped target
over a fixed window. A red team emulates a full adversary campaign
(objectives, stealth, ROE) to test whether detection and response
actually work against a thinking opponent — the deliverable is dwell
time and detection gaps, not a bug list.

**Q: What is a purple team?**
Not a third team — the collaborative loop where red executes known
ATT&CK techniques openly and blue measures which fired an alert and how
fast, producing a ranked gap list that drives new detections, repeated
continuously.

**Q: Blue team — what's in scope?**
SOC/triage, detection engineering, threat hunting, incident response,
forensics, and the hardening/architecture that reduces attack surface.

**Q: What are Rules of Engagement (ROE)?**
The contract for a red-team engagement: scope (in/out), objectives,
allowed and prohibited techniques, time windows/blackouts, a
deconfliction process, data-handling rules, and reporting requirements.

**Q: What is deconfliction?**
A pre-agreed channel and process so that if the blue team sees
suspicious activity, they can quickly confirm whether it's the red team
or a real intrusion — and so red pauses if a real incident is suspected.

---

## Kill chain / ATT&CK

**Q: Name the phases of the intrusion lifecycle.**
Recon, initial access, execution, persistence, privilege escalation,
defense evasion, credential access, discovery, lateral movement,
collection, command & control, exfiltration, impact (ATT&CK tactics;
Lockheed Martin's Cyber Kill Chain is a coarser 7-step version).

**Q: Why does the detection *stage* matter more than the detection
*count*?**
The chain is ordered. Catching execution neutralizes the whole
operation; catching exfiltration means the damage is done. Coverage
should be measured by earliest-detectable stage and by **dwell time**
(stages completed before the first actioned alert), not by number of
rules.

**Q: Tactic vs technique vs procedure?**
Tactic = adversary goal (Persistence). Technique = method (T1053
Scheduled Task). Procedure = the specific implementation a given actor
uses.

**Q: What is MITRE D3FEND?**
A knowledge graph of defensive countermeasures (harden, detect, isolate,
deceive, evict) mapped to the ATT&CK techniques they counter.

**Q: What is the "Pyramid of Pain" and how does it guide red/blue?**
Ranks indicators by how painful they are for the adversary to change:
hashes/IPs/domains (trivial) up to TTPs (very hard). Blue should build
TTP-level detections; red assumes IOC-level defenses are cheap to
bypass.

---

## Lateral movement / AD

**Q: How is lateral movement modeled as a graph?**
Nodes = hosts + identities; directed edges = "attacker on A can reach B"
via a cached credential, local admin right, service-account token, or AD
trust/delegation. Shortest path from foothold to a Tier-0 asset is the
attack path.

**Q: What does BloodHound compute, and how do defenders use it?**
It finds attack paths (e.g. shortest path from Domain Users to Domain
Admin) through AD ACLs, group memberships, sessions, and delegations.
Defenders run it themselves and test which control (tiering, LAPS,
gMSA, removing unconstrained delegation) severs or lengthens the most
short paths.

**Q: Common AD attack-path findings?**
Kerberoastable service accounts in privileged groups; help-desk local
admin everywhere + DAs logging into workstations; unconstrained
delegation; shared local admin passwords; DCSync rights granted to the
wrong principal; ADCS misconfigurations (ESC1–ESC8).

**Q: Pass-the-Hash vs Pass-the-Ticket vs Kerberoasting vs
DCSync?**
PtH: reuse an NTLM hash to authenticate without the password.
PtT: reuse/forge a Kerberos ticket (incl. Golden/Silver tickets).
Kerberoasting: request service tickets for SPNs and crack them offline
for the service account password. DCSync: abuse replication rights to
pull password hashes from a DC as if you were another DC.

**Q: What is the tiered admin model?**
Tier 0 (identity/DCs/ADCS), Tier 1 (servers/apps), Tier 2
(workstations). Credentials and admin sessions never cross tiers
downward-then-up; Tier 0 admin only from dedicated Privileged Access
Workstations. It breaks the "one workstation compromise → DA" path.

---

## Detection engineering (blue)

**Q: What are LOLBins / LOLBAS and why do red teams love them?**
Living-off-the-land binaries — signed, built-in OS tools (`certutil`,
`rundll32`, `regsvr32`, `mshta`, `wmic`, `bitsadmin`, PowerShell) used
for download/execute/persist. AV won't flag a Microsoft-signed binary,
so detection must be **behavioral** (unusual args, unusual parent,
network from a tool that shouldn't).

**Q: How do you detect C2 / beaconing?**
Combine weak signals (ideal RBA case): regular inter-arrival timing to
one destination (after removing jitter), TLS JA3/JA4 matching a known
framework, low request/response size ratio on a long-lived connection,
newly-registered/low-reputation domains, high-entropy DNS subdomains,
UA/header anomalies.

**Q: What telemetry do you most want on Windows endpoints for
detection?**
Sysmon (process creation with command line + hashes + parent, network
connections, image loads, registry, WMI), PowerShell script-block
logging, Windows Security event log (4624/4625/4672/4688/4698/5145),
and EDR process/behavior events.

**Q: Atomic Red Team vs Caldera?**
Atomic Red Team: a library of small, per-technique tests you run
manually/scripted to check a detection. Caldera: an automated adversary
-emulation platform that chains techniques into full operations with an
agent and planner.

---

## Program

**Q: Describe the purple-team feedback loop and how you measure it.**
Red runs a fixed technique set openly on a schedule; blue records
detected? and MTTD per technique; score coverage (plain and prevalence
-weighted) and MTTD; build a detection for the highest-prevalence gap;
re-run to confirm improvement; repeat. Success = the weighted-coverage
curve rising and MTTD falling.

**Q: "Assume breach" — what does it change about strategy?**
You stop over-investing in a perfect perimeter and invest in the
detection, segmentation, least-privilege, and response that determine
whether an inevitable foothold becomes a major incident.

**Q: An engagement got to Domain Admin in 3 days and you detected them
on day 5. What's the honest conclusion?**
Prevention had gaps (the fast path to DA), but the bigger failure is
**response**: 5 days of dwell, and likely alerts that fired early and
were closed or under-prioritized. Fix the highest-value attack path
*and* the triage/enrichment that let the early alerts be dismissed.

**Q: How do you prioritize the gap list from a purple exercise?**
By `prevalence × (1 − current_coverage)` — close the biggest weighted
gap first. Closing a high-prevalence gap moves the weighted coverage
number far more than closing a rare one.

**Q: What deliverables should a red-team engagement produce?**
The attack narrative (stage by stage), dwell time to first detection and
to first *actioned* alert, the specific detection and process gaps, an
AD attack-path analysis, and a prioritized remediation plan — plus a
debrief with the blue team.
