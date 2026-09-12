/* linux-hpc-security Learn — Part 5 · Chapter 4: Distributed Tracing for Infrastructure & Batch Pipelines */
window.CH[4] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Metrics (Ch 1) tell you something is slow. Logs (Ch 2) tell you what each component said. Neither tells you, on their own, ' +
      '<i>which of the ten hops a request passed through is the slow one</i> — a batch job that touches a scheduler, a shared filesystem, a ' +
      'database, and three compute stages could be slow at any one of them. <b>Distributed tracing</b> follows one request or job end to end, ' +
      'with timing at every hop, so "it\'s slow somewhere" becomes "it\'s slow at hop 4".</p>' +
      '<pre><code>Request  →  hop1(2ms)  →  hop2(3ms)  →  hop3(1400ms)  →  hop4(4ms)  →  done\n' +
      '                                            ^^^^^^^ the trace makes this hop visible instantly</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A tracked package vs. a package that just "arrives eventually".</b> A ' +
      'tracked shipment shows a timestamp at every depot it passes through, so a three-day delay is instantly traceable to the one depot that ' +
      'held it. Without tracking, all you know is "it took three days" — you have no idea where the time went.</p></div>',
      try: [
        ['📖 OpenTelemetry — what is distributed tracing', 'https://opentelemetry.io/docs/concepts/observability-primer/#distributed-traces', 'o'],
        ['📡 Ch 1 — fleet-wide observability: node_exporter & eBPF metrics', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>OpenTelemetry</b> (OTel) is the standard instrumentation layer: each hop creates a <b>span</b> (an operation with a start time, ' +
      'duration, and tags), spans share a <b>trace ID</b> that ties them into one trace, and a <b>context propagation</b> mechanism carries that ' +
      'trace ID across process/service boundaries (HTTP headers, message queue metadata, or job-scheduler environment variables for batch ' +
      'pipelines).</p>' +
      '<pre><code># Python OpenTelemetry SDK — instrumenting one stage of a batch pipeline\n' +
      'from opentelemetry import trace\n' +
      'tracer = trace.get_tracer("batch.stage3.aggregate")\n\n' +
      'with tracer.start_as_current_span("aggregate_partition") as span:\n' +
      '    span.set_attribute("partition.id", partition_id)\n' +
      '    span.set_attribute("input.rows", len(rows))\n' +
      '    result = aggregate(rows)\n\n' +
      "# propagate trace context into a downstream job via env var (batch schedulers don't have HTTP headers)\n" +
      '$ export TRACEPARENT=$(python -c "from opentelemetry.propagate import inject; c={}; inject(c); print(c[\'traceparent\'])")\n' +
      '$ sbatch --export=TRACEPARENT stage4_job.sh</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard is the <b>OpenTelemetry</b> SDK/protocol (vendor-neutral), ' +
      'exporting spans to a backend like <b>Jaeger</b>, <b>Tempo</b>, or a commercial APM — instrumenting the entry and exit of each pipeline ' +
      'stage, plus any hop that crosses a network or storage boundary, is enough to localize most latency problems without instrumenting every ' +
      'function call.</p></div>',
      try: [
        ['📖 OpenTelemetry — Python instrumentation', 'https://opentelemetry.io/docs/languages/python/instrumentation/', 'o'],
        ['📖 Jaeger — distributed tracing platform', 'https://www.jaegertracing.io/docs/latest/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Tracing a cross-service latency spike to one hop.</b> A ten-stage ' +
      'batch pipeline\'s total runtime doubles overnight; without tracing, the team would have to profile each stage manually. With OTel spans ' +
      'on every stage, the trace shows stage 6 (a shared-filesystem read) jumped from 2s to 90s — pointing straight at a storage contention issue ' +
      'introduced by an unrelated team\'s job sharing the same filesystem, instead of a code regression in stage 6 itself.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A sampling strategy for a high-volume trace pipeline.</b> Tracing ' +
      'every single request in a system doing 50,000 requests/sec would be prohibitively expensive to store and mostly useless — the team adopts ' +
      '<b>tail-based sampling</b> that keeps 100% of traces exceeding a latency threshold or containing an error, and 1% of otherwise-normal ' +
      'traces, giving full visibility into the interesting cases at a fraction of the storage cost.</p></div>' +
      '<p><b>Trace context propagation is the part that breaks silently:</b> if one hop in the chain does not forward the trace context (a ' +
      'batch scheduler, a message queue, a language without an OTel SDK), the trace simply ends there — showing a false "it was fast" instead of ' +
      '"we lost visibility past this point".</p>',
      try: [
        ['📖 OpenTelemetry — sampling', 'https://opentelemetry.io/docs/concepts/sampling/', 'o'],
        ['📡 Ch 1 — fleet-wide observability: node_exporter & eBPF metrics', '#ch1', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Only instrumenting service entry points     Instrument every hop that crosses a network/storage\n' +
      '                                             boundary — the slow hop is often in the middle, not at\n' +
      '                                             the edges.\n' +
      'Trace context silently dropped mid-chain     Verify propagation across every boundary type (HTTP,\n' +
      '                                             queue, batch scheduler env vars) explicitly — a broken\n' +
      '                                             link looks like "fast", not "missing".\n' +
      'Head-based sampling only (fixed % up front)  Use tail-based sampling: decide what to keep AFTER\n' +
      '                                             seeing the outcome, so errors and slow traces are kept\n' +
      '                                             at a much higher rate than routine ones.\n' +
      'Tracing treated as separate from metrics/logs Correlate trace IDs into log lines and expose span\n' +
      '                                             durations as metrics — the three signal types answer\n' +
      '                                             different questions about the same incident.\n' +
      'No trace retention/cost budget                Trace volume grows with request volume; set a sampling\n' +
      '                                             and retention budget deliberately instead of discovering\n' +
      '                                             it via a storage bill.\n' +
      'Spans with no meaningful attributes            Attach the identifiers you will actually search by\n' +
      '                                             later (partition ID, job ID, node) — a span with a\n' +
      '                                             duration and nothing else is barely more useful than a\n' +
      '                                             log line.</code></pre>' +
      '<p><b>The real test:</b> given "the batch pipeline was slow yesterday", can you point at the exact hop within five minutes — or does the ' +
      'answer still require someone manually re-running each stage with a stopwatch?</p>',
      try: [
        ['📖 OpenTelemetry — context propagation', 'https://opentelemetry.io/docs/concepts/context-propagation/', 'o'],
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, distributed tracing is a <b>causal reconstruction</b> tool, and its value is bounded by the weakest propagation link ' +
      'in the chain: a trace that silently truncates at an uninstrumented hop is worse than no trace at all, because it looks complete. The ' +
      'sampling strategy is itself a bet about what "interesting" means — tail-based sampling on errors and latency outliers is the standard bet, ' +
      'but it assumes you can define "interesting" before you have seen the incident you\'re trying to catch.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A ten-stage batch pipeline suddenly runs twice as slow. How does distributed tracing localize the\n' +
      'cause faster than metrics alone?\n' +
      'A: Metrics show aggregate slowness; a trace with a span per stage shows exactly which stage\'s\n' +
      '   duration increased, turning "it\'s slow somewhere" into "it\'s slow at stage 6".\n\n' +
      'Q: Why is tail-based sampling generally preferred over head-based (fixed-percentage) sampling at\n' +
      'high volume?\n' +
      'A: Tail-based sampling decides what to keep after seeing the outcome, so it can retain nearly all\n' +
      '   errors and slow traces while discarding most routine ones — head-based sampling throws away\n' +
      '   interesting traces at the same rate as boring ones.\n\n' +
      'Q: What happens when trace context propagation silently breaks at one hop?\n' +
      "A: The trace simply ends there, looking like the request was fast or the pipeline stopped, when in\n" +
      '   fact visibility was lost past that point — a broken propagation link is invisible unless checked\n' +
      '   for explicitly.\n\n' +
      'Q: How do you decide which hops to instrument in a batch pipeline?\n' +
      'A: Every hop that crosses a network or storage boundary — those are where contention, queuing, and\n' +
      '   cross-team interference are most likely to hide.\n\n' +
      'Q: How do traces, metrics, and logs complement each other during an incident?\n' +
      'A: Metrics show something is wrong in aggregate, traces show which hop/request is affected and the\n' +
      '   causal chain across services, and logs show the detailed "what happened" at that specific hop.</code></pre>',
      try: [
        ['📖 Google SRE Workbook — Monitoring', 'https://sre.google/workbook/monitoring/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A ten-stage batch pipeline\'s runtime doubles overnight. Why is distributed tracing more effective at finding the cause than metrics alone?',
      opts: [
        'Tracing automatically fixes the slow stage',
        'A span per stage shows exactly which stage\'s duration increased, localizing "it\'s slow somewhere" to a specific hop',
        'Metrics cannot show latency at all',
        'Tracing replaces the need for logs entirely'],
      ok: 1,
      why: 'Tracing breaks a request or job into per-hop spans with timing, so an aggregate slowdown shown by metrics can be localized to the exact stage responsible.' },
    { q: 'Why is tail-based sampling generally preferred over fixed-percentage (head-based) sampling for a high-volume trace pipeline?',
      opts: [
        'It is cheaper to implement than head-based sampling',
        'It decides what to keep after seeing the outcome, so it can retain nearly all errors and slow traces while discarding most routine ones',
        'It captures 100% of all traces regardless of volume',
        'It only works for batch pipelines, not live services'],
      ok: 1,
      why: 'Tail-based sampling evaluates each trace\'s outcome before deciding to keep it, letting you retain a much higher fraction of the traces that actually matter (errors, latency outliers) at a fraction of the storage cost of keeping everything.' },
    { q: 'What is the danger of trace context propagation silently breaking at one hop (e.g. a batch scheduler that doesn\'t forward the trace ID)?',
      opts: [
        'The pipeline crashes immediately and is easy to detect',
        'The trace simply ends at that hop, which can look like the request was fast or the chain stopped, hiding the fact that visibility was lost',
        'It has no effect because tracing works automatically across any boundary',
        'It only affects log correlation, not tracing'],
      ok: 1,
      why: 'A broken propagation link produces a truncated trace that looks complete rather than obviously broken — the missing downstream time is invisible unless propagation is explicitly verified across every boundary type.' }
  ]
};
