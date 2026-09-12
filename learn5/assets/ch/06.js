/* linux-hpc-security Learn — Part 5 · Chapter 6: Fraud & Circumvention Detection Pipelines at Scale */
window.CH[6] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>One suspicious account is easy to catch by hand. Ten thousand accounts created in the last hour, most fake, a few real — hand review ' +
      'does not scale, and by the time a human notices the pattern the damage is done. <b>Fraud and circumvention detection at scale</b> means ' +
      'running the same checks a fraud analyst would run, continuously, on every event, fast enough to act before the abuse compounds.</p>' +
      '<pre><code>One analyst reviewing flagged accounts   →   a streaming pipeline scoring every signup/login/action\n' +
      '  (hours behind, does not scale)              in real time against velocity + linkage rules</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A casino\'s eye-in-the-sky vs. a single pit boss watching one table.</b> ' +
      'The pit boss catches obvious cheating at their own table; the eye-in-the-sky correlates patterns across every table, every dealer, every ' +
      'hour, catching coordinated schemes no single vantage point could see.</p></div>',
      try: [
        ['📖 OWASP — Automated Threats to Web Applications', 'https://owasp.org/www-project-automated-threats-to-web-applications/', 'o'],
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Two workhorse techniques: <b>velocity checks</b> (how many of X happened from Y in time window Z — too many signups from one IP in ' +
      'one hour is suspicious regardless of what each signup looks like individually) and <b>linkage graphs</b> (accounts sharing a device ' +
      'fingerprint, payment method, or referral chain form a graph; a tight cluster of "unrelated" accounts all touching the same node is the ' +
      'signal).</p>' +
      '<pre><code># Splunk SPL: velocity check — flag IPs creating >20 accounts in a rolling 1h window\n' +
      'index=signups\n' +
      '| bucket _time span=1h\n' +
      '| stats count by src_ip, _time\n' +
      '| where count > 20\n\n' +
      '# a simple linkage query: accounts sharing a device fingerprint across supposedly-independent signups\n' +
      'index=signups\n' +
      '| stats dc(account_id) as linked_accounts values(account_id) as accounts by device_fingerprint\n' +
      '| where linked_accounts > 5</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard architecture is a <b>streaming pipeline</b> (events flow ' +
      'through velocity checks and graph-linkage scoring in near-real-time, e.g. Kafka + a stream processor) feeding a risk score per event, with ' +
      'high-confidence cases auto-blocked and borderline cases queued for human review — the same velocity/linkage pattern this repo\'s ' +
      '<code>fraud-detection</code> module builds from first principles, run here at production streaming scale.</p></div>',
      try: [
        ['📖 Google Cloud — fraud detection with Dataflow (streaming pattern)', 'https://cloud.google.com/architecture/detecting-anomalies-in-financial-fraud-using-streaming-analytics', 'o'],
        ['📡 fraud-detection module', '../fraud-detection/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A velocity-based pipeline running in streaming mode.</b> A batch job ' +
      'that scores signups for fraud once a day catches a bot-driven signup wave 20 hours after it happened — the bots already exploited a ' +
      'promo. Moving the same velocity check to a streaming pipeline (scored within seconds of each signup) lets the team auto-throttle the ' +
      'source IP range before more than a handful of fraudulent signups complete.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A linkage-graph analysis catching coordinated abuse.</b> Two hundred ' +
      'accounts, each individually unremarkable (normal signup velocity, no single suspicious field), turn out to share a small cluster of ' +
      'device fingerprints and referral codes — invisible to any single-account or single-velocity check, but obvious once the accounts are laid ' +
      'out as a graph and a dense, tightly-linked cluster jumps out.</p></div>' +
      '<p><b>False-positive cost is not symmetric with false-negative cost:</b> blocking a real user\'s signup is an immediate, visible cost ' +
      '(lost trust, support tickets); missing a fraud ring is a delayed, often invisible cost until it is large. A cost-based evaluation of a ' +
      'detection model — not just accuracy — is what tells you whether you have the threshold in the right place.</p>',
      try: [
        ['📖 NIST — Digital Identity Guidelines (risk-based authentication)', 'https://pages.nist.gov/800-63-3/', 'o'],
        ['📡 Ch 5 — anomaly detection for infrastructure telemetry', '#ch5', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Batch scoring once a day                    Move velocity/linkage scoring to a streaming pipeline —\n' +
      '                                             fraud that scores hours later has already succeeded.\n' +
      'Single-account checks only                   Add linkage-graph analysis — coordinated abuse is\n' +
      '                                             invisible per-account but obvious as a cluster.\n' +
      'One static risk threshold forever             Fraud patterns adapt; retrain/re-tune thresholds\n' +
      '                                             periodically against fresh labeled data, not a threshold\n' +
      '                                             set once at launch.\n' +
      'Evaluating a model on accuracy alone          Evaluate on cost: the asymmetric price of a false\n' +
      '                                             positive (blocked real user) vs. a false negative\n' +
      '                                             (successful fraud) should drive the threshold, not\n' +
      '                                             accuracy percentage.\n' +
      'Auto-blocking every flagged event              Route high-confidence flags to auto-block and\n' +
      '                                             borderline flags to human review — an all-or-nothing\n' +
      '                                             policy either blocks too many real users or misses too\n' +
      '                                             much fraud.\n' +
      'No feedback loop from human review             Feed confirmed false positives/negatives from human\n' +
      '                                             review back into the model/thresholds — a static\n' +
      '                                             detector degrades as fraud tactics evolve.</code></pre>' +
      '<p><b>The real test:</b> can your pipeline catch a coordinated abuse ring where every individual account looks perfectly normal, or does ' +
      'it only catch fraud that also happens to look suspicious in isolation?</p>',
      try: [
        ['📖 OWASP — Credential Stuffing Prevention Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Credential_Stuffing_Prevention_Cheat_Sheet.html', 'o'],
        ['📡 Ch 13 — SOC/NOC operational patterns: triage, handoff & command', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, fraud and circumvention detection is an <b>adversarial, adaptive</b> problem — the fraud side actively learns your ' +
      'detection rules and evolves around them, which is fundamentally different from detecting an infrastructure anomaly that has no intent ' +
      'behind it. A static rule set decays; the pipeline needs a feedback loop from confirmed outcomes back into thresholds and features, and a ' +
      'cost model that treats false positives and false negatives as genuinely different kinds of harm, not interchangeable error counts.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why does batch (e.g. daily) fraud scoring fail against a fast-moving bot signup wave?\n' +
      'A: By the time a daily batch job scores the signups, the fraudulent accounts have already completed\n' +
      "   their exploit — streaming, near-real-time scoring is needed to act before the abuse compounds.\n\n" +
      'Q: Why can linkage-graph analysis catch fraud that per-account velocity checks miss?\n' +
      'A: Coordinated abuse is often designed so each individual account looks unremarkable; a shared\n' +
      '   device fingerprint, payment method, or referral chain across many accounts is only visible when\n' +
      '   accounts are analyzed as a graph, not in isolation.\n\n' +
      'Q: Why should a fraud model be evaluated on cost rather than raw accuracy?\n' +
      'A: False positives (blocking real users) and false negatives (missed fraud) have very different, and\n' +
      '   asymmetric, real-world costs — accuracy alone hides which kind of error the model is actually\n' +
      '   making.\n\n' +
      'Q: Why does a static, never-updated fraud detection ruleset degrade over time?\n' +
      'A: Fraud is adversarial — bad actors actively probe and adapt to known rules, so a detector without\n' +
      "   a feedback loop from confirmed outcomes gets progressively less effective as tactics evolve.\n\n" +
      'Q: How should flagged events be routed differently based on confidence?\n' +
      'A: High-confidence flags to auto-block, borderline flags to human review — an all-or-nothing policy\n' +
      '   either over-blocks legitimate users or under-catches fraud.</code></pre>',
      try: [
        ['📖 OWASP — Automated Threats to Web Applications', 'https://owasp.org/www-project-automated-threats-to-web-applications/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why does scoring signups for fraud once a day (batch mode) fail against a fast-moving bot signup wave?',
      opts: [
        'Batch processing cannot handle large volumes of data at all',
        'By the time the daily batch job scores the signups, the fraud has already succeeded — streaming/near-real-time scoring is needed to act in time',
        'Batch jobs are less accurate than streaming pipelines',
        'Bots only attack during specific hours that batch jobs miss'],
      ok: 1,
      why: 'The core issue is timing: a delayed detection cannot prevent damage that has already occurred. Streaming scoring closes that gap by acting within seconds of each event.' },
    { q: 'Why can a linkage-graph analysis catch coordinated fraud that per-account checks miss?',
      opts: [
        'It runs faster than per-account checks',
        'Coordinated abuse is designed so each account looks unremarkable individually; only shared attributes (device, payment method, referral chain) reveal the cluster when accounts are analyzed as a graph',
        'Linkage graphs replace the need for velocity checks entirely',
        'It only works for financial transactions, not account signups'],
      ok: 1,
      why: 'A tightly linked cluster of accounts sharing device fingerprints or other attributes is invisible to single-account velocity or content checks but obvious once relationships are modeled as a graph.' },
    { q: 'Why should a fraud detection model be evaluated based on cost rather than raw accuracy?',
      opts: [
        'Cost-based evaluation is easier to compute than accuracy',
        'False positives (blocking real users) and false negatives (missed fraud) carry very different real-world costs, which accuracy alone does not capture',
        'Accuracy cannot be measured for fraud detection models',
        'Cost-based evaluation eliminates the need for human review'],
      ok: 1,
      why: 'A model can have high accuracy while still making the "wrong kind" of errors for the business — cost-based evaluation weighs the asymmetric harm of false positives vs. false negatives to set the right threshold.' }
  ]
};
