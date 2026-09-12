/* linux-hpc-security Learn — Part 4 · Chapter 9: File Integrity Monitoring & Host-Based Intrusion Prevention */
window.CH[9] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A quarterly audit runs a checksum comparison against a golden image and discovers <code>/usr/bin/ssh</code> was quietly ' +
      'replaced with a trojanized binary — three months ago. The backdoor has been harvesting credentials the entire time. Finding a ' +
      'tampered binary a week (or a quarter) later during a scheduled audit is not detection; it is an autopsy.</p>' +
      '<pre><code>Checksum comparison run quarterly during     →     Continuous, real-time integrity monitoring +\n' +
      '  a scheduled audit (finds tampering months late)     an in-kernel hook that blocks the tampered\n' +
      '                                                       binary from ever executing in the first place</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A tamper-evident seal you check once a quarter vs. a lock that ' +
      'physically will not open for the wrong key.</b> Checking a seal after the fact tells you a break-in happened. A lock that refuses ' +
      'the wrong key stops the break-in from succeeding at all.</p></div>',
      try: [
        ['📖 AIDE — Advanced Intrusion Detection Environment', 'https://aide.github.io/', 'o'],
        ['📖 eBPF.io — LSM hooks with eBPF', 'https://ebpf.io/what-is-ebpf/#ebpf-hook-overview', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>AIDE</b> (or Tripwire) builds a cryptographic-hash baseline of a filesystem\'s critical paths and reports any change on a ' +
      'schedule; a modern <b>eBPF LSM hook</b> goes further and can block execution of a binary that fails an integrity/signature check ' +
      'in real time, before it ever runs:</p>' +
      '<pre><code># initialize an AIDE baseline on a golden image, then check for drift on a schedule\n' +
      '$ aide --init && mv /var/lib/aide/aide.db.new.gz /var/lib/aide/aide.db.gz\n' +
      '$ aide --check                              # run via cron/systemd timer, alert on any diff\n\n' +
      '# aide.conf: scope monitoring to security-critical paths, not the whole filesystem\n' +
      '/usr/bin   NORMAL\n' +
      '/usr/sbin  NORMAL\n' +
      '/etc       NORMAL-EXCLUDE_LOGS\n\n' +
      '# an eBPF LSM program (conceptual) attached to bprm_check_security, blocking exec\n' +
      '# of any binary whose hash is not on an allowlist — enforced in-kernel, before exec completes\n' +
      '$ bpftool prog load exec_guard.o /sys/fs/bpf/exec_guard type lsm</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard baseline is <b><code>AIDE</code></b> with a ' +
      'baseline built at image-provisioning time (stored off-host, read-only), scanning security-critical paths on a schedule tight ' +
      'enough to matter (hourly, not quarterly), paired where available with an <b>eBPF LSM</b>-based enforcement layer for real-time ' +
      'prevention rather than after-the-fact detection alone.</p></div>',
      try: [
        ['📖 AIDE — manual', 'https://aide.github.io/doc/manual.html', 'o'],
        ['📖 Kernel.org — LSM (Linux Security Modules) & eBPF', 'https://docs.kernel.org/bpf/prog_lsm.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The AIDE baseline that included the attacker\'s persistence.</b> ' +
      'A team initializes an AIDE baseline AFTER a host has already been compromised (unknowingly) — the backdoor is now "normal" as far ' +
      'as the baseline is concerned, and it never gets flagged. Fix: baselines must be built from a known-good, freshly provisioned ' +
      'image BEFORE the host ever takes production traffic, and stored somewhere the host itself cannot modify (write-once, off-host, ' +
      'or on read-only media) — a baseline the compromised host can rewrite is not a baseline.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A file-integrity alert during a legitimate patch window.</b> ' +
      'A routine security patch changes hundreds of binaries under <code>/usr/bin</code> in one run, and the resulting flood of AIDE ' +
      'alerts looks identical to a mass-compromise event — the on-call engineer has thirty seconds to decide which it is. Fix: integrate ' +
      'the integrity-monitoring pipeline with the patching pipeline (Ch 7) so expected changes are pre-registered and suppressed, leaving ' +
      'only genuinely unexpected changes to alert on.</p></div>' +
      '<p><b>Detection without response is half a system:</b> an AIDE alert that lands in an inbox nobody checks on weekends is barely ' +
      'better than no monitoring — the alert needs a defined, tested response runbook, not just a delivery mechanism.</p>',
      try: [
        ['📖 NIST — file integrity monitoring guidance context', 'https://csrc.nist.gov/glossary/term/file_integrity_monitoring', 'o'],
        ['🛡️ Ch 7 — security patching pipelines', '#ch7', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'File-integrity check run quarterly as       Run continuously (hourly or better) on a schedule tight enough that\n' +
      '  part of a scheduled audit                   compromise is caught in hours, not months.\n' +
      'Baseline built AFTER a host is already in    Build the baseline from a known-good image BEFORE production traffic,\n' +
      '  production (possibly already compromised)    and store it off-host / read-only so the monitored host can\'t rewrite it.\n' +
      'Integrity alerts treated identically          Integrate with the patching pipeline so expected changes are\n' +
      '  regardless of whether a patch just ran        pre-registered/suppressed — leaving only unexpected changes to triage.\n' +
      'Detection alert delivered with no defined     Pair every integrity/HIPS alert with a tested response runbook —\n' +
      '  response runbook                              detection without response is a false sense of security.\n' +
      'Monitoring the entire filesystem including    Scope monitoring to security-critical paths (binaries, configs,\n' +
      '  high-churn, low-value paths (e.g. /tmp, logs)  auth files) — over-broad scope buries real alerts in noise.\n' +
      'Prevention (eBPF LSM enforcement) treated as  Layer detection AND prevention — an LSM hook blocking an unsigned\n' +
      '  a replacement for detection, or vice versa    binary complements, but does not replace, a tamper-evident audit trail.</code></pre>' +
      '<p><b>The real test:</b> if an attacker replaced one binary under <code>/usr/sbin</code> right now, how many minutes until a ' +
      'human is paged with that specific fact — and does a runbook already exist for what they do next?</p>',
      try: [
        ['📖 CIS — file integrity monitoring control references', 'https://www.cisecurity.org/controls', 'o'],
        ['🛡️ Ch 8 — intrusion detection: auditd & eBPF-based sensors', '#ch8', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, file integrity monitoring and host-based intrusion prevention sit at opposite ends of the same defense: ' +
      'FIM is a <b>tamper-evident record</b> — it proves something changed and roughly when — while an eBPF LSM-based HIPS layer is ' +
      '<b>tamper-preventive</b> — it stops the change (or the execution) from happening at all. A mature program does not choose one; ' +
      'prevention fails sometimes, and when it does, the audit trail from FIM is what lets you reconstruct exactly what happened.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why does building an AIDE baseline on a host that may already be compromised defeat the purpose\n' +
      '   of file integrity monitoring?\n' +
      "A: The baseline records whatever state exists at init time as \"normal\" — if a backdoor is already\n" +
      '   present, it becomes part of the trusted baseline and will never trigger an alert. Baselines must be\n' +
      '   built from a known-good image before the host takes production traffic.\n\n' +
      'Q: Why must an AIDE baseline database be stored off-host or read-only?\n' +
      'A: If a compromised host can modify its own baseline, an attacker can update the baseline to match\n' +
      '   their tampered files, silently erasing the evidence of the change.\n\n' +
      'Q: A security patch changes hundreds of files and floods the FIM alert queue. How should this be\n' +
      '   handled architecturally?\n' +
      'A: Integrate FIM with the patching pipeline so expected changes from a known, scheduled patch run are\n' +
      '   pre-registered and suppressed, leaving only genuinely unexpected changes to actually alert on.\n\n' +
      'Q: How do eBPF LSM-based prevention and traditional FIM complement each other rather than duplicate?\n' +
      'A: LSM-based prevention blocks a tampered/unsigned binary from executing at all (preventive); FIM\n' +
      '   provides the tamper-evident record for forensics when prevention is bypassed or does not cover a\n' +
      '   given path — one stops the attack, the other proves what happened when it does not.\n\n' +
      'Q: Why is a file-integrity alert with no defined response runbook nearly as bad as no monitoring at all?\n' +
      'A: Detection without a tested response path means the alert may sit unactioned (especially outside\n' +
      '   business hours), giving a false sense of security while providing no real reduction in dwell time.</code></pre>',
      try: [
        ['📖 AIDE — GitHub project & documentation', 'https://github.com/aide/aide', 'o'],
        ['🛡️ Ch 15 — case study: anatomy of a fleet-wide compromise', '#ch15', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why does initializing an AIDE baseline on a host that might already be compromised defeat the purpose of file integrity monitoring?',
      opts: [
        'AIDE cannot run on a compromised host at all',
        'Whatever state exists at baseline-init time becomes "normal," so an existing backdoor is baked into the baseline and will never trigger an alert',
        'AIDE only detects network-based compromises, not file tampering',
        'The baseline automatically expires after 24 hours regardless of host state'],
      ok: 1,
      why: 'A baseline must be built from a known-good state before production traffic; otherwise, existing tampering is recorded as the trusted normal state.' },
    { q: 'Why should an AIDE baseline database be stored off-host or on read-only media rather than on the monitored host itself?',
      opts: [
        'It has no real security benefit, only a performance benefit',
        'A compromised host with write access to its own baseline could update the baseline to match tampered files, erasing the evidence of the change',
        'AIDE requires read-only storage to function technically',
        'On-host storage is always faster and therefore always incorrect'],
      ok: 1,
      why: 'If the monitored host can rewrite its own integrity baseline, an attacker with sufficient access can hide their tampering by updating the baseline to match.' },
    { q: 'How should a file-integrity monitoring pipeline handle the mass file changes caused by a legitimate security patch rollout?',
      opts: [
        'Disable FIM entirely during any patch window',
        'Integrate FIM with the patching pipeline so expected changes are pre-registered and suppressed, leaving only unexpected changes to alert on',
        'Treat every patch-caused change identically to a suspected compromise with no distinction',
        'Increase the alert threshold permanently so patches never trigger alerts again'],
      ok: 1,
      why: 'Coordinating expected changes with the patching pipeline prevents alert fatigue while preserving sensitivity to genuinely unexpected tampering.' }
  ]
};
