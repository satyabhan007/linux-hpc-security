/* linux-hpc-security Learn — Part 5 · Chapter 15: Case Study — Anatomy of a Major Multi-System Outage */
window.CH[15] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>This chapter is a single narrative, not a new topic: a realistic multi-system outage, read top to bottom, showing how the ' +
      'observability (Ch 1-5), alerting (Ch 8), chaos-untested assumptions (Ch 9), incident response (Ch 10), and postmortem discipline ' +
      '(Ch 14) from every earlier chapter either worked together to contain the damage — or were missing, and made it worse.</p>' +
      '<pre><code>00:00 one storage node degrades quietly  →  00:14 cascades to a scheduler  →  00:31 pages fire\n' +
      '  →  00:40 IC assigned, bridge opened  →  02:15 service restored  →  postmortem opens next day</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A chain of dominoes vs. a single tile falling over.</b> A multi-system ' +
      'outage is rarely one component failing in isolation — it is usually one small, survivable failure whose blast radius was underestimated, ' +
      'tipping into the next system that assumed the first one would never fail that way.</p></div>',
      try: [
        ['📖 Google SRE Book — Managing Incidents', 'https://sre.google/sre-book/managing-incidents/', 'o'],
        ['📡 Ch 9 — chaos engineering for bare-metal & HPC systems', '#ch9', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>00:00 — Degradation begins.</b> One OSS (Object Storage Server) node in the shared parallel filesystem starts throwing slow I/O ' +
      'warnings — <code>node_exporter</code> and the filesystem\'s own metrics show elevated latency, but it stays under every fixed alert ' +
      'threshold (the exact gap Ch 5\'s anomaly-detection chapter covers: no rolling-baseline detector was deployed for this metric, only fixed ' +
      'thresholds).</p>' +
      '<pre><code># the metric that WOULD have caught it 14 minutes earlier, had it existed at the time\n' +
      'predict_linear(lustre_ost_io_latency_seconds[15m], 15*60) > 2 * avg_over_time(lustre_ost_io_latency_seconds[1d])\n\n' +
      '# what actually fired instead — a simple, too-late fixed threshold\n' +
      'lustre_ost_io_latency_seconds > 5   # by the time this fires, the scheduler is already backing up</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>This is presented as a narrative case study rather than a new tool — the ' +
      '"standard" here is the standard failure pattern itself: a slow degradation invisible to fixed thresholds, cascading through a dependency ' +
      'nobody had mapped, exactly the scenario Ch 1 (staleness/coverage gaps) and Ch 5 (baseline detection) exist to prevent.</p></div>',
      try: [
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o'],
        ['📡 Ch 1 — fleet-wide observability: node_exporter & eBPF metrics', '#ch1', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The cascading-failure root-cause reconstruction.</b> The postmortem\'s ' +
      '5-whys chain: the scheduler failed jobs (symptom) → because it timed out waiting on the degraded OSS node (proximate cause) → because the ' +
      'job scheduler had no independent health check for storage backends, only trusting job success/failure (systemic gap) → because storage ' +
      'and scheduler teams had never jointly defined a dependency contract (organizational gap) → because no chaos experiment (Ch 9) had ever ' +
      'tested "one OSS node degrades slowly" specifically, only "one OSS node dies outright," which the filesystem already handled fine.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The cross-team incident bridge during a multi-system outage.</b> The ' +
      'storage team and the scheduling team both open separate incident channels for what turns out to be the same root cause, wasting the first ' +
      '25 minutes duplicating investigation before a single incident commander (Ch 10) consolidates them into one bridge — the exact SOC/NOC ' +
      'joint-bridge failure mode from Ch 13, playing out between two infrastructure teams instead of security and networking.</p></div>' +
      '<p><b>The postmortem that changed the architecture:</b> the concrete action items were not "add more monitoring" in the abstract, but ' +
      'specific and owned: a rolling-baseline latency detector for every OSS node (owner: storage team, due in 2 weeks), a scheduler health check ' +
      'independent of job outcomes (owner: scheduling team, due in 4 weeks), and a chaos experiment specifically simulating slow degradation, not ' +
      'just hard failure (owner: SRE team, scheduled for next quarter).</p>',
      try: [
        ['📡 Ch 14 — postmortems for infrastructure incidents', '#ch14', 'o'],
        ['📡 Ch 13 — SOC/NOC operational patterns: triage, handoff & command', '#ch13', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>WHAT WENT WRONG                            WHAT THE FIX ACTUALLY WAS\n' +
      'Slow degradation invisible to fixed          A rolling-baseline/trend detector (Ch 5) per OSS node,\n' +
      'thresholds for 14 minutes                    catching the drift well before the fixed threshold ever\n' +
      '                                             would have fired.\n' +
      'Scheduler trusted job outcomes as its only     An independent health check against storage backend\n' +
      'signal of storage health                    latency, not inferred indirectly from job failures.\n' +
      'Two teams opened separate incident channels   A single incident commander (Ch 10) consolidating both\n' +
      'for the same root cause                     channels into one bridge within the first few minutes,\n' +
      '                                             not 25 minutes in.\n' +
      'Chaos testing only covered hard node failure,  A chaos experiment (Ch 9) specifically simulating slow\n' +
      'not slow degradation                        degradation, since the two failure modes stress\n' +
      '                                             completely different code paths.\n' +
      'No dependency contract between storage and    A jointly-owned, explicit health/latency contract\n' +
      'scheduling teams                            between the two systems, reviewed by both teams, not\n' +
      '                                             assumed.</code></pre>' +
      '<p><b>The real test:</b> read back through your own team\'s last major incident using this same table shape — for each "what went wrong" ' +
      'row, do you have a concrete, owned fix, or just an intention to "be more careful next time"?</p>',
      try: [
        ['📡 Ch 9 — chaos engineering for bare-metal & HPC systems', '#ch9', 'o'],
        ['📡 Ch 10 — on-call & incident response for infrastructure teams', '#ch10', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, this case study\'s real lesson is that <b>every layer of this part exists because some earlier layer\'s absence is ' +
      'what turns a contained, single-system degradation into a two-hour, multi-team outage</b>: observability (Ch 1, 5) that would have caught ' +
      'the drift 14 minutes earlier, alerting (Ch 8) tuned to burn rate rather than a fixed threshold, chaos engineering (Ch 9) that tested the ' +
      'wrong failure mode, incident response (Ch 10, 13) that took 25 minutes to consolidate two teams investigating the same root cause, and a ' +
      'postmortem (Ch 14) that produced owned, dated action items instead of vague intentions. No single layer would have prevented this outage ' +
      'alone — the failure was the accumulated gap across all of them at once.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Walk me through why a slow OSS node degradation cascaded into a multi-system, two-hour outage.\n' +
      'A: A fixed-threshold-only alert missed 14 minutes of drift that a rolling-baseline detector would\n' +
      '   have caught; the scheduler had no independent storage health check so it just timed out; and\n' +
      '   two teams investigated separately for 25 minutes before a single IC consolidated the response.\n\n' +
      'Q: Why did the existing chaos engineering program not catch this failure mode in advance?\n' +
      "A: It had only tested hard node failure (which the filesystem's redundancy already handled), never\n" +
      '   slow degradation — the two failure modes stress entirely different code paths and assumptions.\n\n' +
      'Q: What is the single highest-leverage fix from this case study\'s postmortem?\n' +
      'A: There is no single one by design — the outage was caused by gaps across five different layers\n' +
      '   (observability, alerting, chaos coverage, incident response, dependency contracts); all five\n' +
      '   fixes were tracked as owned, dated action items.\n\n' +
      'Q: Why did the two teams opening separate incident channels make the outage worse?\n' +
      'A: It duplicated investigation effort and delayed a unified root-cause picture for 25 minutes —\n' +
      '   exactly the joint-bridge failure mode Ch 13 describes for SOC/NOC, here between two\n' +
      '   infrastructure teams instead.\n\n' +
      'Q: What makes this postmortem\'s action items different from a typical "add more monitoring" response?\n' +
      'A: Each item is specific, owned by a named team, and has a due date — a rolling-baseline detector,\n' +
      '   an independent scheduler health check, and a targeted chaos experiment, not a vague commitment\n' +
      '   to "improve observability."</code></pre>',
      try: [
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o'],
        ['📖 Google SRE Book — Managing Incidents', 'https://sre.google/sre-book/managing-incidents/', 'o']
      ] }
  ],

  quiz: [
    { q: 'In the case study, why did the slow OSS node degradation go undetected for 14 minutes before cascading?',
      opts: [
        'The node had no monitoring installed at all',
        'Only fixed-threshold alerting existed for that metric — the slow drift stayed under the fixed threshold even though it was already a growing problem',
        'The monitoring system was down for maintenance',
        'The metric was not exposed by node_exporter'],
      ok: 1,
      why: 'A rolling-baseline or trend-based detector (Ch 5) would have flagged the drift well before it crossed a fixed threshold — the case study is a direct illustration of that gap.' },
    { q: 'Why did having two teams open separate incident channels for the same underlying root cause make the outage worse?',
      opts: [
        'It had no real effect on the outcome',
        'It duplicated investigation effort and delayed a unified understanding of the root cause for 25 minutes before a single incident commander consolidated the response',
        'Separate channels are always more efficient than one shared channel',
        'It only affected the postmortem process, not the live incident'],
      ok: 1,
      why: 'Without a single consolidated incident bridge, both teams investigated independently and slower, delaying the point at which the actual cross-system root cause was identified.' },
    { q: 'Why did the existing chaos engineering program fail to prevent this outage in advance?',
      opts: [
        'The organization had never run any chaos experiments',
        'Previous chaos experiments only tested hard node failure, which the filesystem already handled well, not the slow-degradation failure mode that actually occurred',
        'Chaos engineering cannot test storage systems',
        'The chaos experiments were run but ignored by the storage team'],
      ok: 1,
      why: 'Testing the wrong failure mode (hard failure instead of slow degradation) meant the chaos program gave false confidence — the two failure modes exercise different code paths and assumptions.' }
  ]
};
