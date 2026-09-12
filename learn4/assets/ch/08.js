/* linux-hpc-security Learn — Part 4 · Chapter 8: Intrusion Detection — auditd & eBPF-Based Sensors */
window.CH[8] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Every syscall on the box is technically "logged" if you enable full auditd tracing — and now the log fills the disk in an ' +
      'hour and nobody reads any of it, because there is no way to find the one privilege-escalation attempt buried in ten million ' +
      'routine <code>read()</code> calls. Logging everything is not the same as detecting anything; it is often the opposite, because ' +
      'the signal drowns.</p>' +
      '<pre><code>Log every syscall, hope someone notices    →    Watch specific, meaningful actions (privileged\n' +
      '  the bad one in the flood                          commands, process ancestry) and alert on THOSE</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A security camera recording every second of an empty parking ' +
      'lot vs. a motion sensor tuned to the loading dock.</b> Both technically "watch" the property. Only one of them actually tells a ' +
      'guard something happened worth looking at, in time to act on it.</p></div>',
      try: [
        ['📖 Linux Audit Framework — documentation', 'https://github.com/linux-audit/audit-documentation', 'o'],
        ['📖 eBPF.io — what is eBPF', 'https://ebpf.io/what-is-ebpf/', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>auditd</b> watches specific syscalls, files, and command executions via rules loaded into the kernel audit subsystem; ' +
      '<b>eBPF-based sensors</b> (Falco and similar) go further, inspecting process ancestry and runtime behavior in-kernel with much ' +
      'lower overhead than tracing everything:</p>' +
      '<pre><code># auditd rule: alert on any execution of a privileged command, tagged for easy searching\n' +
      '$ auditctl -a always,exit -F arch=b64 -S execve -F path=/usr/bin/sudo -F key=priv_cmd\n' +
      '$ auditctl -w /etc/shadow -p wa -k shadow_write     # watch a sensitive file for write/attribute changes\n\n' +
      '# search collected events by the tag defined above\n' +
      '$ ausearch -k priv_cmd -ts today\n\n' +
      '# an eBPF rule (Falco syntax) flagging an unexpected shell spawned inside a container\n' +
      '- rule: Shell spawned in container\n' +
      '  condition: spawned_process and container and proc.name in (bash, sh, zsh)\n' +
      '  output: "Shell in container (user=%user.name container=%container.name cmd=%proc.cmdline)"\n' +
      '  priority: WARNING</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard baseline is a <b>DISA STIG-derived ' +
      '<code>audit.rules</code></b> file (privileged command execution, sensitive file access, auth events) loaded via ' +
      '<b><code>auditctl</code></b>/<code>augenrules</code>, aggregated centrally, plus <b><code>Falco</code></b> (or a similar ' +
      'eBPF-based runtime sensor) for behavioral detections that syscall-only auditing misses, such as anomalous process ancestry.</p></div>',
      try: [
        ['📖 Falco — runtime security project', 'https://falco.org/docs/', 'o'],
        ['📖 Linux man-pages — auditctl', 'https://man7.org/linux/man-pages/man8/auditctl.8.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The auditd ruleset nobody could afford to run.</b> A ' +
      'well-intentioned team enables watch rules on every file under <code>/etc</code> plus every <code>execve</code> — disk fills with ' +
      'audit logs in hours and the box itself becomes noticeably slower under load. Fix: scope rules to what actually matters for the ' +
      'threat model (privileged commands, specific sensitive paths, auth events) — auditd rule count is a budget, not a wishlist, and ' +
      'over-collection is a self-inflicted denial-of-service.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Alert fatigue killed a real detection.</b> A tuned eBPF ' +
      'ruleset fires two hundred "shell spawned in container" warnings a day because a legitimate debugging workflow triggers it ' +
      'constantly — the on-call team starts auto-dismissing the rule, and misses the one time it fired because of an actual reverse ' +
      'shell. Fix: tune detection rules against real baseline traffic BEFORE they ship (allowlist known-legitimate patterns explicitly) ' +
      'rather than shipping broad rules and letting humans learn to ignore them.</p></div>' +
      '<p><b>A syscall log nobody queries during an incident is not a detection system:</b> the test of a ruleset is whether it can ' +
      'answer "did this happen, and when" in under a minute during a live investigation — not whether it technically captured the event.</p>',
      try: [
        ['📖 MITRE ATT&CK — technique-informed detection rules', 'https://attack.mitre.org/', 'o'],
        ['🛡️ Ch 9 — file integrity monitoring & host-based intrusion prevention', '#ch9', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'auditd rules watch everything (every        Scope rules to the specific actions your threat model cares about —\n' +
      '  execve, every file under /etc)               privileged commands, sensitive paths, auth events, not everything.\n' +
      'eBPF/Falco rules shipped untested against    Tune against real baseline traffic first; explicitly allowlist known-\n' +
      '  real traffic, generating high false-positive rate   legitimate patterns before the rule reaches production.\n' +
      'Alert volume so high the team starts          Treat rising false-positive rate as a bug in the rule to fix, not a\n' +
      '  auto-dismissing a specific alert type         cost of doing business — a dismissed rule stops detecting anything.\n' +
      'Audit logs sit on individual hosts,           Centralize aggregation so a fleet-wide pattern (same technique across\n' +
      '  never aggregated fleet-wide                  many hosts) is visible, not scattered across 5,000 local log files.\n' +
      'Detection rules never mapped to a known        Write rules against a framework (e.g. MITRE ATT&CK) so coverage gaps\n' +
      '  attacker technique or framework               are visible, instead of an ad hoc pile of rules of unclear intent.\n' +
      'No test of whether a rule can actually be     Regularly run a detection against a KNOWN test event and confirm\n' +
      '  found/queried fast during a live incident     it surfaces in under a minute — untested detections often silently rot.</code></pre>' +
      '<p><b>The real test:</b> pick one rule in your ruleset at random. Do you know which specific attacker technique it is meant to ' +
      'catch, and could you prove it fires by triggering a benign, controlled test of that exact behavior?</p>',
      try: [
        ['📖 MITRE ATT&CK — Linux techniques', 'https://attack.mitre.org/matrices/enterprise/linux/', 'o'],
        ['🛡️ Ch 14 — red team / blue team exercise design', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, intrusion detection is a signal-to-noise engineering problem before it is a coverage problem: a ruleset ' +
      'that catches every known attacker technique but generates so much noise that analysts stop reading it has effectively zero ' +
      'detection value. auditd (syscall/file-level, kernel audit subsystem) and eBPF sensors (behavioral, process-ancestry-aware, lower ' +
      'overhead) are complementary — auditd gives an authoritative, tamper-evident record for forensics; eBPF gives faster, ' +
      'context-rich behavioral alerts for real-time response.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is logging every syscall on a host worse, from a detection standpoint, than logging a scoped\n' +
      '   set of specific actions?\n' +
      'A: Over-collection drowns the meaningful signal in volume, can fill disk/degrade performance, and\n' +
      "   makes it practically impossible to find the one relevant event during an incident — detection\n" +
      '   value comes from scoping rules to the threat model, not from capturing everything.\n\n' +
      'Q: What is the risk of shipping an eBPF/Falco rule straight to production without tuning against real\n' +
      '   traffic first?\n' +
      'A: High false-positive rates from legitimate workflows train the on-call team to dismiss that alert\n' +
      '   type, so when it fires on an actual compromise, it gets ignored along with the noise.\n\n' +
      'Q: Why aggregate audit logs centrally instead of leaving them on individual hosts?\n' +
      'A: A fleet-wide attack pattern (the same technique used across many hosts, e.g. lateral movement) is\n' +
      '   only visible when logs are correlated centrally — scattered per-host logs hide the pattern.\n\n' +
      'Q: What does mapping detection rules to a framework like MITRE ATT&CK actually buy you?\n' +
      'A: Visibility into coverage gaps — you can see which known attacker techniques have NO corresponding\n' +
      '   rule, instead of having an ad hoc pile of rules of unclear origin and unclear intent.\n\n' +
      'Q: How do auditd and eBPF-based sensors complement rather than duplicate each other?\n' +
      'A: auditd provides an authoritative, kernel-level, tamper-evident record useful for forensics; eBPF\n' +
      '   sensors provide faster, richer behavioral context (process ancestry, container context) for\n' +
      '   real-time alerting — one is the system of record, the other is the early-warning system.</code></pre>',
      try: [
        ['📖 Falco — rules reference', 'https://falco.org/docs/reference/rules/', 'o'],
        ['🛡️ Ch 15 — case study: anatomy of a fleet-wide compromise', '#ch15', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is enabling auditd rules to log every syscall on a host generally a worse detection strategy than scoping rules to specific actions?',
      opts: [
        'auditd cannot technically log every syscall',
        'Over-collection drowns meaningful signal in volume, can fill disk and degrade performance, and makes finding the relevant event during an incident nearly impossible',
        'Logging every syscall is illegal under most compliance frameworks',
        'It has no downsides and is always the correct approach'],
      ok: 1,
      why: 'Detection value comes from scoping collection to what the threat model cares about, not from maximizing raw volume of collected data.' },
    { q: 'A tuned eBPF-based detection rule generates 200 false-positive alerts a day due to a legitimate workflow. What is the real risk?',
      opts: [
        'The eBPF sensor will crash under the alert volume',
        'The on-call team will start dismissing that alert type, causing a real compromise triggering the same rule to be missed or ignored',
        'There is no risk — more alerts always improve security posture',
        'The rule will automatically disable itself after too many false positives'],
      ok: 1,
      why: 'Alert fatigue trains responders to ignore a noisy rule, which destroys its detection value exactly when it matters — during a real attack.' },
    { q: 'What is the benefit of mapping intrusion-detection rules to a framework like MITRE ATT&CK?',
      opts: [
        'It is required by auditd to function correctly',
        'It makes detection coverage gaps visible — you can see which known attacker techniques have no corresponding rule, instead of an ad hoc, unclear rule set',
        'It automatically generates eBPF rule syntax',
        'It eliminates the need for centralized log aggregation'],
      ok: 1,
      why: 'Framework mapping turns a rule set into a measurable coverage map against known attacker techniques rather than an unstructured collection of unclear origin.' }
  ]
};
