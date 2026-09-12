/* linux-hpc-security Learn — Part 5 · Chapter 12: Capacity Planning for Compute Clusters */
window.CH[12] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Nobody notices the cluster is running out of room until jobs start queuing for days and someone finally looks at a utilization graph ' +
      'that has been climbing steadily for six months. By then, procuring and racking new nodes takes longer than the runway you have left. ' +
      '<b>Capacity planning</b> is reading that same graph three months earlier and ordering hardware before the queue backs up, not after.</p>' +
      '<pre><code>Notice the cluster is full when jobs start queuing  →  forecast the trend, order hardware\n' +
      '  (too late — procurement lead time > runway left)      months before you actually run out</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Watching a gas gauge on a long road trip vs. running out on the ' +
      'highway.</b> A driver who checks the gauge and does the math ("at this rate, I have 40 miles left, the next station is at mile 35") never ' +
      'runs out; one who ignores it until the warning light comes on is already cutting it close.</p></div>',
      try: [
        ['📖 Google SRE Book — Software Engineering in SRE (capacity planning)', 'https://sre.google/sre-book/software-engineering-in-sre/', 'o'],
        ['📡 Ch 7 — SLOs & error budgets for infrastructure teams', '#ch7', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Capacity planning starts from real utilization data — CPU/GPU/memory/storage occupancy from your metrics stack (Ch 1) — projected ' +
      'forward with a trend model, compared against known lead time for procurement, and expressed as "we run out on date X unless we act by ' +
      'date Y".</p>' +
      '<pre><code># PromQL: linear forecast of cluster-wide GPU utilization, 90 days out\n' +
      'predict_linear(avg_over_time(gpu_utilization_ratio[7d])[30d:1d], 90*24*3600)\n\n' +
      '# a simple headroom calculation: days until the cluster is projected to hit 90% utilization\n' +
      "# (used the same predict_linear pattern as Ch 5's anomaly-drift detection, applied to capacity)\n\n" +
      '# node-level utilization query used as the raw input to any capacity model\n' +
      'avg by (rack) (1 - avg_over_time(node_cpu_seconds_total{mode="idle"}[7d]))</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard method is a <b>utilization-trend forecast</b> (linear or ' +
      'seasonal regression on historical Prometheus data) cross-referenced against known procurement lead time, reviewed on a fixed cadence (e.g. ' +
      'quarterly) — the same <code>predict_linear</code> trend math from Ch 5\'s anomaly detection, applied here to plan ahead instead of alert.</p></div>',
      try: [
        ['📖 Prometheus — predict_linear() function', 'https://prometheus.io/docs/prometheus/latest/querying/functions/#predict_linear', 'o'],
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A utilization-trend capacity forecast.</b> A cluster\'s GPU occupancy ' +
      'has grown 4% per month for a year; extrapolating that trend shows the cluster hits 95% utilization (the point where queue times spike ' +
      'sharply) in five months — well within the nine-month lead time for the next procurement cycle, giving the team a clear, evidence-based ' +
      'deadline to submit the budget request instead of guessing.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Right-sizing a shared cluster after a usage-pattern shift.</b> A ' +
      'cluster provisioned for long-running batch jobs sees a shift toward short, bursty interactive workloads; raw utilization percentage looks ' +
      'unchanged, but queue wait times triple because the scheduler is optimized for the old pattern. Capacity planning here means recognizing ' +
      'the workload shape changed, not just that the total volume did — sometimes the fix is scheduler tuning, not more hardware.</p></div>' +
      '<p><b>A capacity-planning review ahead of a budget cycle</b> turns a forecast into a decision: presenting "we run out in 5 months, ' +
      'procurement takes 4" as a concrete number with a concrete deadline gets budget approved far more reliably than "we might need more nodes ' +
      'at some point."</p>',
      try: [
        ['📖 Google SRE Workbook — Capacity Planning', 'https://sre.google/workbook/eliminating-toil/', 'o'],
        ['📡 Ch 9 — chaos engineering for bare-metal & HPC systems', '#ch9', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Noticing capacity problems via job-queue     Forecast utilization trend against known procurement\n' +
      'complaints                                  lead time — the queue backing up is the LATE signal, not\n' +
      '                                             the useful one.\n' +
      'A single "utilization %" metric for              Track CPU, GPU, memory, storage, and network\n' +
      'everything                                  headroom separately — a cluster can be GPU-bound while\n' +
      '                                             CPU sits idle, and one blended number hides that.\n' +
      'Assuming past growth trend continues linearly Revisit the forecast model regularly; a workload-shape\n' +
      'forever                                      change (Scenario B) can break a trend-based forecast\n' +
      '                                             without changing raw utilization numbers.\n' +
      'Capacity requests with no supporting data     Bring the forecast, the procurement lead time, and the\n' +
      '                                             run-out date to the budget conversation — a number beats\n' +
      '                                             an intuition in a budget review.\n' +
      'Ignoring queue-time trends as a leading         Rising queue wait time is often an earlier, more\n' +
      'indicator                                    user-visible signal of a capacity problem than raw\n' +
      '                                             utilization percentage.\n' +
      'Treating capacity planning as a one-time event Review capacity on a fixed cadence (e.g. quarterly),\n' +
      '                                             not only when a crisis forces the conversation.</code></pre>' +
      '<p><b>The real test:</b> can you name the exact date your cluster is projected to run out of headroom right now, with the procurement ' +
      'lead time already factored in — or is "we\'ll deal with it when it happens" still the actual plan?</p>',
      try: [
        ['📖 Google SRE Book — Software Engineering in SRE', 'https://sre.google/sre-book/software-engineering-in-sre/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, capacity planning is a <b>forecast-vs-lead-time race</b>: the only number that matters is whether your projected ' +
      'run-out date is later than your procurement/provisioning lead time, and both halves of that comparison need real data, not intuition. A ' +
      'workload-shape shift can invalidate a trend-based forecast even while aggregate utilization numbers look stable, which is why queue-time ' +
      'trends and per-resource-type headroom (not one blended percentage) are the leading indicators that catch it.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is "the job queue is backing up" a late signal for capacity planning, not a useful one?\n' +
      'A: By the time the queue visibly backs up, the cluster is already saturated — capacity planning\n' +
      "   should forecast the trend and order hardware BEFORE that point, factoring in procurement lead\n" +
      '   time.\n\n' +
      'Q: Why track CPU, GPU, memory, and storage headroom separately instead of one blended utilization\n' +
      'metric?\n' +
      'A: A cluster can be bottlenecked on one resource type (e.g. GPU) while another (CPU) sits idle; a\n' +
      '   single blended number can hide which specific resource is actually running out.\n\n' +
      'Q: How can a workload-shape shift break a capacity forecast even when total utilization looks\n' +
      'stable?\n' +
      'A: A shift from long-running batch jobs to short bursty interactive jobs can spike queue wait times\n' +
      '   without changing raw utilization percentage — the forecast model needs to account for workload\n' +
      '   shape, not just volume.\n\n' +
      'Q: What makes a capacity request more likely to get budget approval?\n' +
      'A: A concrete forecast with a specific projected run-out date, cross-referenced against the known\n' +
      '   procurement lead time — a number and a deadline are far more persuasive than a general sense that\n' +
      '   more hardware will eventually be needed.\n\n' +
      'Q: Why is rising queue wait time often a better leading indicator than raw utilization percentage?\n' +
      'A: Queue time reflects user-visible impact directly and can start rising before aggregate utilization\n' +
      '   crosses any fixed threshold, especially under a changing workload mix.</code></pre>',
      try: [
        ['📖 Google SRE Workbook — Eliminating Toil (capacity)', 'https://sre.google/workbook/eliminating-toil/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is "the job queue is backing up" considered a late signal for capacity planning rather than a useful early one?',
      opts: [
        'Queue backups are unrelated to capacity issues',
        'By the time the queue visibly backs up, the cluster is already saturated — capacity planning should forecast the trend and act before reaching that point',
        'Queue length cannot be measured reliably',
        'It only applies to GPU clusters, not CPU clusters'],
      ok: 1,
      why: 'A visibly backed-up queue means capacity has already run out; effective capacity planning uses trend forecasting to act well before that point, accounting for procurement lead time.' },
    { q: 'Why track CPU, GPU, memory, and storage headroom as separate metrics instead of one blended "utilization" number?',
      opts: [
        'Separate metrics are required by most monitoring tools',
        'A cluster can be bottlenecked on one specific resource (e.g. GPU) while others sit idle, and a single blended number can hide which resource is actually constrained',
        'Blended utilization metrics are always inaccurate',
        'It has no practical benefit over a single number'],
      ok: 1,
      why: 'Different workloads stress different resources; tracking headroom per resource type reveals the actual bottleneck that a single averaged utilization figure would mask.' },
    { q: 'How can a shift in workload shape (e.g. from long batch jobs to short bursty interactive jobs) affect capacity planning even if total utilization stays the same?',
      opts: [
        'It has no effect since total utilization is the only relevant metric',
        'Queue wait times can rise sharply due to the new access pattern even though aggregate utilization percentage looks unchanged, invalidating a simple trend-based forecast',
        'Workload shape changes always reduce total utilization',
        'It only matters for storage capacity, not compute'],
      ok: 1,
      why: 'A workload-shape change can degrade scheduling efficiency and increase queue times without moving the raw utilization number, so capacity forecasts need to account for workload characteristics, not just volume.' }
  ]
};
