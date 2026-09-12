/* linux-hpc-security Learn — Part 5 · Chapter 5: Anomaly Detection for Infrastructure Telemetry */
window.CH[5] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A fixed threshold ("page me if CPU > 90%") misses the slow memory leak that creeps from 40% to 85% over three weeks — never crossing ' +
      'the line, just slowly getting worse until it falls off a cliff. It also misses the server quietly "beaconing" to a command-and-control ' +
      'host every 60 seconds at a volume too small to trip any raw-traffic alert. <b>Anomaly detection</b> compares telemetry to its own recent ' +
      'normal, so "different from itself" catches what "over a fixed line" cannot.</p>' +
      '<pre><code>Fixed threshold: alert if x > 90        Baseline-relative: alert if x is far from ITS OWN recent normal\n' +
      '  misses slow drift, misses          catches a leak (drift), a beacon (low-volume/regular), a\n' +
      '  low-and-slow patterns               spike relative to a quiet baseline even if still < 90</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A doctor tracking your personal baseline vs. one universal "normal" ' +
      'range.</b> A resting heart rate of 95 is unremarkable for one person and alarming for another whose baseline is 55 — a good doctor tracks ' +
      'the individual\'s trend, not just a population-wide cutoff.</p></div>',
      try: [
        ['📖 Google SRE Workbook — anomaly detection primer', 'https://sre.google/workbook/monitoring/', 'o'],
        ['📡 Ch 1 — fleet-wide observability: node_exporter & eBPF metrics', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A simple, effective baseline is a <b>rolling mean and standard deviation</b>: flag a value more than N standard deviations from the ' +
      'recent rolling mean. In PromQL, this can be built directly from existing metrics without a separate ML pipeline; more sophisticated ' +
      'setups use seasonal decomposition or a dedicated model, but the rolling z-score is the workhorse for infrastructure telemetry.</p>' +
      '<pre><code># PromQL: flag when current value is > 3 std-devs from the 1h rolling mean\n' +
      'abs(node_memory_MemAvailable_bytes - avg_over_time(node_memory_MemAvailable_bytes[1h]))\n' +
      '  > 3 * stddev_over_time(node_memory_MemAvailable_bytes[1h])\n\n' +
      '# PromQL: a slow leak — memory trending down steadily over 6h (linear regression slope)\n' +
      'predict_linear(node_memory_MemAvailable_bytes[6h], 6*3600) < 0\n\n' +
      "# a beaconing pattern: near-constant-interval outbound connections at low volume\n" +
      "# (regularity, not volume, is the signal — a fixed threshold on bytes/sec would miss this)\n" +
      'stddev_over_time(rate(node_network_transmit_packets_total[5m])[1h:5m]) < 0.5</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard approach for infra telemetry is a <b>rolling statistical ' +
      'baseline</b> (mean/stddev, or a linear-regression trend for slow drift) computed directly in Prometheus via <code>avg_over_time</code> / ' +
      '<code>stddev_over_time</code> / <code>predict_linear</code> — matching the zero-dependency approach this repo\'s ' +
      '<code>encrypted-anomaly</code> module uses. Dedicated ML-based anomaly detection is reserved for signals too complex for a rolling ' +
      'baseline to capture well.</p></div>',
      try: [
        ['📖 Prometheus — query functions reference', 'https://prometheus.io/docs/prometheus/latest/querying/functions/', 'o'],
        ['📖 Prometheus — predict_linear() function', 'https://prometheus.io/docs/prometheus/latest/querying/functions/#predict_linear', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A rolling-baseline detector catching a memory leak three weeks early.</b> ' +
      'A service\'s memory usage climbs 1.5% per day — invisible against a 90% fixed threshold for weeks. A <code>predict_linear</code>-based ' +
      'alert on the trend fires after three days of consistent drift, giving the team time to schedule a fix during business hours instead of ' +
      'firefighting an OOM-kill cascade at 2am three weeks later.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Flagging a beaconing pattern in encrypted-traffic flow data.</b> A ' +
      'compromised host makes small, suspiciously regular outbound connections every 60 seconds — too low-volume to trip a bandwidth alert, but ' +
      'the near-zero variance in connection timing (low <code>stddev_over_time</code> on inter-connection interval) is itself the anomaly, ' +
      'because real user traffic is irregular and beacon traffic is not.</p></div>' +
      '<p><b>Tuning sensitivity is a tradeoff you must own explicitly:</b> a 2-sigma threshold catches more real anomalies but also more noise; a ' +
      '4-sigma threshold cuts noise but misses subtler drift — there is no universally correct number, only a number tuned against your actual ' +
      'false-positive tolerance and reviewed periodically as the baseline itself shifts.</p>',
      try: [
        ['📡 Ch 6 — fraud & circumvention detection pipelines at scale', '#ch6', 'o'],
        ['📖 Prometheus — recording rules (precompute expensive baselines)', 'https://prometheus.io/docs/prometheus/latest/configuration/recording_rules/', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Fixed thresholds only                       Add rolling-baseline (mean/stddev or trend) detection\n' +
      '                                             for signals with slow drift or low-and-slow patterns a\n' +
      '                                             fixed line cannot see.\n' +
      'One sigma threshold for every metric          Tune sensitivity per metric against actual false-\n' +
      '                                             positive tolerance — noisy metrics need a wider band\n' +
      '                                             than stable ones.\n' +
      'Baseline computed over too short a window     A 5-minute rolling window cannot see a leak that plays\n' +
      '                                             out over 6 hours — match the window to the timescale of\n' +
      '                                             the pattern you are trying to catch.\n' +
      'No seasonal awareness                         A metric with a daily/weekly cycle (batch job load,\n' +
      '                                             business-hours traffic) needs a seasonally-aware\n' +
      '                                             baseline, or every cycle peak trips a false alarm.\n' +
      'Alerting on volume only for beacon detection  Beaconing is often defined by REGULARITY (low variance\n' +
      '                                             in timing), not volume — a low-and-slow beacon can be\n' +
      '                                             invisible to a bytes/sec threshold.\n' +
      'Anomaly alerts with no accompanying context    Attach the baseline value and the deviation, not just\n' +
      '                                             "anomaly detected" — an on-call engineer needs the\n' +
      '                                             comparison, not just the verdict.</code></pre>' +
      '<p><b>The real test:</b> would your current alerting catch a metric that drifts 2% worse every single day for three weeks — or does it ' +
      'only fire once that drift finally crosses a fixed line someone picked a year ago?</p>',
      try: [
        ['📖 Prometheus — best practices for alerting', 'https://prometheus.io/docs/practices/alerting/', 'o'],
        ['📡 Ch 8 — alerting design: paging, escalation & noise reduction', '#ch8', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, anomaly detection for infrastructure telemetry is a <b>signal-shape</b> problem: the same underlying issue (a leak, a ' +
      'beacon, a slow degradation) produces a different statistical signature — drift, low variance, seasonal deviation — and a detector tuned ' +
      'for one shape will not catch another. The discipline is choosing the right statistical lens per signal class, not finding one universal ' +
      'anomaly algorithm; and every detector\'s sensitivity is a standing bet against your team\'s actual tolerance for false pages (Ch 8).</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why does a fixed threshold (e.g. "CPU > 90%") fail to catch a slow memory leak?\n' +
      'A: The leak never crosses the fixed line until it is nearly fatal — a rolling-baseline or trend-based\n' +
      '   detector (e.g. predict_linear) catches the drift days or weeks earlier by comparing the metric to\n' +
      '   its own recent trajectory.\n\n' +
      'Q: How would you detect a low-volume beaconing pattern that a bandwidth threshold would miss?\n' +
      'A: Look at the REGULARITY of connection timing (low variance in inter-connection interval), not\n' +
      '   volume — real traffic is irregular, beacon traffic is suspiciously uniform.\n\n' +
      'Q: Why does the rolling-baseline window size matter?\n' +
      'A: The window must be at least as long as the timescale of the pattern you want to catch — a\n' +
      '   5-minute window cannot see a leak that plays out over 6 hours.\n\n' +
      'Q: Why is a fixed anomaly-detection sensitivity (e.g. always 3-sigma) a mistake across all metrics?\n' +
      'A: Different metrics have different natural variance; one sensitivity setting either drowns a stable\n' +
      "   metric's real anomalies in noise or drowns a noisy metric's alert channel in false positives.\n\n" +
      'Q: What context should an anomaly alert carry beyond "anomaly detected"?\n' +
      'A: The baseline value and the size/direction of the deviation — an on-call engineer needs the\n' +
      '   comparison to judge severity, not just a boolean verdict.</code></pre>',
      try: [
        ['📖 Google SRE Book — Monitoring Distributed Systems', 'https://sre.google/sre-book/monitoring-distributed-systems/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why does a fixed threshold like "alert if CPU > 90%" fail to catch a slow memory leak that climbs steadily over three weeks?',
      opts: [
        'Fixed thresholds cannot be applied to memory metrics at all',
        'The leak never crosses the fixed line until it is nearly fatal, while a rolling-baseline or trend-based detector catches the drift far earlier by comparing to recent trajectory',
        'Memory leaks do not produce measurable metrics',
        'Fixed thresholds only work for network metrics'],
      ok: 1,
      why: 'A slow, steady drift can stay under any fixed threshold for a long time; comparing the metric to its own recent baseline or trend (e.g. via predict_linear) surfaces the problem much earlier.' },
    { q: 'How is a low-volume "beaconing" pattern typically distinguished from normal traffic?',
      opts: [
        'By its high bandwidth usage, which trips a volume threshold',
        'By unusually regular timing (low variance in the interval between connections) rather than by volume',
        'It cannot be distinguished from normal traffic using metrics alone',
        'By checking if the destination IP is on a public blocklist'],
      ok: 1,
      why: 'Beaconing traffic is often low-volume but highly regular in timing; real user/application traffic tends to be irregular, so low variance in connection interval is the anomaly signal, not raw byte counts.' },
    { q: 'Why does the size of the rolling window used for baseline computation matter for anomaly detection?',
      opts: [
        'It does not matter — any window size will catch any anomaly',
        'The window must be at least as long as the timescale of the pattern you are trying to catch, or slower patterns like a multi-hour leak will not register as a deviation',
        'Larger windows always produce more false positives',
        'Window size only affects storage cost, not detection accuracy'],
      ok: 1,
      why: 'A rolling window shorter than the pattern\'s timescale never captures enough history to see the drift — a 5-minute window cannot reveal a leak that unfolds over 6 hours.' }
  ]
};
