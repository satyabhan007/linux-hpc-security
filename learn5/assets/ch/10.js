/* linux-hpc-security Learn — Part 5 · Chapter 10: On-Call & Incident Response for Infrastructure Teams */
window.CH[10] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A page goes off at 3am. Is this a "restart it and go back to sleep" problem or a "wake up three other teams and the VP of ' +
      'engineering" problem? Without a framework, the half-asleep on-call engineer has to make that judgment call from scratch, every single ' +
      'time. <b>Incident response</b> is a pre-agreed structure — severity levels, a clear leader, a runbook — so the judgment call was already ' +
      'made in daylight, calmly, before the 3am page ever happens.</p>' +
      '<pre><code>3am page, figure it out from scratch   →   3am page, follow the SEV framework + runbook\n' +
      '  (slow, inconsistent, error-prone)          (fast, consistent, decided while calm)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An ER triage system vs. treating whoever shouts loudest first.</b> A ' +
      'hospital ER does not decide severity by improvising in the moment — it uses a pre-agreed triage scale so a chest-pain patient is seen ' +
      'before a sprained ankle, every time, regardless of who is on shift.</p></div>',
      try: [
        ['📖 Google SRE Book — Managing Incidents', 'https://sre.google/sre-book/managing-incidents/', 'o'],
        ['📡 Ch 8 — alerting design: paging, escalation & noise reduction', '#ch8', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A <b>SEV framework</b> (SEV1 = full outage/critical impact, down to SEV4 = minor/no user impact) sets response urgency and who gets ' +
      'paged. An <b>incident commander (IC)</b> role is assigned per incident — one person coordinating, not diagnosing, so the people actually ' +
      'fixing the problem are not also managing status updates and stakeholder communication.</p>' +
      '<pre><code>SEV1: full service outage, all-hands, IC assigned within 5 min, exec notified\n' +
      'SEV2: significant degradation, primary + secondary on-call, IC assigned within 15 min\n' +
      'SEV3: limited/isolated impact, primary on-call handles, no IC required\n' +
      'SEV4: no user impact, cosmetic/internal only, business-hours fix\n\n' +
      '# a minimal incident-response checklist embedded at the top of a runbook\n' +
      '# 1. Declare severity.  2. Assign an IC (not the same person debugging).\n' +
      '# 3. Open an incident channel.  4. Post a status update every 15-30 min, even if "still investigating".</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard is a documented <b>SEV1-4 severity scale</b> plus an explicit ' +
      '<b>Incident Commander</b> role (a pattern borrowed from FEMA\'s Incident Command System and formalized for engineering by Google\'s SRE ' +
      'practice), with a dedicated incident channel and a fixed communication cadence — separating "who is coordinating" from "who is fixing" is ' +
      'the single highest-leverage change most teams can make.</p></div>',
      try: [
        ['📖 Google SRE Book — Incident Command System for IT', 'https://sre.google/sre-book/managing-incidents/', 'o'],
        ['📖 PagerDuty — incident severity levels', 'https://response.pagerduty.com/before/severity_levels/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Designing a SEV1-4 severity framework.</b> Before the framework ' +
      'existed, every incident got treated as an all-hands emergency, burning out the team; after defining SEV3/SEV4 as "primary on-call handles, ' +
      'no escalation required," routine issues stop paging four extra engineers, and SEV1 pages get the urgency they actually deserve because ' +
      'they are no longer diluted by noise.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Running an incident with a clear incident-commander role.</b> During a ' +
      'SEV1, the engineer with the deepest system knowledge is put in the IC role by habit — and spends the whole incident answering Slack ' +
      'questions from stakeholders instead of debugging. The fix: the IC coordinates and communicates; a separate engineer (who might know less ' +
      'about the system) drives the technical investigation, freeing the expert to actually think.</p></div>' +
      '<p><b>A runbook that survives being read by someone unfamiliar with the system</b> is the actual bar: numbered steps, exact commands (not ' +
      '"check if the service is healthy" but the literal command and what a healthy vs. unhealthy result looks like), and an explicit "if this ' +
      'does not work, escalate to X" — written assuming 3am, half-awake, unfamiliar reader, not the person who wrote it.</p>',
      try: [
        ['📡 Ch 11 — runbook automation & self-healing remediation', '#ch11', 'o'],
        ['📖 Google SRE Book — Postmortem Culture', 'https://sre.google/sre-book/postmortem-culture/', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Every incident treated as an emergency       Define a SEV1-4 scale with explicit criteria and\n' +
      '                                             response requirements per level — most incidents are\n' +
      '                                             not SEV1.\n' +
      'The debugger is also the incident commander  Split IC (coordination/communication) from the technical\n' +
      '                                             lead (debugging) — one person cannot do both well under\n' +
      '                                             pressure.\n' +
      'Runbooks written for the author, not a        Write runbooks assuming an unfamiliar, half-awake\n' +
      'stranger at 3am                              reader: exact commands, expected output, explicit\n' +
      '                                             escalation triggers.\n' +
      'No regular status updates during an incident  Post updates on a fixed cadence (e.g. every 15-30 min)\n' +
      '                                             even when there is no new information — silence during\n' +
      '                                             an incident reads as "nobody is working on it".\n' +
      'Incident response improvised from scratch     Decide severity criteria, IC responsibilities, and\n' +
      'each time                                    communication cadence in advance, while calm — not\n' +
      '                                             during the incident itself.\n' +
      'No formal incident closure                    Explicitly declare an incident resolved and hand off\n' +
      '                                             to the postmortem process (Ch 14) — an incident that\n' +
      '                                             just fades out never gets its lessons captured.</code></pre>' +
      '<p><b>The real test:</b> if a brand-new engineer who joined last week were the only one awake during a SEV1 at 3am, would your runbook ' +
      'and severity framework actually get them through it — or does the process only work because the same three senior engineers always ' +
      'respond?</p>',
      try: [
        ['📖 Google SRE Book — Managing Incidents', 'https://sre.google/sre-book/managing-incidents/', 'o'],
        ['📡 Ch 13 — SOC/NOC operational patterns: triage, handoff & command', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, incident response is an <b>organizational design</b> problem disguised as a technical one: the SEV framework, IC role, ' +
      'and runbook quality all exist to make the response consistent and effective regardless of which specific human is on call — removing ' +
      'reliance on any one expert\'s tribal knowledge is the actual goal, and the true measure of a mature incident-response practice is how well ' +
      'it performs with the least experienced person on the rotation, not the most.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why separate the incident-commander role from the person actually debugging the issue?\n' +
      'A: Coordinating communication/status updates and deep technical debugging both require full\n' +
      '   attention under pressure; combining them in one person degrades both — the IC coordinates, a\n' +
      '   separate technical lead investigates.\n\n' +
      'Q: What makes a runbook actually usable during a real incident, versus just documentation?\n' +
      'A: It assumes an unfamiliar, half-awake 3am reader: exact commands, expected healthy/unhealthy\n' +
      '   output, and explicit escalation triggers — not vague guidance that requires system familiarity to\n' +
      '   interpret.\n\n' +
      'Q: Why define SEV1-4 criteria in advance rather than deciding severity in the moment?\n' +
      'A: Deciding severity while calm, in daylight, produces consistent criteria; deciding it half-asleep\n' +
      '   during an actual incident is slow and inconsistent, and either over- or under-escalates.\n\n' +
      'Q: Why post status updates on a fixed cadence even when there is nothing new to report?\n' +
      'A: Silence during an incident reads as "nobody is working on it" to stakeholders — a fixed cadence\n' +
      '   ("still investigating, next update in 15 min") maintains confidence and coordination even without\n' +
      '   new findings.\n\n' +
      'Q: What is the real measure of a mature incident-response process?\n' +
      'A: How well it performs with the least experienced person on the rotation, not the most — a process\n' +
      "   that only works because the same senior engineers always respond has not actually removed the\n" +
      '   dependency on tribal knowledge.</code></pre>',
      try: [
        ['📖 Google SRE Book — Managing Incidents', 'https://sre.google/sre-book/managing-incidents/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why separate the incident-commander (IC) role from the engineer actively debugging the issue?',
      opts: [
        'It is unnecessary — the most senior engineer should always do both',
        'Coordination/communication and deep technical debugging both require full attention under pressure; combining them in one person degrades both',
        'The IC role only exists for SEV4 incidents',
        'ICs are only needed when more than 10 people are involved'],
      ok: 1,
      why: 'Splitting coordination from technical investigation lets the debugging engineer focus fully on the problem while the IC handles status updates, stakeholder communication, and process — both jobs suffer if combined under pressure.' },
    { q: 'What is the key property of a runbook that actually works during a real 3am incident?',
      opts: [
        'It is written in as much technical depth as possible, assuming an expert reader',
        'It assumes an unfamiliar, half-awake reader: exact commands, expected output, and explicit escalation triggers',
        'It contains only high-level guidance so it stays generally applicable',
        'It is kept as short as possible regardless of clarity'],
      ok: 1,
      why: 'A usable runbook is written for someone unfamiliar with the system under stress — concrete commands and expected results, with a clear point to escalate if a step does not resolve the issue.' },
    { q: 'Why should SEV1-4 severity criteria be defined in advance rather than judged in the moment during an incident?',
      opts: [
        'Advance definition is a compliance requirement with no practical benefit',
        'Deciding criteria calmly and in daylight produces consistent, well-reasoned severity judgments, while deciding under pressure at 3am is slow and inconsistent',
        'Severity levels never need to be reassessed once an incident starts',
        'It eliminates the need for an incident commander'],
      ok: 1,
      why: 'Pre-agreed severity criteria let an on-call engineer classify an incident quickly and consistently, rather than improvising a judgment call from scratch while half-asleep during the actual event.' }
  ]
};
