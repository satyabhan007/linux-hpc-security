/* linux-hpc-security Learn — Part 4 · Chapter 12: Vulnerability Management & Patch-Risk Scoring at Fleet Scale */
window.CH[12] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A vulnerability scan comes back with ten thousand findings, sorted by raw CVSS score. The security team dutifully starts ' +
      'from the highest number and works down — and spends a month patching "critical" CVEs in a library that is never actually loaded ' +
      'at runtime, while an "important"-rated but actively-exploited-in-the-wild vulnerability in a public-facing service sits untouched ' +
      'for weeks. Raw CVSS score answers "how bad could this theoretically be", not "how much should I worry about it right now".</p>' +
      '<pre><code>Ten thousand findings, sorted by raw          →     Findings ranked by REAL risk: severity ×\n' +
      '  CVSS score, patched top-down                       exploitability × actual exposure/reachability</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Triaging a hospital ER by injury severity alone vs. by severity ' +
      'AND how quickly the patient is deteriorating.</b> A theoretically severe but stable condition can wait. A less severe-looking ' +
      'condition that is actively getting worse right now, in a patient standing at the door, needs attention first.</p></div>',
      try: [
        ['📖 FIRST — Common Vulnerability Scoring System (CVSS)', 'https://www.first.org/cvss/', 'o'],
        ['📖 FIRST — Exploit Prediction Scoring System (EPSS)', 'https://www.first.org/epss/', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A real risk-scoring model combines <b>CVSS</b> (theoretical severity) with <b>EPSS</b> (probability of real-world ' +
      'exploitation) and <b>exposure/reachability</b> (is the vulnerable code path actually loaded/reachable on THIS host) to produce ' +
      'a ranking that reflects actual risk rather than raw severity alone:</p>' +
      '<pre><code># pull CVSS + EPSS for a CVE and combine with local exposure context\n' +
      '$ curl -s "https://api.first.org/data/v1/epss?cve=CVE-2024-XXXXX" | jq \'.data[0].epss\'\n' +
      '0.94211        # ~94% probability of exploitation in the next 30 days — high, regardless of raw CVSS\n\n' +
      '# is CISA already tracking this as actively exploited? (an automatic priority escalator)\n' +
      '$ curl -s https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json \\\n' +
      '    | jq \'.vulnerabilities[] | select(.cveID=="CVE-2024-XXXXX")\'\n\n' +
      '# combine CVSS + EPSS + exposure (is the affected package actually loaded at runtime, internet-facing?)\n' +
      '# into a single risk score feeding the ticketing pipeline, e.g.:\n' +
      'risk_score = cvss_base * (0.5 + epss) * (2 if internet_facing else 1) * (1 if loaded_at_runtime else 0.1)</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard inputs are <b><code>CVSS</code></b> base score, ' +
      '<b><code>EPSS</code></b> (exploit probability), the <b>CISA Known Exploited Vulnerabilities (KEV)</b> catalog as a hard priority ' +
      'escalator, and internal exposure context (internet-facing vs. internal-only, actually loaded at runtime vs. installed-but-unused) ' +
      '— fed into a single risk score that drives the patching pipeline\'s (Ch 7) rollout speed and ticket priority.</p></div>',
      try: [
        ['📖 CISA — Known Exploited Vulnerabilities catalog', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'o'],
        ['📖 FIRST — EPSS documentation', 'https://www.first.org/epss/model', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Explaining why a "critical" CVE is patched last.</b> An ' +
      'executive asks why a CVSS 9.8 finding sat unpatched for three weeks while a CVSS 6.5 finding got fixed same-day. The honest ' +
      'answer: the 9.8 was in a library loaded only by an internal batch job with no network exposure and no known exploit activity, ' +
      'while the 6.5 was in an internet-facing service and had just been added to the CISA KEV catalog. Fix: have this exact ' +
      'justification — in writing, tied to the risk-scoring model — ready before the question is asked, not improvised afterward.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The vulnerability-scan-to-ticket pipeline that created a ' +
      'ticket graveyard.</b> A scanner auto-files a ticket for every finding regardless of score, and the backlog grows to thousands of ' +
      'open tickets nobody will ever action — so the few genuinely urgent ones are invisible in the noise. Fix: the pipeline should only ' +
      'auto-file tickets above a risk threshold, with everything else tracked in an aggregate dashboard instead of individual tickets — ' +
      'a ticket queue is a to-do list, not an archive.</p></div>' +
      '<p><b>Exposure context changes over time — re-score, don\'t just re-scan:</b> a vulnerable package with no network exposure today ' +
      'can become internet-facing next month after an architecture change; risk scores need to be refreshed, not computed once and frozen.</p>',
      try: [
        ['📖 NIST — National Vulnerability Database', 'https://nvd.nist.gov/', 'o'],
        ['🛡️ Ch 7 — security patching pipelines', '#ch7', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Findings triaged purely by raw CVSS base    Combine CVSS with EPSS (exploit probability), CISA KEV status, and\n' +
      '  score, top-down                              real exposure/reachability into one composite risk score.\n' +
      'A ticket auto-filed for every single         Auto-file tickets only above a risk threshold; track lower-risk\n' +
      '  scan finding regardless of severity           findings in an aggregate dashboard, not an unactionable ticket queue.\n' +
      'Risk score computed once and never            Re-score periodically — exposure context (internet-facing, actually\n' +
      '  refreshed as context changes                  loaded) changes as architecture and deployments change over time.\n' +
      'No justification prepared for why a          Document the risk-scoring rationale per finding BEFORE leadership\n' +
      '  "critical" CVE was patched later              asks — "it scored low on exposure/exploitability" is a real answer, not an excuse.\n' +
      'CISA KEV-listed CVEs treated the same as     Treat active KEV listing as a hard priority escalator overriding normal\n' +
      '  any other finding at the same CVSS score      queue order — active real-world exploitation changes urgency.\n' +
      'Vulnerability scanning and patching           Feed risk scores directly into the patching pipeline\'s (Ch 7) rollout\n' +
      '  pipelines run as separate, disconnected systems   speed and ring cadence — don\'t hand-translate score into action.</code></pre>' +
      '<p><b>The real test:</b> for your current top 5 open findings, can you state — in one sentence each — WHY they outrank the ' +
      'thousands of lower-priority findings, using exposure and exploitability, not just the raw severity number?</p>',
      try: [
        ['📖 FIRST — CVSS v4.0 specification', 'https://www.first.org/cvss/v4-0/', 'o'],
        ['🛡️ Ch 5 — supply-chain security: SBOM & image signing', '#ch5', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, vulnerability management is a resource-allocation problem under uncertainty: with finite patching capacity ' +
      'and thousands of findings, the goal is to spend that capacity where it reduces the most REAL risk, not where it moves the most ' +
      'raw CVSS points. Real risk is a function of severity, actual exploitation probability, and actual exposure on THIS specific ' +
      'fleet — three inputs that are each individually necessary and, together, sufficient to separate "theoretically bad" from ' +
      '"urgently dangerous right now".</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is sorting vulnerability findings by raw CVSS score alone an inadequate triage strategy at scale?\n' +
      'A: CVSS measures theoretical severity assuming worst-case exploitability and exposure — it says\n' +
      '   nothing about whether the vulnerable code path is actually reachable/loaded on a given host, or\n' +
      '   whether real-world exploitation is actually occurring, both of which drive real-world risk.\n\n' +
      'Q: What does EPSS add on top of a CVSS score, and why does it matter for prioritization?\n' +
      'A: EPSS estimates the PROBABILITY a vulnerability will actually be exploited in the near term — a\n' +
      '   high-CVSS, low-EPSS finding can reasonably wait behind a lower-CVSS, high-EPSS finding that is far\n' +
      "   more likely to be used against you soon.\n\n" +
      'Q: Why should CISA KEV (Known Exploited Vulnerabilities) listing act as a hard priority escalator?\n' +
      'A: KEV listing means active, real-world exploitation has already been observed — this is no longer a\n' +
      '   theoretical risk assessment, it is confirmed attacker activity, which should override normal\n' +
      '   severity-based queue ordering.\n\n' +
      'Q: An executive asks why a CVSS 9.8 finding was patched after a CVSS 6.5 finding. What is a defensible\n' +
      '   answer?\n' +
      'A: The 9.8 had no real exposure (e.g. an unreachable code path, internal-only, no known exploit\n' +
      "   activity) while the 6.5 was internet-facing and actively exploited (e.g. KEV-listed) — the\n" +
      '   composite risk score, not raw CVSS, drove the correct prioritization.\n\n' +
      'Q: Why must risk scores be periodically refreshed rather than computed once at scan time?\n' +
      'A: Exposure context changes — a package with no network exposure today can become internet-facing\n' +
      '   after an architecture change next month, and EPSS/KEV status itself changes as real-world\n' +
      '   exploitation trends evolve.</code></pre>',
      try: [
        ['📖 CISA — Stakeholder-Specific Vulnerability Categorization (SSVC)', 'https://www.cisa.gov/stakeholder-specific-vulnerability-categorization-ssvc', 'o'],
        ['🛡️ Ch 13 — compliance-as-code with OpenSCAP', '#ch13', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is sorting vulnerability findings purely by raw CVSS base score an inadequate triage strategy at fleet scale?',
      opts: [
        'CVSS scores are frequently miscalculated by scanning tools',
        'CVSS measures theoretical worst-case severity and says nothing about whether the vulnerable code is actually reachable, loaded, or being exploited in the real world',
        'CVSS scores only apply to web applications, not infrastructure',
        'Raw CVSS score is always identical to the correct priority ranking'],
      ok: 1,
      why: 'Real risk requires combining severity with actual exploitability (EPSS) and actual exposure/reachability on the specific host — not raw theoretical severity alone.' },
    { q: 'Why should CISA KEV (Known Exploited Vulnerabilities) catalog listing act as a hard priority escalator in a risk-scoring model?',
      opts: [
        'KEV listing has no bearing on real-world risk',
        'KEV listing confirms active, real-world exploitation is already occurring, which should override normal severity-based queue ordering',
        'KEV-listed CVEs are always lower severity than non-listed ones',
        'KEV listing is purely a regulatory formality with no security implication'],
      ok: 1,
      why: 'KEV listing moves a vulnerability from theoretical risk to confirmed active exploitation, which is a much stronger signal for urgency than CVSS alone.' },
    { q: 'Why must vulnerability risk scores be periodically refreshed rather than calculated once at initial scan time?',
      opts: [
        'CVSS scores change automatically every 90 days by design',
        'Exposure context (e.g. whether a package becomes internet-facing after an architecture change) and exploitation trends (EPSS, KEV status) change over time',
        'Refreshing scores is only required for compliance audits, not real risk management',
        'Scanning tools require re-scoring to function correctly'],
      ok: 1,
      why: 'A finding\'s real risk depends on exposure and real-world exploitation activity, both of which can change well after the original scan — a frozen score goes stale.' }
  ]
};
