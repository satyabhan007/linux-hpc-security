/* linux-hpc-security Learn — Part 4 · Chapter 16: Reference Architecture — The Compliance-as-Code Security Platform */
window.CH[16] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Fifteen chapters of individually excellent controls — STIG automation, SELinux policy, secrets management, segmentation, ' +
      'detection, JIT access — can still fail as a fleet if each one is its own island, run by a different team, with no shared source ' +
      'of truth and no single place an auditor (or an incident commander) can go to see the whole picture at once. A platform is not ' +
      'just "we have all these tools"; it is "these tools compose into one coherent system".</p>' +
      '<pre><code>15 excellent, disconnected security tools    →     One platform: shared inventory, shared identity,\n' +
      '  (each with its own dashboard, its own team)        shared evidence pipeline, one pane of glass</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An orchestra where every musician is individually excellent but ' +
      'nobody is watching the conductor.</b> Each instrument, played alone, sounds fine. Without a shared tempo and score, the whole ' +
      'is not music — it is fifteen simultaneous solos.</p></div>',
      try: [
        ['📖 NIST — Zero Trust Architecture (SP 800-207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 1 — DISA STIG automation at fleet scale', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The reference architecture ties every chapter into four shared layers: an <b>asset/identity inventory</b> every other system ' +
      'reads from, a <b>policy-as-code layer</b> (STIG/CIS/SELinux/segmentation rules, all version-controlled), a <b>continuous ' +
      'verification pipeline</b> (scan, score, remediate, on a schedule), and an <b>evidence/observability layer</b> (audit logs, ' +
      'SBOMs, compliance results — all queryable from one place):</p>' +
      '<pre><code># the shared spine: every control below reads from and writes to the same inventory + evidence store\n' +
      '\n' +
      '  [ Asset & Identity Inventory ]   <-- every host, workload identity, and credential lease (Ch 6, 10)\n' +
      '            |\n' +
      '  [ Policy as Code ]               <-- STIG/CIS (Ch 1,2), SELinux/AppArmor (Ch 3), segmentation (Ch 11)\n' +
      '            |\n' +
      '  [ Continuous Verification ]      <-- OpenSCAP/oscap scans (Ch 13), patch-risk scoring (Ch 12), FIM (Ch 9)\n' +
      '            |\n' +
      '  [ Evidence & Observability ]     <-- auditd/eBPF (Ch 8), SBOMs (Ch 5), one queryable evidence store\n' +
      '\n' +
      '# a single query spans every layer: "show me every host running libfoo<1.2.4, its STIG status,\n' +
      '# and whether it is reachable from the internet" — answerable because the layers share one schema.</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard reference model is a <b>Zero Trust Architecture ' +
      '(NIST SP 800-207)</b>-aligned platform: no implicit trust from network location alone, every access decision informed by ' +
      'identity + device/host posture (drawn from the compliance-scanning layer) + policy, with <b>OpenSCAP/SCAP results, SBOMs, and ' +
      'audit logs feeding one shared evidence store</b> rather than fifteen separate dashboards.</p></div>',
      try: [
        ['📖 NIST — Zero Trust Architecture (SP 800-207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['📖 CISA — zero trust maturity model', 'https://www.cisa.gov/zero-trust-maturity-model', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Designing your org\'s compliance-as-code platform from ' +
      'scratch.</b> A team inherits fifteen separate tools (one per chapter\'s topic, roughly) built by different teams over several ' +
      'years, each with its own database and its own definition of "this host". Fix: the platform work is not "build sixteen new ' +
      'tools" — it is defining ONE shared asset/identity schema every existing tool can read from and write to, then migrating ' +
      'incrementally, tool by tool, rather than a big-bang rewrite that risks losing coverage during the transition.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The "walk me through your hardening pipeline" interview ' +
      'question.</b> A strong answer does not list fifteen unrelated tools — it walks the SAME four-layer spine as this chapter\'s ' +
      'L2 box: how a host enters inventory, how policy gets applied and verified continuously, and how evidence flows into one place ' +
      'an auditor or an incident commander can query. Fix: practice explaining your own fleet\'s architecture as a coherent flow, not ' +
      'a tool inventory — the flow is what an interviewer (and a real auditor) actually wants to see.</p></div>' +
      '<p><b>A security-hardening platform RFC succeeds or fails on the shared schema, not the tool choices:</b> which specific SCAP ' +
      'scanner or which specific vault product you pick matters far less than whether every layer agrees on what a "host" and an ' +
      '"identity" even are.</p>',
      try: [
        ['📖 NIST — SP 800-207 (Zero Trust Architecture)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 13 — compliance-as-code with OpenSCAP', '#ch13', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Every control (STIG, secrets, segmentation,  Define one shared asset/identity inventory every layer reads from and\n' +
      '  detection...) has its own siloed database    writes to — the schema is the platform, not any single tool.\n' +
      'Migrating to a unified platform via a         Migrate incrementally, tool by tool, onto the shared schema — a\n' +
      '  big-bang rewrite of every tool at once        big-bang rewrite risks losing real coverage during the transition.\n' +
      'Compliance evidence scattered across           Feed OpenSCAP results, SBOMs, and audit logs into ONE queryable\n' +
      '  fifteen separate dashboards                   evidence store — a single query should span every control layer.\n' +
      'Network location treated as an implicit        Adopt zero-trust principles (SP 800-207) — every access decision\n' +
      '  trust signal ("it\'s inside the VLAN so ok")    informed by identity + host posture + policy, not network location alone.\n' +
      'Platform "done" once every chapter\'s tool is  Treat it as a living system — new hosts, new CVEs, new attack techniques\n' +
      '  individually deployed                          (Ch 14\'s exercises) continuously feed back into the same four layers.\n' +
      'Tool selection debated at length before the   Agree the shared schema and data flow FIRST — which specific scanner or\n' +
      '  shared schema/data-flow is even defined       vault product you pick matters far less than whether they can share data.</code></pre>' +
      '<p><b>The real test:</b> can one engineer, using one query against one evidence store, answer "which hosts are non-compliant, ' +
      'internet-facing, AND running a component with an actively-exploited CVE" — spanning Ch 1, Ch 11, and Ch 12\'s worlds at once?</p>',
      try: [
        ['📖 NIST — SP 800-207 (Zero Trust Architecture)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 12 — vulnerability & patch-risk scoring at fleet scale', '#ch12', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, every chapter in this part has been building toward the same underlying idea, applied to a different ' +
      'surface: <b>compliance and security state should be a continuously regenerated, queryable fact, not a stale artifact trusted ' +
      'from a past point in time</b> — true of STIG scans (Ch 1), true of secrets (Ch 6, short TTLs beat static trust), true of access ' +
      '(Ch 10, JIT beats standing trust), true of network reachability (Ch 11, tested beats assumed), true of detection coverage ' +
      '(Ch 14, measured beats hoped-for). The reference architecture is simply what it looks like when all fifteen of those instances ' +
      'of the same principle share one spine instead of duplicating it fifteen separate times.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What is the single idea that unifies every control discussed across this part of the course?\n' +
      "A: Security/compliance state must be continuously regenerated and verifiable, not trusted from a past\n" +
      '   snapshot — true for STIG compliance, secrets (short TTL vs. static), access (JIT vs. standing),\n' +
      '   network reachability (tested vs. assumed), and detection coverage (measured vs. hoped-for) alike.\n\n' +
      'Q: Why is a shared asset/identity inventory more foundational to a security platform than any single\n' +
      '   tool choice (which SCAP scanner, which vault product)?\n' +
      'A: Every other layer (policy, verification, evidence) depends on agreeing what a "host" and an\n' +
      '   "identity" even are — without that shared schema, fifteen individually excellent tools cannot\n' +
      "   compose into one coherent, queryable picture of the fleet's actual state.\n\n" +
      'Q: How would you migrate fifteen siloed security tools onto one unified platform without losing\n' +
      '   coverage during the transition?\n' +
      'A: Incrementally — define the shared schema first, then migrate one tool at a time onto it, rather\n' +
      '   than a big-bang rewrite that risks a coverage gap while everything is rebuilt simultaneously.\n\n' +
      'Q: What does "zero trust" mean concretely in this reference architecture, beyond the buzzword?\n' +
      'A: No access decision is based on network location alone — every decision draws on identity, real-time\n' +
      '   host compliance/posture (fed by the continuous-verification layer), and policy, consistent with\n' +
      '   NIST SP 800-207.\n\n' +
      'Q: How would you answer "walk me through your hardening pipeline" in an interview, using this\n' +
      '   reference architecture?\n' +
      'A: Describe the four-layer spine — how a host enters the shared inventory, how policy-as-code is\n' +
      '   applied and continuously re-verified against it, and how the resulting evidence (scans, SBOMs,\n' +
      '   audit logs) flows into one queryable store — rather than listing disconnected tools.</code></pre>',
      try: [
        ['📖 NIST — Zero Trust Architecture (SP 800-207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 1 — DISA STIG automation at fleet scale', '#ch1', 'o']
      ] }
  ],

  quiz: [
    { q: 'What single idea unifies the controls discussed across all 15 preceding chapters of this part?',
      opts: [
        'Every control should use the same vendor\'s tooling',
        'Security/compliance state should be continuously regenerated and verifiable rather than trusted from a past point-in-time snapshot',
        'All security controls should be enforced manually to avoid automation risk',
        'Every chapter describes a completely unrelated, independent problem'],
      ok: 1,
      why: 'From STIG scanning to JIT access to network segmentation, the recurring theme is continuous verification replacing stale, trust-once artifacts.' },
    { q: 'Why is a shared asset/identity inventory considered more foundational to a security platform than the choice of any individual tool?',
      opts: [
        'Individual tool choice is actually the most important decision',
        'Every other layer (policy, verification, evidence) depends on a shared definition of "host" and "identity" — without it, tools cannot compose into one coherent picture of fleet state',
        'Asset inventories are required by law for security platforms',
        'Tools cannot function at all without a shared inventory'],
      ok: 1,
      why: 'The schema that lets every layer share data is what turns fifteen separate tools into one coherent platform, regardless of which specific products are used.' },
    { q: 'What is the recommended approach for migrating fifteen siloed security tools onto one unified compliance-as-code platform?',
      opts: [
        'A big-bang rewrite replacing every tool simultaneously',
        'Incremental migration — define the shared schema first, then migrate tools onto it one at a time to avoid a coverage gap during the transition',
        'Keep all tools permanently siloed since unification provides no real benefit',
        'Migrate only the newest tools and leave legacy tools untouched indefinitely'],
      ok: 1,
      why: 'Incremental migration onto an agreed shared schema avoids the risk of losing security coverage that a full simultaneous rewrite would create.' }
  ]
};
