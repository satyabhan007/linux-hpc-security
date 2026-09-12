/* linux-hpc-security Learn — Part 5 · Chapter 16: Reference Architecture — The Production Operations Platform */
window.CH[16] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Fifteen chapters covered metrics, logs, traces, anomaly detection, fraud pipelines, SLOs, alerting, chaos, on-call, automation, ' +
      'capacity, SOC/NOC, and postmortems as separate topics. In a real organization, none of them are separate — they are one platform, wired ' +
      'together, and this chapter is the single diagram that shows how every piece connects to every other piece.</p>' +
      '<pre><code>metrics + logs + traces  →  anomaly/burn-rate detection  →  alerting (dedup + escalate)\n' +
      '        ↑                                                              ↓\n' +
      '  capacity planning  ←  postmortem action items  ←  incident response  ←  on-call page</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A hospital\'s full system vs. a pile of separate departments.</b> Vitals ' +
      'monitoring, triage, the ER, specialists, and the morbidity-and-mortality review meeting are each their own discipline, but a hospital only ' +
      'actually works when they are wired into one continuous flow — a vital-sign anomaly reaches triage, triage reaches the right specialist, ' +
      'and every serious case eventually reaches the review that improves the whole system.</p></div>',
      try: [
        ['📖 Google SRE Book — Table of Contents', 'https://sre.google/sre-book/table-of-contents/', 'o'],
        ['📡 Ch 1 — fleet-wide observability: node_exporter & eBPF metrics', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The reference architecture, layer by layer: <b>collection</b> (node_exporter/eBPF metrics, Splunk/ELK logs, OpenTelemetry traces — ' +
      'Ch 1-4) feeds <b>analysis</b> (rolling-baseline anomaly detection and fraud/circumvention pipelines — Ch 5-6) and <b>governance</b> (SLOs ' +
      'and error budgets — Ch 7), both of which drive <b>alerting</b> (burn-rate-based paging with dedup/escalation — Ch 8), which triggers ' +
      '<b>operations</b> (chaos-tested assumptions, on-call response, runbook automation — Ch 9-11), informed by <b>planning</b> (capacity ' +
      'forecasting — Ch 12) and <b>command</b> (SOC/NOC triage and handoff — Ch 13), closing the loop through <b>learning</b> (postmortems — ' +
      'Ch 14) that feeds back into every earlier layer.</p>' +
      '<pre><code># the loop, expressed as the actual feedback edges (not just a one-way pipeline)\n' +
      'metrics/logs/traces --> anomaly detection --> SLO burn rate --> alert --> page\n' +
      '  ^                                                                        |\n' +
      '  |                                                                        v\n' +
      'postmortem action items <-- incident response <-- runbook automation <-- on-call\n' +
      '  |\n' +
      '  +--> capacity plan revisions, new chaos experiments, new anomaly detectors, tuned alert thresholds</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>This IS the standard — the architecture described across Ch 1-14 already ' +
      '<i>is</i> the reference design; this chapter\'s contribution is making the feedback loop explicit: postmortem action items should ' +
      'literally point back at specific chapters/subsystems (a new Ch 5 detector, a new Ch 9 chaos experiment, a revised Ch 7 SLO) rather than ' +
      'living as a standalone document.</p></div>',
      try: [
        ['📖 Google SRE Workbook — Table of Contents', 'https://sre.google/workbook/table-of-contents/', 'o'],
        ['📡 Ch 14 — postmortems for infrastructure incidents', '#ch14', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Designing your org\'s production-ops platform from scratch.</b> A team ' +
      'starting with nothing prioritizes in dependency order: metrics and logs first (Ch 1-3, you cannot detect what you cannot see), then SLOs ' +
      'and alerting (Ch 7-8, so pages mean something from day one), then incident response structure (Ch 10) before the team scales past a ' +
      'handful of engineers, with chaos engineering, fraud pipelines, and full automation (Ch 6, 9, 11) layered in as the platform matures — ' +
      'building all sixteen layers simultaneously from zero is how platforms stall out and ship none of them well.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>An observability-platform RFC.</b> An RFC proposing a new tracing ' +
      'system in isolation gets rejected in review because it does not explain how trace IDs correlate into the existing log pipeline (Ch 2-3) ' +
      'or how span-duration metrics feed the existing SLO burn-rate alerts (Ch 7-8) — the reviewers are applying exactly this chapter\'s ' +
      'principle: no new piece of the platform should be designed as if the other fifteen do not exist.</p></div>' +
      '<p><b>The "walk me through your on-call setup" interview question</b> is really asking whether you understand this whole loop, not just ' +
      'the paging tool: a strong answer covers what generates the signal, how it is filtered from anomaly to burn rate to alert, who responds and ' +
      'how, and where the lesson from the last incident actually landed in the system afterward.</p>',
      try: [
        ['📖 Google SRE Book — Table of Contents', 'https://sre.google/sre-book/table-of-contents/', 'o'],
        ['📡 Ch 7 — SLOs & error budgets for infrastructure teams', '#ch7', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Building all 16 capability layers at once   Sequence by dependency: collection (Ch 1-4) before\n' +
      '                                             analysis/governance (Ch 5-7) before alerting/ops\n' +
      '                                             (Ch 8-11) before planning/command (Ch 12-13).\n' +
      'Each new subsystem designed in isolation      Require every new piece (a tracing rollout, a new\n' +
      '                                             detector) to state how it plugs into existing logs,\n' +
      '                                             metrics, SLOs, and alerting — not as a silo.\n' +
      'Postmortem action items as standalone tasks    Point each action item at the specific platform layer\n' +
      '                                             it changes (a new Ch 5 detector, a revised Ch 7 SLO,\n' +
      '                                             a new Ch 9 chaos scenario) — the loop only closes if\n' +
      '                                             fixes land back in the system.\n' +
      'Treating chaos engineering as separate from   A chaos experiment (Ch 9) should validate assumptions\n' +
      'the SLO/alerting layer                      the SLO (Ch 7) and alerting (Ch 8) layers depend on —\n' +
      '                                             disconnected, they test nothing real.\n' +
      'No single person/team owns the whole loop     Someone must own the end-to-end platform coherence, or\n' +
      '                                             each layer optimizes locally while the loop as a whole\n' +
      '                                             quietly breaks at the seams between layers.</code></pre>' +
      '<p><b>The real test:</b> pick any one alert your team receives today — can you trace it backward through every layer (which metric, which ' +
      'SLO, which burn-rate rule) and forward through every layer (which runbook, which IC, which postmortem system) without hitting a gap where ' +
      'the connection is "someone just knows"?</p>',
      try: [
        ['📡 Ch 9 — chaos engineering for bare-metal & HPC systems', '#ch9', 'o'],
        ['📡 Ch 7 — SLOs & error budgets for infrastructure teams', '#ch7', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, the production operations platform is a single <b>closed-loop control system</b>, not a collection of tools: signal ' +
      'collection feeds detection, detection feeds decision (SLO/alerting), decision feeds action (on-call/automation/chaos), and action outcomes ' +
      'feed back into the next round of signal collection and detection design via the postmortem. Every chapter in this part is a component of ' +
      'that loop; the platform fails not when one component is missing but when the loop does not actually close — when a lesson from an ' +
      'incident does not measurably change what gets collected, alerted on, or tested next time.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Walk me through your on-call setup, end to end.\n' +
      'A: [Answer should trace the full loop: metrics/logs/traces collection -> anomaly/burn-rate detection\n' +
      '   -> deduplicated, escalation-aware alerting -> on-call response guided by a runbook, automated\n' +
      '   where safe -> incident command for anything beyond routine -> a blameless postmortem whose action\n' +
      '   items land back in specific subsystems (new detectors, new SLOs, new chaos experiments).]\n\n' +
      'Q: Why sequence building a production-ops platform by dependency order instead of building every\n' +
      'capability simultaneously?\n' +
      'A: Later layers (SLOs, alerting, chaos, automation) depend on earlier ones (collection, analysis)\n' +
      '   actually working — building everything at once with no working foundation stalls the whole\n' +
      '   platform rather than shipping any layer well.\n\n' +
      'Q: Why should a new subsystem proposal (e.g. a tracing rollout) explain its integration with existing\n' +
      'logs, metrics, and alerting rather than standing alone?\n' +
      'A: A platform component designed in isolation from the rest of the loop does not actually plug into\n' +
      '   detection or alerting, and cannot benefit from or contribute to the feedback loop the rest of the\n' +
      '   platform relies on.\n\n' +
      'Q: What does it mean for a postmortem\'s action items to "close the loop"?\n' +
      "A: Each action item should land back in a specific platform layer — a new anomaly detector, a\n" +
      '   revised SLO, a new chaos scenario — so the lesson measurably changes what the platform collects,\n' +
      '   alerts on, or tests, not just get filed as a standalone task.\n\n' +
      'Q: How do you know if your production-ops platform is actually a closed loop rather than a collection\n' +
      'of disconnected tools?\n' +
      'A: Pick any alert and trace it backward (metric -> SLO -> burn rate) and forward (runbook -> IC ->\n' +
      '   postmortem) without hitting a point where the connection only exists as undocumented tribal\n' +
      '   knowledge.</code></pre>',
      try: [
        ['📖 Google SRE Book — Table of Contents', 'https://sre.google/sre-book/table-of-contents/', 'o'],
        ['📖 Google SRE Workbook — Table of Contents', 'https://sre.google/workbook/table-of-contents/', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should a production operations platform be built in dependency order (collection, then analysis/governance, then alerting/ops) rather than all sixteen capability areas at once?',
      opts: [
        'Building in order is a regulatory requirement',
        'Later layers like SLOs, alerting, chaos, and automation depend on earlier layers like metrics/logs collection actually working — building everything simultaneously with no working foundation stalls the whole effort',
        'It is always cheaper to build sequentially',
        'Order does not actually matter for platform design'],
      ok: 1,
      why: 'Each layer of the platform depends on the ones below it functioning correctly; without working collection and analysis, alerting and automation have nothing reliable to act on, so building in dependency order avoids stalling on all fronts at once.' },
    { q: 'What does it mean for a postmortem\'s action items to "close the loop" in the reference architecture?',
      opts: [
        'The postmortem document is filed and archived',
        'Each action item lands back in a specific platform layer (a new detector, a revised SLO, a new chaos scenario) so the lesson measurably changes what the platform does going forward',
        'The incident channel is closed after the meeting',
        'Action items are assigned to the on-call engineer only'],
      ok: 1,
      why: 'A closed loop means the outcome of an incident actually changes the system — new detection, new tests, revised targets — rather than the lesson existing only as a document nobody references again.' },
    { q: 'Why should a new subsystem proposal (e.g. adding distributed tracing) explain how it integrates with existing logs, metrics, and alerting rather than being designed in isolation?',
      opts: [
        'Integration documentation is only needed for security review',
        'A component designed in isolation cannot plug into the existing detection and alerting loop, so it fails to benefit from or contribute to the platform\'s feedback loop',
        'It has no bearing on whether the proposal is approved',
        'New subsystems should always replace existing ones rather than integrate'],
      ok: 1,
      why: 'The reference architecture is one connected loop; a new piece designed without regard to how it correlates with existing signals and alerts becomes a silo that does not strengthen the overall system.' }
  ]
};
