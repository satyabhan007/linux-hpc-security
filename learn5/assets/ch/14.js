/* linux-hpc-security Learn — Part 5 · Chapter 14: Postmortems for Infrastructure Incidents */
window.CH[14] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>An incident ends, everyone is exhausted, and the temptation is to close the ticket and move on. Three months later the exact same ' +
      'outage happens again, because nobody wrote down what actually caused it or who was supposed to fix the root cause. A <b>postmortem</b> is ' +
      'the deliberate act of turning "we survived that" into "here is exactly what happened and here is what changes so it does not happen ' +
      'again."</p>' +
      '<pre><code>Incident resolved → everyone moves on → same incident recurs in 3 months (nothing learned)\n' +
      'Incident resolved → blameless postmortem written → action items tracked to closure (lesson captured)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An aviation incident investigation vs. "the plane landed fine, let\'s move ' +
      'on."</b> Aviation treats every near-miss as a mandatory, blameless investigation because the goal is preventing the next one — not ' +
      'assigning blame for the last one. That discipline is why flying keeps getting safer over decades.</p></div>',
      try: [
        ['📖 Google SRE Book — Postmortem Culture', 'https://sre.google/sre-book/postmortem-culture/', 'o'],
        ['📡 Ch 10 — on-call & incident response for infrastructure teams', '#ch10', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A good postmortem has: a factual <b>timeline</b> (built from logs, alerts, and chat history, timestamped, no interpretation mixed in), ' +
      'a <b>root cause</b> analysis (often via the "5 whys" technique), and concrete <b>action items</b> with an owner and a due date — not vague ' +
      'intentions. <b>Blameless</b> means the writeup focuses on systems and process gaps, never "who made the mistake."</p>' +
      '<pre><code># Splunk SPL: reconstructing a factual incident timeline from raw logs and pages\n' +
      'index=infra OR index=pagerduty earliest="2026-09-10T14:00:00" latest="2026-09-10T16:00:00"\n' +
      '| sort _time\n' +
      '| table _time, source, host, message\n\n' +
      '# a "5 whys" root-cause chain, written down explicitly rather than stopped at the first answer\n' +
      '# Why did the service fail? -> OOM killed.  Why? -> memory leak.  Why? -> unbounded cache.\n' +
      '# Why unbounded? -> no eviction policy.  Why no eviction policy? -> not required at original scale.</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard format is the <b>Google SRE blameless postmortem</b> template ' +
      '— summary, impact, timeline, root cause (5 whys), what went well/what went poorly, and action items with owners and due dates — reviewed ' +
      'in a facilitated meeting, then tracked in the same issue tracker as any other engineering work until each item is actually closed.</p></div>',
      try: [
        ['📖 Google SRE Workbook — Postmortem template', 'https://sre.google/sre-book/example-postmortem/', 'o'],
        ['📖 PagerDuty — postmortem best practices', 'https://response.pagerduty.com/after/postmortem_guide/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Facilitating a blameless postmortem meeting.</b> An engineer whose ' +
      'deploy triggered an outage is visibly anxious walking into the postmortem meeting, expecting to be blamed; a skilled facilitator opens by ' +
      'stating explicitly "we are here to fix the system that allowed this deploy to cause an outage, not to blame the person who ran it" — and ' +
      'that framing is what gets the engineer to volunteer the full, honest sequence of events instead of a defensive, incomplete one.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Writing a postmortem timeline from raw logs and pages.</b> Two ' +
      'engineers on the incident bridge remember the timeline differently after the adrenaline wears off; reconstructing it from actual log ' +
      'timestamps, alert-fire times, and chat message timestamps produces a timeline neither person\'s memory alone would have gotten right — ' +
      'memory during an incident is unreliable, timestamps are not.</p></div>' +
      '<p><b>Tracking postmortem action items to actual closure</b> is the step most teams skip: a postmortem with twelve action items and zero ' +
      'tracked to completion six months later has captured the lesson on paper but not actually learned it — the postmortem process itself needs ' +
      'a metric (e.g. % of action items closed within N weeks) or it silently becomes theater.</p>',
      try: [
        ['📖 Google SRE Book — Example Postmortem', 'https://sre.google/sre-book/example-postmortem/', 'o'],
        ['📡 Ch 9 — chaos engineering for bare-metal & HPC systems', '#ch9', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Postmortems that assign individual blame     Keep the writeup blameless — focus on the systems and\n' +
      '                                             process gaps that allowed the incident, not the person\n' +
      '                                             who triggered it.\n' +
      'Timeline reconstructed from memory            Build the timeline from actual timestamps (logs,\n' +
      '                                             alerts, chat history) — memory after an incident is\n' +
      '                                             unreliable, timestamps are not.\n' +
      'Stopping root-cause analysis at the first      Use "5 whys" (or similar) to dig past the first answer\n' +
      'symptom                                      to the actual systemic gap — "OOM killed" is a symptom,\n' +
      '                                             not a root cause.\n' +
      'Action items with no owner or due date        Every action item needs a named owner and a due date —\n' +
      '                                             an action item with neither is a wish, not a commitment.\n' +
      'Postmortems written and never revisited       Track action items to actual closure and measure the\n' +
      '                                             rate — an unclosed postmortem backlog means lessons are\n' +
      '                                             captured on paper but not applied.\n' +
      'Postmortems only for the biggest outages       Write postmortems for near-misses and SEV3/4 incidents\n' +
      '                                             too — the same systemic gap that caused a minor issue\n' +
      '                                             today can cause a major one tomorrow.</code></pre>' +
      '<p><b>The real test:</b> pull up your last five postmortems right now — how many of their action items are actually closed, and would ' +
      'anyone have noticed if none of them were?</p>',
      try: [
        ['📖 Google SRE Book — Postmortem Culture', 'https://sre.google/sre-book/postmortem-culture/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, the postmortem is an <b>organizational learning</b> mechanism, and its real output is not the document — it is the ' +
      'set of action items that actually get closed. A blameless culture is not a soft nicety; it is the precondition for people to report the ' +
      'full, honest sequence of events instead of a defensive, incomplete one, and without that honesty the "root cause" in the document is ' +
      'fiction. The 5-whys technique works only if practiced with discipline past the first comfortable-sounding answer.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is a blameless postmortem culture necessary for accurate root-cause analysis, not just a nice-\n' +
      'to-have?\n' +
      'A: If people fear individual blame, they give a defensive, incomplete account of events — a\n' +
      '   blameless framing is what gets the full, honest sequence needed to find the real systemic cause.\n\n' +
      'Q: Why build the incident timeline from logs/timestamps rather than participants\' memory?\n' +
      "A: Memory after a high-stress incident is unreliable and inconsistent between participants; actual\n" +
      '   timestamps from logs, alerts, and chat history produce an accurate, disputable-only-by-evidence\n' +
      '   timeline.\n\n' +
      'Q: Why use a technique like "5 whys" instead of stopping at the first identified cause?\n' +
      'A: The first answer is usually a symptom (e.g. "OOM killed"), not the systemic root cause (e.g. "no\n' +
      '   eviction policy was ever required at the original design scale") — repeated "why" digs past the\n' +
      '   symptom to the actual gap.\n\n' +
      'Q: What makes an action item from a postmortem actually likely to get done?\n' +
      'A: A named owner and a concrete due date, tracked in the same system as other engineering work — an\n' +
      '   action item without both is effectively just a wish.\n\n' +
      'Q: How do you know if your postmortem process is actually working, versus just producing documents?\n' +
      'A: Measure the fraction of action items closed within a target window — a postmortem process with a\n' +
      '   growing backlog of unclosed action items has captured lessons on paper without applying them.</code></pre>',
      try: [
        ['📖 Google SRE Book — Postmortem Culture', 'https://sre.google/sre-book/postmortem-culture/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is a blameless postmortem culture important for accurate root-cause analysis, not just good etiquette?',
      opts: [
        'It makes the postmortem meeting shorter',
        'If people fear individual blame, they give a defensive, incomplete account of events, which prevents the postmortem from finding the true systemic root cause',
        'It is a legal requirement in most jurisdictions',
        'It eliminates the need for a written timeline'],
      ok: 1,
      why: 'Honesty about the full sequence of events is only possible when contributors are not worried about being blamed individually — blamelessness is a precondition for accurate analysis, not just a courtesy.' },
    { q: 'Why should an incident timeline be built from logs and timestamps rather than participants\' memory of what happened?',
      opts: [
        'Logs are always easier to access than asking participants',
        'Memory after a high-stress incident is unreliable and often inconsistent between participants, while timestamped evidence produces an accurate record',
        'Participants are not allowed to contribute to postmortems',
        'It has no real effect on postmortem quality'],
      ok: 1,
      why: 'Human memory of a stressful incident is frequently inaccurate or inconsistent across people; reconstructing the timeline from actual logs, alerts, and chat timestamps avoids that unreliability.' },
    { q: 'Why is a technique like "5 whys" used instead of stopping at the first identified cause of an incident?',
      opts: [
        'It is a formality with no impact on the outcome',
        'The first identified cause is usually a symptom rather than the systemic root cause; repeatedly asking "why" digs past the symptom to the actual underlying gap',
        '5 whys is only applicable to security incidents',
        'It replaces the need for a written postmortem entirely'],
      ok: 1,
      why: 'Stopping at the first answer (e.g. "the process was OOM killed") identifies a symptom, not the systemic issue (e.g. missing cache eviction policy) that needs to be fixed to prevent recurrence.' }
  ]
};
