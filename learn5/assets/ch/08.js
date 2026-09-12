/* linux-hpc-security Learn — Part 5 · Chapter 8: Alerting Design: Paging, Escalation & Noise Reduction */
window.CH[8] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>An on-call engineer who gets paged forty times a night for things that fix themselves in five minutes stops trusting the pager — and ' +
      'starts sleeping through the one page that actually matters. <b>Alerting design</b> is not "alert on everything that could be wrong"; it is ' +
      'deciding, deliberately, what is worth waking a human up for, and building the escalation path for when that human does not respond.</p>' +
      '<pre><code>Alert on every metric blip   →   alert fatigue   →   the real incident gets ignored\n' +
      '  (40 pages/night, most self-resolve)   (pager gets muted)   (the one page that mattered is lost in noise)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A smoke detector that goes off every time you make toast.</b> Eventually ' +
      'you take the battery out — and then miss the fire that actually happens. A well-tuned alert is a smoke detector that reliably ignores ' +
      'toast and reliably catches smoke.</p></div>',
      try: [
        ['📖 Google SRE Book — Being On-Call', 'https://sre.google/sre-book/being-on-call/', 'o'],
        ['📡 Ch 7 — SLOs & error budgets for infrastructure teams', '#ch7', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Effective alerting has three layers: <b>deduplication</b> (one incident, one page — not one page per affected node), an ' +
      '<b>escalation policy</b> (if the primary on-call does not acknowledge in N minutes, page the secondary, then the manager), and rules that ' +
      'page on <b>symptoms that matter to users</b> (burn rate, Ch 7) rather than every internal cause.</p>' +
      '<pre><code># Prometheus Alertmanager: group alerts by cluster so one bad rollout across 50 nodes = ONE page\n' +
      'route:\n' +
      "  group_by: ['alertname', 'cluster']\n" +
      '  group_wait: 30s\n' +
      '  group_interval: 5m\n' +
      '  repeat_interval: 4h\n' +
      '  receiver: primary-oncall\n' +
      '  routes:\n' +
      '    - match:\n' +
      '        severity: critical\n' +
      '      receiver: primary-oncall\n' +
      '      continue: true\n\n' +
      '# an escalation chain: primary -> secondary after 10min unacked -> manager after 20min\n' +
      'receivers:\n' +
      '  - name: primary-oncall\n' +
      '    pagerduty_configs: [{routing_key: "primary-key"}]</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard stack is <b>Prometheus Alertmanager</b> for grouping/routing/' +
      'silencing, paired with an escalation tool like <b>PagerDuty</b> or <b>Opsgenie</b> for the acknowledge → escalate → notify chain — the ' +
      'grouping and multi-window burn-rate patterns from Ch 7 plug directly into this layer.</p></div>',
      try: [
        ['📖 Prometheus Alertmanager — configuration', 'https://prometheus.io/docs/alerting/latest/configuration/', 'o'],
        ['📖 PagerDuty — incident response documentation', 'https://support.pagerduty.com/main/docs/incident-response', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A paging policy tied to burn-rate, not raw thresholds.</b> Switching ' +
      'from "page if error rate > 5%" to a multi-window burn-rate alert (Ch 7) cuts a team\'s pages by 70% while catching the one slow-burning ' +
      'regression that the old threshold-based rule would have missed entirely — fewer pages, better coverage, because the new rule pages on ' +
      '"budget at risk", not "metric moved".</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>An escalation chain for a follow-the-sun NOC.</b> A page sent at 3am in ' +
      'one region routes to the currently-daytime region\'s NOC first, escalating to the local on-call only if the follow-the-sun team cannot ' +
      'resolve it — reducing 3am wakeups without reducing incident coverage, because someone is always awake somewhere in the chain.</p></div>' +
      '<p><b>An alert-fatigue audit is a recurring discipline, not a one-time fix:</b> reviewing every page from the last quarter and asking ' +
      '"did this require a human, right now, to take an action that automation could not" routinely finds 30-50% of pages that should be demoted ' +
      'to a ticket, a dashboard, or removed entirely.</p>',
      try: [
        ['📖 Google SRE Book — Effective Troubleshooting (alert design)', 'https://sre.google/sre-book/effective-troubleshooting/', 'o'],
        ['📡 Ch 10 — on-call & incident response for infrastructure teams', '#ch10', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'One page per affected node                  Group alerts by incident (alertname + cluster/service) so\n' +
      '                                             a rollout hitting 50 nodes pages once, not 50 times.\n' +
      'Paging on every internal cause                Page on user-facing symptoms / burn rate (Ch 7); route\n' +
      '                                             internal-cause alerts to a ticket/dashboard instead.\n' +
      'No escalation path if primary is unresponsive Define an explicit ack-timeout → secondary → manager\n' +
      '                                             chain — a page nobody acknowledges is worse than no\n' +
      '                                             page.\n' +
      'Alert thresholds never revisited              Run a periodic alert-fatigue audit: for every page in\n' +
      '                                             the last quarter, ask if it required immediate human\n' +
      '                                             action — demote or delete the ones that did not.\n' +
      'Every alert has the same severity/urgency      Distinguish "page now" from "ticket for business hours"\n' +
      '                                             from "dashboard only" — treating everything as urgent\n' +
      '                                             trains people to treat nothing as urgent.\n' +
      'Silences left in place indefinitely           Time-box silences and audit stale ones — a silence from\n' +
      '                                             a resolved incident six months ago may be hiding a real\n' +
      '                                             new alert today.</code></pre>' +
      '<p><b>The real test:</b> if you audited every page from the last 90 days, what fraction actually required a human to take an action right ' +
      'then — and would your on-call engineers guess a much lower number than the audit finds?</p>',
      try: [
        ['📖 Google SRE Book — Monitoring Distributed Systems (symptom vs. cause)', 'https://sre.google/sre-book/monitoring-distributed-systems/', 'o'],
        ['📡 Ch 11 — runbook automation & self-healing remediation', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, alerting design is a <b>trust-budget</b> problem: every unnecessary page spends down the on-call engineer\'s trust in ' +
      'the pager, and that trust, once spent, does not come back by simply reducing volume — it comes back only by consistently paging on things ' +
      'that turned out to matter. The discipline is symptom-based alerting (page on what the user/SLO feels) layered with cause-based diagnosis ' +
      '(surfaced in the incident, not the page) plus an escalation chain that assumes any single human can be unreachable.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why should alerts be grouped by incident rather than firing one page per affected node?\n' +
      'A: A single rollout or outage hitting 50 nodes is one incident, not 50 — grouping keeps the signal-to-\n' +
      '   noise ratio high and prevents the pager from training people to ignore bursts of pages.\n\n' +
      'Q: Why prefer paging on symptoms (burn rate, user-facing SLO impact) over paging on every internal\n' +
      'cause?\n' +
      'A: Not every internal anomaly requires immediate human action; symptom-based paging keeps pages tied\n' +
      '   to actual user/business impact, while cause-level detail belongs in the incident investigation,\n' +
      '   not the initial page.\n\n' +
      'Q: What is the purpose of an alert-fatigue audit?\n' +
      'A: To periodically review whether past pages actually required immediate human action — pages that\n' +
      "   didn't should be demoted to tickets/dashboards or removed, since unnecessary pages erode trust in\n" +
      '   the pager and make real incidents easier to miss.\n\n' +
      'Q: Why does an escalation policy need more than one level (just primary on-call)?\n' +
      'A: A single point of failure in the human chain (primary asleep, phone dead) means an incident with\n' +
      '   no escalation policy can go unaddressed indefinitely — a timed ack → secondary → manager chain\n' +
      '   ensures someone eventually responds.\n\n' +
      'Q: Why is trust in the paging system hard to rebuild once eroded by alert fatigue?\n' +
      'A: On-call engineers learn from experience which pages matter; rebuilding trust requires a sustained\n' +
      '   track record of pages that were genuinely actionable, not just a one-time reduction in volume.</code></pre>',
      try: [
        ['📖 Google SRE Workbook — alerting on SLOs', 'https://sre.google/workbook/alerting-on-slos/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should Alertmanager group alerts by incident (e.g. alertname + cluster) rather than sending one page per affected node?',
      opts: [
        'Grouping reduces the accuracy of alerting',
        'A single incident affecting 50 nodes should page once, not 50 times — ungrouped paging trains on-call engineers to ignore bursts of alerts',
        'Prometheus does not support ungrouped alerts',
        'Grouping is only useful for low-severity alerts'],
      ok: 1,
      why: 'Grouping keeps signal-to-noise high: one rollout or outage across many nodes is one incident and should generate one actionable page, not a flood that trains people to tune out the pager.' },
    { q: 'What is the main goal of a periodic alert-fatigue audit?',
      opts: [
        'To increase the total number of alerts configured',
        'To review past pages and determine which ones actually required immediate human action, demoting or removing the rest',
        'To replace all paging with dashboards',
        'To eliminate the need for an escalation policy'],
      ok: 1,
      why: 'An alert-fatigue audit finds pages that did not need immediate human action and reroutes or removes them, preserving the pager\'s value for alerts that genuinely matter.' },
    { q: 'Why does an escalation policy need more than just the primary on-call engineer?',
      opts: [
        'It does not — a single on-call contact is always sufficient',
        'A single point of failure in the human chain (unreachable or asleep) could leave an incident unaddressed indefinitely; a timed ack-to-escalate chain ensures someone eventually responds',
        'Escalation policies are only required for SEV1 incidents',
        'Multiple on-call contacts are needed only for compliance reasons'],
      ok: 1,
      why: 'A page nobody acknowledges is worse than no page — an escalation chain (secondary, then manager, after a timeout) guarantees the incident eventually reaches someone able to act.' }
  ]
};
