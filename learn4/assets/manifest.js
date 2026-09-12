/* linux-hpc-security Learn — PART 4 (Security Hardening & Compliance Engineering at Scale).
 * Hub metadata only; chapter bodies load lazily from assets/ch/NN.js */
window.PART = {
  num: 4,
  kicker: 'Part 4',
  heroTitle: 'Security hardening &amp; compliance engineering at scale',
  heroSub: '16 chapters on running compliance and hardening as engineering, not paperwork: DISA STIG automation, CIS benchmarks ' +
    'as code, SELinux/AppArmor policy authoring, kernel hardening (lockdown mode), supply-chain security (SBOM, image signing), ' +
    'secrets management, security patching pipelines, intrusion detection (auditd/eBPF), file-integrity monitoring, ' +
    'privileged-access management, network micro-segmentation, vulnerability risk scoring, compliance-as-code (OpenSCAP), and ' +
    'red/blue team exercise design. Each in 5 levels ending in an <b>Interview drill</b>.',
  standardNote: 'Part 1 introduced hardening and STIGs at the single-host level. This part is about running compliance across a ' +
    'fleet — scan-and-remediate pipelines, policy authoring, and risk-scored patching — using the standard tooling (OpenSCAP, ' +
    'auditd, SELinux) a security-engineering team actually runs.',
  prev: { href: '../learn3/', label: 'Part 3 — HPC cluster orchestration at scale' },
  next: { href: '../learn5/', label: 'Part 5 — production systems operations' },
  chapters: [
    { num: 1, emoji: '📜', title: 'DISA STIG Automation at Fleet Scale', layer: 'Governance',
      tagline: 'Turning a 400-control STIG checklist into a scan-and-remediate pipeline that runs on every node, every night.',
      apps: ['an OpenSCAP-driven STIG remediation pipeline', 'triaging a false-positive STIG finding', 'a fleet-wide STIG compliance dashboard'] },
    { num: 2, emoji: '🧾', title: 'CIS Benchmarks as Code', layer: 'Governance',
      tagline: 'The CIS Benchmark as a versioned Ansible role, not a PDF nobody re-reads after the first audit.',
      apps: ['a CIS-benchmark Ansible role in CI', 'reconciling overlapping CIS vs STIG controls', 'a benchmark-drift alert on a hardened image'] },
    { num: 3, emoji: '🔐', title: 'SELinux & AppArmor Policy Authoring', layer: 'Security',
      tagline: 'Writing a policy that actually confines a service instead of "setenforce 0" — audit2allow, profiles, and the enforcing-mode fight.',
      apps: ['writing a custom SELinux policy module for an app', 'debugging an AVC denial in production', 'an AppArmor profile for a containerized service'] },
    { num: 4, emoji: '🧬', title: 'Kernel Hardening: Lockdown Mode & Security-Relevant sysctls', layer: 'Security',
      tagline: 'Kernel lockdown mode and the sysctl knobs that close the gap between "root" and "root that can load a rootkit".',
      apps: ['enabling lockdown mode on a hardened fleet', 'a hardening baseline for kernel.kptr_restrict and friends', 'the tradeoff of lockdown breaking a legitimate debug tool'] },
    { num: 5, emoji: '📦', title: 'Supply-Chain Security: SBOM & Image Signing', layer: 'Security',
      tagline: 'Knowing exactly what is in every image you ship, and cryptographically proving nobody tampered with it after the build.',
      apps: ['generating an SBOM in a CI pipeline', 'enforcing cosign-signed images at deploy time', 'responding to a CVE found via SBOM diffing'] },
    { num: 6, emoji: '🔑', title: 'Secrets Management at Scale', layer: 'Security',
      tagline: 'Vault/KMS-backed secrets with rotation and short-lived credentials — the opposite of a password in an environment variable.',
      apps: ['migrating a fleet off static secrets to Vault dynamic creds', 'a secret-rotation pipeline with zero downtime', 'auditing who read a secret and when'] },
    { num: 7, emoji: '🔁', title: 'Security Patching Pipelines', layer: 'Operations',
      tagline: 'Patching a CVE across 5,000 nodes without an outage — canary rings, live-patch-first triage, and a rollback plan.',
      apps: ['a canary-ring patch rollout for a kernel CVE', 'live-patch-first triage during a zero-day', 'a patch-compliance SLA dashboard'] },
    { num: 8, emoji: '🕵️', title: 'Intrusion Detection: auditd & eBPF-Based Sensors', layer: 'Security',
      tagline: 'auditd rules and eBPF sensors that catch a privilege-escalation attempt instead of just logging a syscall nobody reads.',
      apps: ['an auditd ruleset for privileged-command monitoring', 'an eBPF sensor for anomalous process ancestry', 'tuning detection rules to cut alert fatigue'] },
    { num: 9, emoji: '🧿', title: 'File Integrity Monitoring & Host-Based Intrusion Prevention', layer: 'Security',
      tagline: 'AIDE/Tripwire baselines and eBPF LSM hooks that catch a modified binary before it runs, not a week later during an audit.',
      apps: ['an AIDE baseline for a golden image', 'an eBPF LSM hook blocking an unsigned binary', 'investigating a file-integrity alert on a prod host'] },
    { num: 10, emoji: '🪪', title: 'Privileged Access Management & Just-in-Time Access', layer: 'Security',
      tagline: 'No standing root — just-in-time sudo grants, approval workflows, and a full audit trail for every privileged session.',
      apps: ['a JIT sudo-approval workflow', 'session recording for a privileged bastion', 'revoking standing access after a PAM rollout'] },
    { num: 11, emoji: '🧱', title: 'Network Segmentation & Micro-Segmentation for Bare Metal', layer: 'Security',
      tagline: 'VLANs and host firewalls are not enough — segmenting a bare-metal fleet so a compromised node cannot reach everything else.',
      apps: ['a micro-segmentation policy for a management network', 'nftables rules enforcing east-west segmentation', 'the "how far could a compromised node reach" tabletop'] },
    { num: 12, emoji: '📊', title: 'Vulnerability Management & Patch-Risk Scoring at Fleet Scale', layer: 'Governance',
      tagline: 'Ranking ten thousand CVE findings by real exploitability and blast radius instead of drowning in raw CVSS scores.',
      apps: ['a risk-scoring model combining CVSS + exposure + exploit availability', 'a vulnerability-scan-to-ticket pipeline', 'justifying why a "critical" CVE is patched last'] },
    { num: 13, emoji: '✅', title: 'Compliance-as-Code with OpenSCAP', layer: 'Governance',
      tagline: 'XCCDF/OVAL content that scans, scores, and generates a remediation report — compliance as a CI artifact, not a spreadsheet.',
      apps: ['an OpenSCAP scan in a pre-deploy CI gate', 'authoring a custom OVAL check', 'generating an auditor-ready compliance report'] },
    { num: 14, emoji: '🥷', title: 'Red Team / Blue Team Exercise Design', layer: 'Operations',
      tagline: 'Designing an exercise that actually tests detection and response, not just whether the red team can get a shell.',
      apps: ['scoping a purple-team exercise against a hardened fleet', 'designing detection-coverage metrics for an exercise', 'the after-action review that changes a runbook'] },
    { num: 15, emoji: '🚨', title: 'Case Study — Anatomy of a Fleet-Wide Compromise & Incident Response', layer: 'Case study',
      tagline: 'A real "lateral movement across the fleet" incident, read top to bottom: detection, containment, eradication, recovery.',
      apps: ['a lateral-movement kill-chain reconstruction', 'a containment decision under uncertainty', 'the post-incident writeup and control-gap analysis'] },
    { num: 16, emoji: '🗺️', title: 'Reference Architecture — The Compliance-as-Code Security Platform', layer: 'Case study',
      tagline: 'Every piece of this part assembled: STIG/CIS automation, hardening, supply chain, secrets, detection, PAM — one diagram.',
      apps: ['designing your org\'s compliance-as-code platform', 'a security-hardening platform RFC', 'the "walk me through your hardening pipeline" interview'] }
  ]
};
