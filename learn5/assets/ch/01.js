/* linux-hpc-security Learn — Part 5 · Chapter 1: Fleet-Wide Observability: node_exporter & eBPF Metrics */
window.CH[1] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>One server, you SSH in and run <code>top</code> when something feels wrong. Five thousand servers, you cannot SSH into all of them ' +
      'every time something feels wrong somewhere — you need every node exporting the same numbers, all the time, to one place you can query. ' +
      'That is <b>fleet-wide observability</b>: not "check a box", but "every box already told you before you asked".</p>' +
      '<pre><code>SSH + top, one box at a time   →   every node exports /metrics   →   one query answers\n' +
      '  (does not scale past ~10 boxes)      continuously, scraped centrally     "which of 5,000 nodes is hot?"</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A hospital\'s central monitoring station vs. a nurse checking each ' +
      'patient by hand.</b> Every bed has sensors continuously streaming vitals to one dashboard; nobody walks the ward asking each patient ' +
      'how they feel. The nurse (an engineer) is alerted the instant one patient\'s numbers cross a threshold, without watching all of them ' +
      'constantly.</p></div>',
      try: [
        ['📖 Prometheus — node_exporter', 'https://github.com/prometheus/node_exporter', 'o'],
        ['🐧 Part 1: monitoring & telemetry basics', '../learn/#ch18', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>node_exporter</b> runs on every node and exposes host metrics (CPU, memory, disk, network) as a scrape endpoint; ' +
      '<b>textfile collectors</b> let you add custom metrics (e.g. "did last night\'s job run") without writing a custom exporter. Where ' +
      'node_exporter cannot see deep enough (per-syscall latency, scheduler internals), <b>eBPF-based exporters</b> fill the gap:</p>' +
      '<pre><code># node_exporter exposes metrics on :9100/metrics — Prometheus scrapes it on an interval\n' +
      '$ curl -s localhost:9100/metrics | grep node_load1\n' +
      'node_load1 2.34\n\n' +
      '# textfile collector: any script can drop a .prom file, node_exporter picks it up\n' +
      '$ echo \'lab_last_success_timestamp 1699999999\' > /var/lib/node_exporter/textfile/lab_status.prom\n\n' +
      '# an eBPF exporter surfaces kernel-level detail node_exporter cannot see\n' +
      '$ bpftrace -e \'kprobe:vfs_read { @bytes = hist(retval); }\'   # ad-hoc; a real exporter runs continuously</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard stack is <b><code>node_exporter</code></b> for host ' +
      'metrics, scraped by <b>Prometheus</b>, visualized in <b>Grafana</b> — the same pattern the <code>noc/</code> module in this repo ' +
      'introduces. At fleet scale, add <b>eBPF-based exporters</b> (e.g. bpftrace-driven or a purpose-built collector) for the metrics ' +
      '<code>/proc</code> cannot expose: per-syscall latency histograms, off-CPU time, and TCP retransmit detail at the socket level.</p></div>',
      try: [
        ['📖 Prometheus — scrape configuration', 'https://prometheus.io/docs/prometheus/latest/configuration/configuration/', 'o'],
        ['📖 bpftrace — reference guide', 'https://github.com/bpftrace/bpftrace/blob/master/docs/reference_guide.md', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The metric that was always green until it wasn\'t.</b> A fleet-wide ' +
      'dashboard shows CPU, memory, and disk all nominal on a node right before it falls over — because the actual problem was scheduler ' +
      'latency (Part 2, Ch 1) and softirq starvation, neither of which node_exporter\'s default collectors surface. Fix: add an eBPF-based ' +
      'exporter for scheduling latency and softirq time alongside the standard host metrics — "all green" dashboards are only as good as ' +
      'the metrics they are built from.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The dashboard SLA nobody defined.</b> During an incident, an ' +
      'engineer discovers three nodes have not reported metrics in 40 minutes — Prometheus silently shows the last known (stale) value ' +
      'instead of an obvious gap, and the outage looks smaller than it is. Fix: alert on <code>up == 0</code> and staleness directly (a ' +
      'metric-freshness SLA), not just on the metric values themselves — a monitoring system that cannot tell you it stopped monitoring is a ' +
      'blind spot disguised as a dashboard.</p></div>' +
      '<p><b>Cardinality is a cost, not a nicety:</b> a label like <code>job_id</code> with millions of unique values will blow up ' +
      'Prometheus\'s memory and query latency — fleet-wide metrics need deliberately bounded label sets, with high-cardinality detail (per-' +
      'job) routed to logs or traces instead (Ch 3-4).</p>',
      try: [
        ['📖 Prometheus — instrumentation best practices', 'https://prometheus.io/docs/practices/naming/', 'o'],
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Trusting only /proc-derived host metrics    Add eBPF-based collectors for scheduling latency, softirq\n' +
      '                                             time, and syscall latency that /proc cannot expose.\n' +
      'Unbounded label cardinality (job_id, pid)    Keep fleet-wide metric labels bounded (node, rack, role);\n' +
      '                                             route high-cardinality detail to logs/traces instead.\n' +
      'No alert on "stopped reporting"              Alert on `up == 0` / staleness explicitly — a Prometheus\n' +
      '                                             target that silently stops scraping is a blind spot, not\n' +
      '                                             a green dashboard.\n' +
      'One giant Prometheus with no federation       At fleet scale, shard/federate Prometheus per cluster or\n' +
      '                                             region so one indexer outage does not blind everything.\n' +
      'Dashboards nobody has looked at in months     Prune or fix dead dashboards — an ignored panel is worse\n' +
      '                                             than no panel, because it implies coverage that is not real.\n' +
      'Scrape interval mismatched to the signal      A 60s scrape interval cannot see a 5s latency spike —\n' +
      '                                             match interval to the fastest failure mode you must catch.</code></pre>' +
      '<p><b>The real test:</b> if a node silently stopped exporting metrics right now, would anything page you within minutes — or would ' +
      'the dashboard just quietly go stale until a human noticed by accident?</p>',
      try: [
        ['📖 Prometheus — federation', 'https://prometheus.io/docs/prometheus/latest/federation/', 'o'],
        ['📡 Ch 8 — alerting design: paging, escalation & noise reduction', '#ch8', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, fleet-wide observability is a <b>coverage-completeness</b> problem, not a dashboard-count problem: the question is ' +
      'not "do we have metrics" but "is there any failure mode of this system that would NOT show up in any metric, log, or trace we collect". ' +
      'eBPF-based collectors close the specific gap of kernel-internal behavior that userspace tools cannot see; the discipline of alerting on ' +
      'staleness closes the gap of "the monitoring system itself silently failed".</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A node\'s CPU, memory, and disk metrics are all nominal right before it falls over. What is likely missing?\n' +
      'A: Metrics that /proc-derived collectors like node_exporter do not surface by default — scheduling\n' +
      "   latency, softirq/IRQ time, or per-syscall latency. An eBPF-based exporter closes that gap.\n\n" +
      'Q: Why is unbounded label cardinality (e.g. a `job_id` label with millions of values) dangerous in Prometheus?\n' +
      'A: Every unique label combination creates a new time series, so high-cardinality labels blow up memory\n' +
      '   usage and query latency. High-cardinality detail belongs in logs or traces, not metric labels.\n\n' +
      'Q: Why is alerting only on metric VALUES not sufficient?\n' +
      'A: A node that stops reporting entirely shows as stale, not as an alarming value — without an explicit\n' +
      '   `up == 0` / staleness alert, a monitoring outage can masquerade as "everything is fine".\n\n' +
      'Q: How do you decide the right Prometheus scrape interval for a metric?\n' +
      'A: Match it to the fastest failure mode you need to catch — a 60-second interval cannot detect a\n' +
      '   5-second latency spike; a too-fast interval on a rarely-changing metric wastes storage and query cost.\n\n' +
      'Q: What is the real test of "good" fleet-wide observability coverage?\n' +
      'A: Whether there exists a plausible failure mode that would show up in NONE of your metrics, logs, or\n' +
      '   traces — not how many dashboards or panels exist.</code></pre>',
      try: [
        ['📖 Google SRE Book — Monitoring Distributed Systems', 'https://sre.google/sre-book/monitoring-distributed-systems/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A node\'s CPU, memory, and disk metrics look nominal on a standard dashboard right before it falls over. What is the most likely explanation?',
      opts: [
        'The node failed for a reason unrelated to any measurable metric',
        'The actual problem (e.g. scheduling latency or softirq starvation) is not exposed by /proc-derived collectors like node_exporter, and needs an eBPF-based exporter to see',
        'Prometheus scraped the wrong node by mistake',
        'The dashboard needs to be refreshed manually'],
      ok: 1,
      why: 'Standard host metrics from node_exporter reflect what /proc exposes, which does not include kernel-internal detail like scheduling latency or softirq time. eBPF-based collectors fill that specific gap.' },
    { q: 'Why is an unbounded-cardinality label (e.g. a unique job_id on every metric) a problem in Prometheus?',
      opts: [
        'It is not a problem — Prometheus scales cardinality automatically',
        'Every unique label value combination creates a new time series, so high cardinality blows up memory usage and query latency; high-cardinality detail belongs in logs/traces instead',
        'Labels can only contain numeric values',
        'It causes node_exporter to crash immediately'],
      ok: 1,
      why: 'Prometheus stores a distinct time series per unique label combination. Unbounded cardinality (per-job, per-request IDs) causes memory and query-performance problems at scale — route that detail to logs or traces.' },
    { q: 'Why is alerting only on metric thresholds (not on staleness/`up == 0`) a blind spot?',
      opts: [
        'It is not a blind spot — Prometheus always alerts when a target goes down',
        'A node that stops reporting metrics entirely does not produce an alarming value — without an explicit staleness/up alert, a monitoring outage can look like "everything is fine"',
        'Threshold alerts are more reliable than staleness alerts in all cases',
        'Staleness alerts are only relevant for logs, not metrics'],
      ok: 1,
      why: 'If a scrape target silently stops reporting, its last known values remain visible unless staleness is explicitly alerted on — meaning a monitoring outage can be invisible on a dashboard that only watches values.' }
  ]
};
