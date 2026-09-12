/* linux-hpc-security Learn — Part 5 · Chapter 7: SLOs & Error Budgets for Infrastructure Teams */
window.CH[7] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>"The cluster should be up" sounds like a goal, but it does not tell anyone what to actually do differently on a Tuesday. "The cluster ' +
      'must be schedulable for 99.9% of the time in a rolling 30 days, and we have 43 minutes of downtime budget left this month" tells the team ' +
      'exactly when to slow down and hardened instead of shipping the risky change. That is the difference between a slogan and an <b>SLO</b> ' +
      '(Service Level Objective) with an <b>error budget</b>.</p>' +
      '<pre><code>"Be reliable" (a vibe)   →   99.9% availability over 30 days (a number)   →   43min budget left (a decision tool)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A household monthly budget vs. "try not to spend too much".</b> "Try not ' +
      'to spend too much" gives no signal about when to actually stop; "you have $80 left for the rest of the month" tells you precisely when to ' +
      'stop eating out and start cooking at home.</p></div>',
      try: [
        ['📖 Google SRE Book — Service Level Objectives', 'https://sre.google/sre-book/service-level-objectives/', 'o'],
        ['📡 Ch 1 — fleet-wide observability: node_exporter & eBPF metrics', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>An <b>SLI</b> (indicator) is the measured metric (e.g. fraction of scrape targets up); an <b>SLO</b> (objective) is the target ' +
      '(99.9% over 30 days); the <b>error budget</b> is <code>1 - SLO</code> of allowed unreliability (0.1% of 30 days ≈ 43 minutes). ' +
      '<b>Burn rate</b> measures how fast you are spending that budget relative to a sustainable pace.</p>' +
      '<pre><code># PromQL: SLI — fraction of nodes reporting healthy (up) over the last 30 days\n' +
      'avg_over_time(up{job="node"}[30d])\n\n' +
      '# error budget remaining, as a fraction, for a 99.9% SLO over 30 days\n' +
      '(0.999 - avg_over_time(up{job="node"}[30d])) / (1 - 0.999)\n\n' +
      "# burn-rate alert: consuming budget fast enough to exhaust it in <2h if it continues\n" +
      '(1 - avg_over_time(up{job="node"}[1h])) / (1 - 0.999) > 14.4   # a common multi-window burn-rate alert threshold</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard framework is the <b>Google SRE</b> SLO/error-budget model, ' +
      'implemented as Prometheus recording rules computing SLI ratios and <b>multi-window, multi-burn-rate alerts</b> (fast-burn over 1h + slow-' +
      'burn over 6h, both required, to reduce false pages) — the standard way SRE teams turn a reliability target into an actionable page.</p></div>',
      try: [
        ['📖 Google SRE Workbook — implementing SLOs', 'https://sre.google/workbook/implementing-slos/', 'o'],
        ['📖 Google SRE Workbook — alerting on SLOs (multi-window burn rate)', 'https://sre.google/workbook/alerting-on-slos/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Defining an SLO for a shared HPC/compute service.</b> "The cluster is ' +
      'up" is meaningless when 200 nodes exist — the team instead defines the SLI as the fraction of the cluster\'s total core-hours actually ' +
      'schedulable, sets a 99.5% SLO over 30 days (allowing for planned maintenance and rolling failures), and now has a number that reflects ' +
      'partial degradation instead of a binary up/down that hides a 40-node outage inside "the cluster is technically up".</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A burn-rate alert catching a budget-eating regression.</b> A deploy ' +
      'introduces a subtle scheduling bug that fails 2% of job submissions — not enough to trip a simple "error rate > 10%" threshold, but a ' +
      'multi-window burn-rate alert fires because at that rate the entire month\'s error budget would be exhausted in 18 hours, well before the ' +
      'raw error-rate threshold would ever trigger.</p></div>' +
      '<p><b>The error-budget conversation is the actual point:</b> when the budget for the month is nearly gone, the SLO gives the team explicit ' +
      'authority to say "no" to a risky rollout and prioritize reliability work instead — without an error budget, that conversation is just an ' +
      'opinion versus another opinion.</p>',
      try: [
        ['📖 Google SRE Workbook — error budget policy', 'https://sre.google/workbook/error-budget-policy/', 'o'],
        ['📡 Ch 8 — alerting design: paging, escalation & noise reduction', '#ch8', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'A binary "up/down" SLO for a multi-node      Define the SLI as a fraction (e.g. schedulable\n' +
      'shared service                              core-hours), not a binary — partial degradation of a\n' +
      '                                             200-node cluster is not "down", but it is not fine\n' +
      '                                             either.\n' +
      'Alerting on raw error-rate threshold only     Add multi-window, multi-burn-rate alerts — a steady\n' +
      '                                             2% error rate can exhaust a monthly budget in hours\n' +
      '                                             while staying under a naive threshold.\n' +
      '100% as the target SLO                        A 100% SLO is nearly always the wrong target — it\n' +
      '                                             costs enormously more to approach and leaves zero\n' +
      '                                             budget for planned risk (deploys, migrations).\n' +
      'Error budget tracked but never enforced       An error budget with no policy attached (e.g. "budget\n' +
      '                                             exhausted → freeze risky rollouts") is just a metric,\n' +
      '                                             not a governance tool.\n' +
      'SLO set once and never revisited               Review SLOs periodically against actual user/business\n' +
      '                                             tolerance — a target set at launch may be stricter or\n' +
      '                                             looser than what is actually needed years later.\n' +
      'One SLO for a service with very different       Different consumers of the same service (interactive\n' +
      'usage patterns                              vs. batch) may need different SLOs — one number can\n' +
      '                                             over- or under-serve either.</code></pre>' +
      '<p><b>The real test:</b> when your error budget is nearly exhausted, does anything in your process actually change — or is the number ' +
      'tracked on a dashboard that nobody consults before shipping the next risky change?</p>',
      try: [
        ['📖 Google SRE Workbook — SLO engineering case studies', 'https://sre.google/workbook/table-of-contents/', 'o'],
        ['📡 Ch 12 — capacity planning for compute clusters', '#ch12', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, SLOs and error budgets are a <b>decision mechanism</b>, not a reporting metric — their entire value is in converting ' +
      'a subjective "is this risky enough to pause for" argument into an objective, pre-agreed number that both engineering and product can act ' +
      'on without relitigating the tradeoff every time. A 100% target is not just unrealistic; it is actively harmful, because it eliminates the ' +
      'budget for the planned risk (deploys, migrations, chaos experiments) that reliability work itself depends on.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is "the cluster is up" a poor SLO for a 200-node shared compute service?\n' +
      'A: It is binary and hides partial degradation — 40 nodes down out of 200 is a real problem that a\n' +
      '   binary up/down SLI does not capture; a fractional SLI (e.g. schedulable core-hours) does.\n\n' +
      'Q: Why is a 100% reliability target usually the wrong SLO?\n' +
      'A: It costs disproportionately more to approach 100% and leaves zero error budget for planned risk\n' +
      '   like deploys and migrations — some unreliability budget is necessary for the system to evolve.\n\n' +
      'Q: What does a multi-window, multi-burn-rate alert catch that a raw error-rate threshold misses?\n' +
      'A: A steady, moderate error rate (e.g. 2%) that stays under a naive threshold but would exhaust the\n' +
      "   entire monthly error budget in hours — burn-rate alerting ties the alert to budget consumption\n" +
      '   speed, not just instantaneous error rate.\n\n' +
      'Q: What makes an error budget useful beyond being a tracked number?\n' +
      'A: A policy attached to it — e.g. "budget exhausted → freeze risky rollouts, prioritize reliability\n' +
      '   work" — that gives the team pre-agreed authority to say no, instead of relitigating the tradeoff\n' +
      '   every time.\n\n' +
      'Q: Why might a single service need different SLOs for different consumers?\n' +
      'A: Interactive and batch consumers of the same service may have very different latency/availability\n' +
      '   tolerances — one SLO number risks over-engineering for one and under-serving the other.</code></pre>',
      try: [
        ['📖 Google SRE Book — Service Level Objectives', 'https://sre.google/sre-book/service-level-objectives/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is a binary "the cluster is up/down" SLI a poor fit for a 200-node shared compute service?',
      opts: [
        'Binary SLIs cannot be computed with Prometheus',
        'It hides partial degradation — 40 out of 200 nodes being down is a real problem that a binary up/down measure does not reflect',
        'Binary SLIs are only usable for single-node services',
        'It requires more storage than a fractional SLI'],
      ok: 1,
      why: 'A fractional SLI (e.g. the percentage of schedulable core-hours) captures partial degradation of a multi-node service; a binary up/down SLI cannot distinguish "fully healthy" from "60% degraded but technically responding".' },
    { q: 'Why is targeting a 100% SLO usually the wrong choice for a service?',
      opts: [
        'It is technically impossible to measure',
        'It costs disproportionately more to approach 100% reliability and leaves no error budget for planned risk like deploys and migrations',
        '100% SLOs are illegal under most compliance frameworks',
        'Prometheus cannot alert on a 100% target'],
      ok: 1,
      why: 'Approaching 100% reliability has steeply increasing marginal cost, and a 100% target leaves zero budget for the planned risk (deploys, upgrades, chaos experiments) that keeps a system evolving and resilient.' },
    { q: 'What does a multi-window, multi-burn-rate alert catch that a simple fixed error-rate threshold misses?',
      opts: [
        'Nothing — they catch exactly the same conditions',
        'A moderate, steady error rate that stays under a fixed threshold but would exhaust the entire error budget for the period much sooner than expected',
        'Burn-rate alerts only work for latency metrics, not error rates',
        'Multi-window alerts eliminate the need for any error budget'],
      ok: 1,
      why: 'Burn-rate alerting ties the alert condition to how fast the error budget is being consumed relative to a sustainable pace, catching sustained moderate degradation that a raw threshold set for acute spikes would miss.' }
  ]
};
