/* linux-hpc-security Learn — Part 5 · Chapter 3: Log Pipeline Architecture: Ingestion, Indexing & Retention */
window.CH[3] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Shipping logs to one place (Ch 2) is the easy part. The hard part is: what happens when the indexer is down for twenty minutes during ' +
      'a deploy — do you lose twenty minutes of logs, or does something hold them until the indexer comes back? And what happens to a log line ' +
      'ninety-one days after it lands, when your compliance policy says keep 90 days? <b>Log pipeline architecture</b> is the plumbing that ' +
      'answers both questions on purpose, not by accident.</p>' +
      '<pre><code>App  →  forwarder  →  [buffer]  →  indexer  →  storage (hot → warm → cold → deleted)\n' +
      '                          ^\n' +
      '                    survives a short indexer outage without losing data</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A postal sorting system with a holding warehouse.</b> If the destination ' +
      'office is closed, mail is not thrown away — it waits in a buffer warehouse until the office reopens, then gets sorted and filed. Old mail ' +
      'eventually moves to cheap archive storage, then is shredded on schedule, not by accident.</p></div>',
      try: [
        ['📖 Splunk — data pipeline overview', 'https://docs.splunk.com/Documentation/Splunk/latest/Deploy/Datapipeline', 'o'],
        ['📡 Ch 2 — centralized logging at scale', '#ch2', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A resilient pipeline puts a <b>buffer</b> between forwarders and indexers so an indexer outage does not mean lost logs — <b>Kafka</b> ' +
      'is the standard buffer for high-volume log pipelines feeding Splunk or Elasticsearch. Once indexed, data moves through <b>storage ' +
      'tiers</b>: hot (fast disk, recent, most-searched), warm, cold (cheap, slow, rarely searched), then deletion per <b>retention policy</b>.</p>' +
      '<pre><code># Splunk indexes.conf — a simple hot/warm/cold/frozen tier with a 90-day retention\n' +
      '[infra_logs]\n' +
      'homePath   = $SPLUNK_DB/infra_logs/db\n' +
      'coldPath   = $SPLUNK_DB/infra_logs/colddb\n' +
      'thawedPath = $SPLUNK_DB/infra_logs/thaweddb\n' +
      'frozenTimePeriodInSecs = 7776000   # 90 days, then frozen (archived or deleted)\n' +
      'maxTotalDataSizeMB = 512000\n\n' +
      '# Kafka as a durable buffer in front of Logstash/indexers\n' +
      '$ kafka-topics.sh --create --topic infra-logs --partitions 12 --replication-factor 3 \\\n' +
      '    --config retention.ms=86400000   # keep 24h buffered even if indexers are down that long</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern is <b>forwarder → Kafka (buffer) → indexer → tiered ' +
      'storage</b>, with retention set by <code>frozenTimePeriodInSecs</code> in Splunk or an Index Lifecycle Management (ILM) policy in ' +
      'Elasticsearch. The buffer is what makes the pipeline survive an indexer outage without silently dropping events — the same failure mode ' +
      'that Ch 2\'s "logs stopped flowing" scenario traces back to when it is missing.</p></div>',
      try: [
        ['📖 Splunk — indexes.conf reference', 'https://docs.splunk.com/Documentation/Splunk/latest/Admin/Indexesconf', 'o'],
        ['📖 Apache Kafka — documentation', 'https://kafka.apache.org/documentation/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Sizing a hot/warm/cold tier.</b> A team sizes hot storage for "all ' +
      'logs" and runs out of fast disk in six weeks because nobody modeled daily ingest volume against retention. Fix: size hot storage for the ' +
      'searched window (e.g. 7-14 days of active investigation), warm for the compliance-relevant middle period, and cold for cheap long-term ' +
      'retention that is rarely queried — capacity planning (Ch 12) for logs is the same math as capacity planning for compute.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Surviving an indexer outage with Kafka.</b> During a Splunk indexer ' +
      'cluster upgrade, indexing pauses for 40 minutes; because forwarders write to a Kafka topic with 24 hours of retention instead of directly ' +
      'to the indexer, no log data is lost — it simply catches up once the indexers are back. Without the buffer, that 40-minute window would be ' +
      'a permanent gap in every future investigation that needs it.</p></div>' +
      '<p><b>Retention is a compliance-vs-cost negotiation, not a technical default:</b> security/audit logs often need 1+ year retention for ' +
      'compliance regimes while noisy debug logs may only need 7 days — a single fleet-wide retention number is either wasting money or ' +
      'violating a compliance requirement somewhere.</p>',
      try: [
        ['📖 Elastic — Index Lifecycle Management (ILM)', 'https://www.elastic.co/guide/en/elasticsearch/reference/current/index-lifecycle-management.html', 'o'],
        ['📡 Ch 12 — capacity planning for compute clusters', '#ch12', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Forwarders write directly to indexers       Put a durable buffer (Kafka) between forwarders and\n' +
      '                                             indexers so an indexer outage does not lose data.\n' +
      'One retention policy for every log type      Set retention per index/sourcetype based on compliance\n' +
      '                                             need and query frequency — audit logs and debug chatter\n' +
      '                                             do not share a lifecycle.\n' +
      'Hot tier sized for "everything"               Size hot storage for the active-investigation window\n' +
      '                                             (days), warm for the compliance-relevant middle, cold\n' +
      '                                             for cheap long-term archive.\n' +
      'No monitoring of buffer lag                   Alert on Kafka consumer lag — a buffer that is silently\n' +
      '                                             falling behind is the same blind spot as a forwarder\n' +
      '                                             queue that is silently filling.\n' +
      'Retention enforced by manual cleanup          Automate retention via frozenTimePeriodInSecs / ILM\n' +
      '                                             policies — manual deletion is how compliance violations\n' +
      '                                             and storage bill surprises both happen.\n' +
      'Frozen/cold data nobody can actually search    Test the restore-from-cold path before you need it in\n' +
      '                                             an audit — cold storage you cannot retrieve from is not\n' +
      '                                             retention, it is a very expensive delete.</code></pre>' +
      '<p><b>The real test:</b> if your indexer cluster went down for two hours right now during a busy deploy, would every log line eventually ' +
      'still show up once it recovered — or would that two-hour window simply never exist in your logs again?</p>',
      try: [
        ['📖 Kafka — consumer lag monitoring', 'https://kafka.apache.org/documentation/#monitoring', 'o'],
        ['📡 Ch 4 — distributed tracing for infrastructure & batch pipelines', '#ch4', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, log pipeline architecture is a <b>durability-vs-cost tradeoff made explicit</b>, end to end: every stage (forwarder ' +
      'queue, buffer, indexer, storage tier) has its own failure mode and its own retention/durability guarantee, and the pipeline\'s real SLA is ' +
      'the weakest link in that chain — not the strongest. A buffer with 24 hours of retention does not protect you from a 30-hour outage; a ' +
      'retention policy nobody has tested a restore against is not really a retention policy.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why put Kafka (or a similar buffer) between log forwarders and the indexer, instead of forwarding\n' +
      'directly?\n' +
      'A: A durable buffer lets the pipeline survive an indexer outage without losing data — logs queue in\n' +
      '   Kafka and catch up once indexing resumes, instead of being dropped at the forwarder.\n\n' +
      'Q: How do you decide hot/warm/cold storage sizing for a log pipeline?\n' +
      'A: Size hot for the active-investigation window (days), warm for the compliance-relevant middle\n' +
      '   period, and cold for cheap long-term archive — not "everything in hot" which runs out of fast\n' +
      '   disk fast.\n\n' +
      'Q: Why should retention policy differ by index/sourcetype rather than being one fleet-wide number?\n' +
      'A: Different log types have different compliance and query-frequency requirements — a single number\n' +
      '   either over-retains noisy debug logs (wasting cost) or under-retains audit logs (violating\n' +
      '   compliance).\n\n' +
      'Q: What failure mode does Kafka consumer lag monitoring catch that forwarder monitoring does not?\n' +
      'A: A buffer silently falling behind the indexer — data is not lost yet, but the gap is growing, and\n' +
      '   without lag monitoring nobody notices until the buffer\'s own retention window runs out.\n\n' +
      'Q: Why test restoring from cold/frozen storage before an actual audit needs it?\n' +
      'A: Retention that cannot be retrieved is not retention — testing the restore path in advance is the\n' +
      '   only way to know the archived data is actually usable when it matters.</code></pre>',
      try: [
        ['📖 Confluent — Kafka as a durable log buffer', 'https://developer.confluent.io/what-is-apache-kafka/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why put a durable buffer like Kafka between log forwarders and the indexing tier?',
      opts: [
        'It makes search queries return faster',
        'It lets the pipeline survive an indexer outage — logs queue in the buffer and catch up once indexing resumes, instead of being dropped',
        'It automatically extracts fields from raw log lines',
        'It is required by Splunk licensing'],
      ok: 1,
      why: 'A buffer decouples ingestion from indexing so a temporary indexer outage does not cause permanent data loss — the buffered logs simply catch up once the indexer is back.' },
    { q: 'How should hot/warm/cold storage tiers typically be sized for a log pipeline?',
      opts: [
        'All logs should be kept in the hot tier indefinitely for fastest search',
        'Hot for the active-investigation window, warm for the compliance-relevant middle period, cold for cheap long-term archive',
        'Cold storage should hold the most recently ingested data',
        'Tier sizing does not matter as long as total storage is large enough'],
      ok: 1,
      why: 'Sizing tiers to match how the data is actually used — recent/searched data fast and accessible, older/rarely-queried data cheap — avoids running out of expensive fast storage while still meeting retention needs.' },
    { q: 'Why should retention policy be set per index/sourcetype rather than as one fleet-wide value?',
      opts: [
        'Splunk and Elasticsearch do not support per-index retention settings',
        'Different log types have different compliance requirements and query frequency — one fleet-wide number either over-retains noisy logs or under-retains audit logs',
        'Per-sourcetype retention is only relevant for security teams',
        'It has no real effect on cost or compliance'],
      ok: 1,
      why: 'A single retention value applied everywhere is either wasteful (retaining noisy debug logs too long) or non-compliant (deleting audit logs too soon) — retention should match each log type\'s actual requirements.' }
  ]
};
