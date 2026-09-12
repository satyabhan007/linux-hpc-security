/* linux-hpc-security Learn — Part 5 · Chapter 2: Centralized Logging at Scale: Splunk/ELK Patterns */
window.CH[2] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>One server, you <code>tail -f /var/log/syslog</code> when something breaks. Five thousand servers, the log line that explains the ' +
      'outage is sitting on a node you have not thought to check yet — you need every log shipped somewhere you can search across all of them ' +
      'at once. That is <b>centralized logging</b>: the log line finds you, you do not go hunting for the log line.</p>' +
      '<pre><code>tail -f on one box   →   every node forwards logs   →   one search answers\n' +
      '  (works until box #2)      to a central index             "which host logged this error, and when?"</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A library\'s central catalog vs. walking every shelf looking for a ' +
      'book.</b> Every book (log line) is indexed the moment it arrives, tagged with where it lives; you search the catalog once instead of ' +
      'walking every aisle in every branch. The librarian (an engineer) finds the one line that matters in seconds, not hours.</p></div>',
      try: [
        ['📖 Splunk — what is Splunk', 'https://docs.splunk.com/Documentation/Splunk/latest/Overview/AboutthisManual', 'o'],
        ['📖 Elastic — the ELK stack', 'https://www.elastic.co/what-is/elk-stack', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>In <b>Splunk</b>, data lands in an <b>index</b> and is tagged with a <b>sourcetype</b> that controls how it is parsed; you search it ' +
      'with <b>SPL</b> (Search Processing Language). In <b>ELK</b> (Elasticsearch/Logstash/Kibana), <b>Beats</b> or <b>Logstash</b> ship and ' +
      'parse logs into an Elasticsearch index, queried in <b>Kibana</b> or with the Query DSL. Both do the same job: ingest, parse into fields, ' +
      'index, search.</p>' +
      '<pre><code># Splunk SPL: errors from the auth module in the last 24h, by host\n' +
      'index=infra sourcetype=auth_log level=ERROR earliest=-24h\n' +
      '| stats count by host\n' +
      '| sort - count\n\n' +
      '# Splunk SPL: rare-value search — find hosts logging an error type almost nobody else logs\n' +
      'index=infra sourcetype=auth_log\n' +
      '| rare limit=5 error_code by host\n\n' +
      '# ELK: same query shape via Kibana Query Language (KQL)\n' +
      'sourcetype:auth_log AND level:ERROR AND @timestamp >= now-24h</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard stack is either <b>Splunk</b> (SPL, index/sourcetype model, ' +
      'strong at enterprise scale) or the <b>Elastic Stack</b> (Logstash/Beats for ingestion, Elasticsearch for storage/search, Kibana for ' +
      'visualization) — the same <code>splunk/</code> module in this repo introduces the index/sourcetype model this chapter builds on. Most ' +
      'fleets standardize on one, then federate specialty pipelines (Ch 3) on top.</p></div>',
      try: [
        ['📖 Splunk — Search Processing Language (SPL)', 'https://docs.splunk.com/Documentation/Splunk/latest/SearchReference/WhatsInThisManual', 'o'],
        ['📖 Elastic — Logstash reference', 'https://www.elastic.co/guide/en/logstash/current/introduction.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>"Logs stopped flowing from rack 12."</b> A forwarder on twelve nodes ' +
      'silently stops shipping after a disk-space alert nobody escalated — the forwarder\'s local queue filled and it started dropping events. ' +
      'The index shows nothing wrong because there is nothing in it to show. Fix: monitor the forwarders themselves (queue depth, last-forward ' +
      'timestamp per host) as a first-class metric, not just the content of what they forward — the pipeline that watches everything also needs ' +
      'someone watching it.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The sourcetype that ate the license.</b> A new service starts logging ' +
      'verbose debug output under the wrong sourcetype, doubling daily ingest volume overnight and blowing through the Splunk license limit — ' +
      'now every search is throttled fleet-wide. Fix: enforce sourcetype/index review in the onboarding checklist for new log sources, and alert ' +
      'on daily ingest-volume-per-source deltas, not just total volume.</p></div>' +
      '<p><b>Field extraction at ingest, not at search time, when you can afford it:</b> parsing timestamp, host, and severity once during ' +
      'ingestion (index-time) is cheaper at scale than re-parsing raw text on every search (search-time) — but over-committing to index-time ' +
      'schema makes fields you did not anticipate expensive to add later. Most fleets extract a lean, stable core at index time and leave the ' +
      'rest to search-time field extraction.</p>',
      try: [
        ['📖 Splunk — index-time vs. search-time field extraction', 'https://docs.splunk.com/Documentation/Splunk/latest/Knowledge/Configureindex-timefieldextraction', 'o'],
        ['📡 Ch 3 — log pipeline architecture: ingestion, indexing & retention', '#ch3', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'No monitoring of the forwarders/shippers    Track queue depth and last-forward timestamp per host as\n' +
      '                                             first-class metrics — a silent forwarder looks identical\n' +
      '                                             to "nothing bad happened".\n' +
      'One sourcetype for everything                Design index/sourcetype boundaries around access control\n' +
      '                                             and retention needs, not convenience — audit logs and\n' +
      '                                             debug chatter should never share a bucket.\n' +
      'Unbounded debug logging in production         Rate-limit or sample verbose logging paths; alert on\n' +
      '                                             ingest-volume deltas per source, not just totals.\n' +
      'All fields extracted at search time           Extract a lean, stable core (timestamp, host, severity)\n' +
      '                                             at index time; leave exploratory fields to search-time\n' +
      '                                             extraction so the schema stays cheap to evolve.\n' +
      'No retention tiering                          Hot/warm/cold tiering (Ch 3) keeps recent data fast to\n' +
      '                                             search and old data cheap to keep, instead of one\n' +
      '                                             expensive tier for everything.\n' +
      'Logs as the only signal for an incident        Correlate logs with metrics (Ch 1) and traces (Ch 4) —\n' +
      '                                             a log line tells you what happened, not always why.</code></pre>' +
      '<p><b>The real test:</b> if a forwarder on twelve nodes silently stopped shipping right now, would your monitoring notice the absence — ' +
      'or only the humans who eventually go looking for a log line that never arrived?</p>',
      try: [
        ['📖 Splunk — monitoring forwarder health', 'https://docs.splunk.com/Documentation/Forwarder/latest/Forwarder/Monitorforwarderhealth', 'o'],
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, centralized logging is a <b>pipeline-reliability</b> problem as much as a search problem: the value of "search across ' +
      'every log" collapses the instant the pipeline itself has a blind spot, so the pipeline\'s own health (forwarder queues, ingest lag, index ' +
      'license ceilings) must be observable with the same rigor as the systems it monitors. The index/sourcetype boundary is also a governance ' +
      'boundary — who can search what, and how long it is retained — decided up front, not discovered during an audit.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Logs from a rack of nodes silently stop appearing in Splunk. Where do you look first?\n' +
      "A: The forwarders themselves — queue depth and last-forward timestamp per host — not the index. A\n" +
      '   forwarder with a full local queue silently drops events, and the index has nothing to show for it.\n\n' +
      'Q: Why separate index-time and search-time field extraction?\n' +
      'A: Index-time extraction is cheaper at search scale but expensive to change later; extract a lean,\n' +
      '   stable core there and leave exploratory/evolving fields to search-time extraction.\n\n' +
      'Q: A new service doubles daily log ingest overnight. What broke, and how do you catch it earlier?\n' +
      'A: Likely a verbose/debug logging path shipped to the wrong sourcetype. Alert on ingest-volume deltas\n' +
      '   per source, and gate new log sources through an onboarding/sourcetype review.\n\n' +
      'Q: How do you decide index/sourcetype boundaries?\n' +
      'A: Around access control and retention needs, not convenience — audit logs, security logs, and debug\n' +
      '   chatter should never share a bucket because they have different access and retention rules.\n\n' +
      'Q: Why is a log line alone often not enough during an incident?\n' +
      'A: A log tells you what happened at one point; correlating it with metrics (trend) and traces\n' +
      '   (causal chain across hops) tells you why — logs are one of three signal types, not the only one.</code></pre>',
      try: [
        ['📖 Google SRE Workbook — Monitoring', 'https://sre.google/workbook/monitoring/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Logs stop appearing in Splunk from twelve nodes in one rack, but the index shows no errors. What is the most likely cause?',
      opts: [
        'The nodes have stopped generating any logs at all',
        'The forwarders on those nodes have a full local queue and are silently dropping events before they reach the index',
        'Splunk automatically deletes logs older than one hour',
        'The search query has a syntax error'],
      ok: 1,
      why: 'A forwarder whose local queue fills (often due to a disk-space or connectivity issue) silently drops events — the index looks clean only because nothing arrived to index. Forwarder health must be monitored directly.' },
    { q: 'Why extract only a lean, stable set of fields (timestamp, host, severity) at index time rather than everything?',
      opts: [
        'Index-time extraction is not supported in Splunk or Elasticsearch',
        'Index-time schema is expensive to change later, while search-time field extraction is cheap to iterate on for exploratory or evolving fields',
        'Search-time extraction is always faster than index-time extraction',
        'Fields cannot be extracted at index time at all'],
      ok: 1,
      why: 'Index-time extraction is fast for search at the cost of being hard to change; committing only a stable core there while leaving exploratory fields to search-time extraction keeps the schema cheap to evolve.' },
    { q: 'A new service doubles the daily log ingest volume overnight and throttles searches fleet-wide. What is the right long-term fix?',
      opts: [
        'Manually delete old logs to free up capacity every time this happens',
        'Alert on ingest-volume deltas per source and gate new log sources through a sourcetype/onboarding review',
        'Increase the Splunk license limit indefinitely without investigating the cause',
        'Disable logging for the new service entirely'],
      ok: 1,
      why: 'Ingest-volume-delta alerting per source catches runaway logging early, and an onboarding review for new sourcetypes prevents misconfigured verbose logging from reaching production undetected.' }
  ]
};
