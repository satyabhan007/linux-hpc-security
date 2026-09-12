/* linux-hpc-security Learn — Part 5 · Chapter 13: SOC/NOC Operational Patterns: Triage, Handoff & Command */
window.CH[13] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A <b>SOC</b> (Security Operations Center) watches for attacks; a <b>NOC</b> (Network Operations Center) watches for outages. Both ' +
      'drown in the same problem at scale: hundreds of alerts an hour, a shift change every eight hours, and an incident that started on the ' +
      'previous shift that the next shift needs to pick up without losing context. <b>SOC/NOC operational patterns</b> are the triage rules and ' +
      'handoff discipline that keep either team functional under that load.</p>' +
      '<pre><code>Alerts triaged by whoever looks first  →  alerts triaged by a priority queue mapped to impact/severity\n' +
      '  (random order, easy to miss the real one)   (the real threat/outage surfaces first, reliably)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An air-traffic control shift handoff vs. a casual "see ya, good luck".</b> ' +
      'ATC handoffs follow a strict script — every aircraft, altitude, and open issue is explicitly transferred — because an ambiguous handoff at ' +
      '35,000 feet is not an acceptable risk. A SOC/NOC handoff needs the same rigor for the incidents in flight.</p></div>',
      try: [
        ['📖 MITRE ATT&CK — framework overview', 'https://attack.mitre.org/', 'o'],
        ['📡 Ch 8 — alerting design: paging, escalation & noise reduction', '#ch8', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>SOC triage commonly maps alerts to the <b>MITRE ATT&CK</b> framework — tagging what tactic/technique an alert corresponds to lets a ' +
      'triage queue prioritize by kill-chain stage (e.g. active exfiltration outranks a single failed login) rather than raw alert volume. NOC ' +
      'triage similarly prioritizes by blast radius and SLO impact (Ch 7), not just alert count.</p>' +
      '<pre><code># Splunk SPL: a SOC triage queue ranked by ATT&CK-mapped severity, not just alert count\n' +
      'index=security\n' +
      '| eval priority=case(\n' +
      '    attack_tactic="exfiltration", 1,\n' +
      '    attack_tactic="lateral-movement", 2,\n' +
      '    attack_tactic="credential-access", 3,\n' +
      '    true(), 5)\n' +
      '| sort priority, -_time\n\n' +
      '# a shift-handoff log entry format used by both SOC and NOC\n' +
      '# [incident-id] [status] [owner] [next action] [ETA] — written explicitly, not assumed known</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard SOC pattern is <b>ATT&CK-mapped alert prioritization</b> feeding ' +
      'a triage queue; the standard NOC pattern is <b>impact/blast-radius-ranked triage</b> plus a formal, written shift-handoff procedure — ' +
      'exactly the discipline this repo\'s <code>soc/</code> and <code>noc/</code> modules introduce, run here at full operational scale.</p></div>',
      try: [
        ['📖 MITRE ATT&CK — Enterprise Matrix', 'https://attack.mitre.org/matrices/enterprise/', 'o'],
        ['📖 Google SRE Book — Managing Incidents (handoff)', 'https://sre.google/sre-book/managing-incidents/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A SOC triage queue with ATT&CK-mapped priority.</b> A SOC drowning in ' +
      '800 alerts/shift, most of them benign, reduces mean-time-to-detect for real incidents by tagging every alert with its likely ATT&CK ' +
      'tactic and sorting the queue by kill-chain severity — a single credential-access alert now surfaces above 50 lower-priority scan alerts, ' +
      'instead of being buried in arrival order.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A NOC handoff procedure across shifts.</b> An outgoing NOC shift ' +
      'verbally mentions "oh, and rack 12 had some flaky links, probably nothing" — the incoming shift does not write it down, and six hours ' +
      'later a real rack-12 outage is treated as a brand-new mystery instead of the continuation of a known, already-investigated pattern. A ' +
      'mandatory written handoff log (not verbal) fixes this permanently.</p></div>' +
      '<p><b>A joint SOC/NOC bridge during a security-flavored outage</b> — e.g. a DDoS that is both a security event and an availability event ' +
      '— needs both teams in the same incident channel from the start, with one incident commander (Ch 10) coordinating across both, rather than ' +
      'two separate teams independently investigating the same outage from different angles.</p>',
      try: [
        ['📖 SANS — Incident Handler\'s Handbook', 'https://www.sans.org/white-papers/33901/', 'o'],
        ['📡 Ch 10 — on-call & incident response for infrastructure teams', '#ch10', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Alerts triaged in arrival order               Map alerts to ATT&CK tactics (SOC) or blast radius/SLO\n' +
      '                                             impact (NOC) and sort the queue by that, not by arrival\n' +
      '                                             time.\n' +
      'Verbal-only shift handoffs                    Require a written handoff log per open incident:\n' +
      '                                             status, owner, next action, ETA — verbal handoffs lose\n' +
      '                                             information silently.\n' +
      'SOC and NOC investigate the same incident      Establish a joint bridge protocol for incidents that\n' +
      'independently                               are both security- and availability-flavored, with one\n' +
      '                                             IC coordinating across both teams.\n' +
      'Triage priority based on alert volume only    Weight priority by potential impact/kill-chain stage,\n' +
      '                                             not raw count — one credential-access alert can matter\n' +
      '                                             more than fifty scan alerts.\n' +
      'No metric for triage queue health              Track mean-time-to-triage and queue depth over time —\n' +
      '                                             a queue that is silently growing is itself an incident.\n' +
      'Tribal knowledge substituting for a documented Document the triage/handoff procedure so it survives\n' +
      'procedure                                   staff turnover — a SOC/NOC that only works because of one\n' +
      '                                             veteran analyst is one resignation away from breaking.</code></pre>' +
      '<p><b>The real test:</b> if the two most experienced analysts on your SOC/NOC left tomorrow, would the triage and handoff process still ' +
      'work for the people left behind — or does it only work today because of what they personally remember?</p>',
      try: [
        ['📖 MITRE ATT&CK — using ATT&CK for triage', 'https://attack.mitre.org/resources/', 'o'],
        ['📡 Ch 14 — postmortems for infrastructure incidents', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, SOC/NOC operations are a <b>continuity-under-load</b> problem: the triage framework exists to make prioritization ' +
      'consistent regardless of which analyst is on shift, and the handoff procedure exists to make an incident\'s context survive a shift change ' +
      'without loss — both are organizational-memory mechanisms disguised as process documents. A joint SOC/NOC bridge for incidents that span ' +
      'both domains (a DDoS, a compromised host causing an outage) tests whether that continuity actually extends across team boundaries, not ' +
      'just within one team\'s shift rotation.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why map SOC alerts to the MITRE ATT&CK framework for triage instead of sorting by arrival time or\n' +
      'raw volume?\n' +
      'A: ATT&CK-mapped priority surfaces alerts by potential kill-chain severity (e.g. exfiltration over a\n' +
      '   failed login) so a genuinely dangerous alert is not buried under a much larger volume of benign\n' +
      "   scan alerts.\n\n" +
      'Q: Why require a written shift-handoff log instead of a verbal handoff?\n' +
      'A: Verbal handoffs lose information silently — a written log (status, owner, next action, ETA) per\n' +
      '   open incident ensures the incoming shift has the full context, not just what the outgoing analyst\n' +
      '   happened to remember to mention.\n\n' +
      'Q: Why does an incident that is both security- and availability-flavored (e.g. a DDoS) need a joint\n' +
      'SOC/NOC bridge?\n' +
      'A: Investigating independently risks duplicated effort and inconsistent conclusions; a joint bridge\n' +
      '   with one incident commander coordinates both perspectives on the same incident from the start.\n\n' +
      'Q: What should triage priority be weighted by, if not raw alert count?\n' +
      'A: Potential impact — kill-chain stage for security alerts, blast radius/SLO impact for operational\n' +
      '   ones — since a small number of high-impact alerts can matter far more than a large number of\n' +
      '   low-impact ones.\n\n' +
      'Q: Why is a documented triage/handoff procedure more valuable than relying on experienced analysts\'\n' +
      'judgment?\n' +
      'A: Tribal knowledge does not survive staff turnover; a documented, repeatable procedure keeps triage\n' +
      '   and handoff quality consistent regardless of who is on shift.</code></pre>',
      try: [
        ['📖 MITRE ATT&CK — framework overview', 'https://attack.mitre.org/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why map SOC alerts to the MITRE ATT&CK framework for triage prioritization instead of sorting by arrival time or raw volume?',
      opts: [
        'It automatically blocks malicious traffic',
        'It surfaces alerts by potential kill-chain severity, so a genuinely dangerous alert is not buried under a much larger volume of benign or low-priority alerts',
        'ATT&CK mapping is required for compliance certification only',
        'It eliminates the need for a human analyst'],
      ok: 1,
      why: 'Mapping alerts to ATT&CK tactics/techniques lets a triage queue rank by potential impact (e.g. exfiltration vs. a single failed login) rather than by arrival order or count alone.' },
    { q: 'Why is a written shift-handoff log preferred over a verbal handoff in a SOC or NOC?',
      opts: [
        'Verbal handoffs are faster and equally reliable',
        'Verbal handoffs lose information silently; a written log capturing status, owner, next action, and ETA ensures the incoming shift has the full context',
        'Written logs are only useful for legal/compliance purposes',
        'It has no practical effect on incident continuity'],
      ok: 1,
      why: 'A written handoff log prevents context loss between shifts — a verbally-mentioned detail that is not written down can be forgotten, causing the next shift to treat a known issue as brand new.' },
    { q: 'Why does an incident that is both security- and availability-flavored (e.g. a DDoS attack) benefit from a joint SOC/NOC bridge?',
      opts: [
        'It reduces the total number of people who need to be involved',
        'It avoids duplicated, independent investigation by both teams and lets one incident commander coordinate a unified response across both perspectives',
        'SOC and NOC teams are never allowed to investigate the same incident separately',
        'It is only relevant for incidents lasting more than 24 hours'],
      ok: 1,
      why: 'A joint bridge with unified incident command ensures the security and operational aspects of the same incident are handled coherently, rather than two teams drawing possibly conflicting conclusions independently.' }
  ]
};
