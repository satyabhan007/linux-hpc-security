/* linux-hpc-security Learn — Part 5 · Chapter 9: Chaos Engineering for Bare-Metal & HPC Systems */
window.CH[9] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>You believe your parallel filesystem survives an OSS node dying, because the docs say it should. You find out whether that is true at ' +
      '2am during a real failure, or you find out at 2pm on a Tuesday by killing an OSS node on purpose while everyone is watching and ready to ' +
      'help. <b>Chaos engineering</b> is deliberately injecting the failure you are afraid of, in a controlled way, before reality injects it for ' +
      'you.</p>' +
      '<pre><code>Hope the failover works   →   test the failover on purpose, on a schedule, with rollback ready\n' +
      '  (find out during a real outage)      (find out on a Tuesday afternoon with the team watching)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A fire drill vs. finding out the fire exits are locked during a real ' +
      'fire.</b> A fire drill deliberately tests the escape plan when nothing is actually burning, so the flaws surface with zero real risk — ' +
      'not during the one moment when the plan absolutely has to work.</p></div>',
      try: [
        ['📖 Principles of Chaos Engineering', 'https://principlesofchaos.org/', 'o'],
        ['📡 Ch 7 — SLOs & error budgets for infrastructure teams', '#ch7', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Every chaos experiment starts from a <b>steady-state hypothesis</b> ("the system behaves normally by metric X under normal load"), ' +
      'injects one fault, and checks whether steady state holds. <b>Blast radius</b> is the deliberate boundary on how much of the system the ' +
      'fault can touch — start small, on a non-critical subset, before ever running an experiment against a shared production cluster.</p>' +
      '<pre><code># define steady state: job submission success rate stays >= 99% during the experiment\n' +
      '# (this is exactly a burn-rate-style SLI from Ch 7, applied to the duration of the experiment)\n\n' +
      '# inject a fault: fail one OSS (Object Storage Server) node in a Lustre filesystem\n' +
      '$ ssh oss03 "systemctl stop lustre-oss"          # blast radius: ONE of many OSS nodes, not the MDS\n\n' +
      '# a fabric-link failure test on an InfiniBand fat-tree (validate redundant path failover)\n' +
      '$ ibportstate -C mlx5_0 -P 1 &lt;lid&gt; &lt;port&gt; disable   # disable one link, confirm traffic reroutes</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The pattern (steady-state hypothesis → inject → observe → roll back) mirrors ' +
      '<b>Chaos Monkey</b>/<b>Gremlin</b>-style chaos engineering, adapted here for physical infrastructure — the same fault-injection thinking ' +
      'this repo\'s <code>chaos</code> module applies at the OS/service level is applied here at the node, fabric, and filesystem layer.</p></div>',
      try: [
        ['📖 Gremlin — chaos engineering fundamentals', 'https://www.gremlin.com/community/tutorials/chaos-engineering-the-history-principles-and-practice/', 'o'],
        ['📖 Netflix — Chaos Monkey', 'https://netflix.github.io/chaosmonkey/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A chaos experiment killing an OSS node in a parallel filesystem.</b> ' +
      'The team\'s steady-state hypothesis: "job I/O throughput stays within 20% of baseline when one of six OSS nodes fails." Running the ' +
      'experiment on a Tuesday afternoon reveals throughput actually drops 60% — the filesystem\'s failover works, but client-side retry timeouts ' +
      'are tuned too aggressively, causing a retry storm. That gap gets fixed before a real hardware failure ever tests it in production.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A fabric-link failure test validating fat-tree redundancy.</b> Disabling ' +
      'one InfiniBand link is supposed to reroute traffic transparently through the fat-tree\'s redundant paths; the experiment instead reveals a ' +
      'misconfigured routing table on one leaf switch that sends traffic into a black hole instead of rerouting — a redundancy design that was ' +
      'never actually validated end to end until the chaos experiment forced the question.</p></div>' +
      '<p><b>Blast radius must be defined and agreed upon BEFORE the experiment runs, not during it:</b> "which nodes/users could be affected if ' +
      'this goes worse than expected" is a question with an answer decided in advance, with a rollback plan ready, on a shared cluster where real ' +
      'jobs are running.</p>',
      try: [
        ['📖 Google — Disaster Recovery Testing (DiRT) approach', 'https://sre.google/sre-book/testing-reliability/', 'o'],
        ['📡 Ch 10 — on-call & incident response for infrastructure teams', '#ch10', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Running chaos experiments with no defined   Write the steady-state hypothesis (a measurable SLI and\n' +
      'steady-state hypothesis                     threshold) before injecting anything, so "did it work" is\n' +
      '                                             answerable, not a vibe.\n' +
      'No blast-radius agreement before the test    Define and get sign-off on blast radius in advance —\n' +
      '                                             including who is notified and what the abort criteria\n' +
      '                                             are — before touching a shared cluster.\n' +
      'Testing only the failure, never the recovery A fault that fails over correctly but recovers badly\n' +
      '                                             (e.g. a thundering-herd reconnect) is still a real\n' +
      "                                             production risk — test the recovery path too.\n" +
      'Chaos experiments run once and never repeated Infrastructure and configs drift; a redundancy path that\n' +
      '                                             worked last year may be silently broken by an unrelated\n' +
      '                                             change since — schedule experiments to repeat.\n' +
      'Running the first-ever chaos experiment      Start with the smallest reasonable blast radius (one\n' +
      'directly on a shared production cluster      node, one link) and non-critical hours before scaling up\n' +
      '                                             to a full production validation.\n' +
      'No rollback/abort plan ready                 Have the fix-it path (re-enable the link, restart the\n' +
      '                                             service) tested and ready to execute the moment the\n' +
      '                                             steady-state hypothesis is violated.</code></pre>' +
      '<p><b>The real test:</b> when was the last time your team deliberately broke something on a shared cluster to verify the redundancy you ' +
      'are relying on actually works — or is that redundancy only ever been tested by the failures nobody scheduled?</p>',
      try: [
        ['📖 Principles of Chaos Engineering — advanced principles', 'https://principlesofchaos.org/', 'o'],
        ['📡 Ch 14 — postmortems for infrastructure incidents', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, chaos engineering on bare-metal/HPC systems is a <b>confidence-calibration</b> discipline: the goal is not to break ' +
      'things for its own sake, but to replace an assumed redundancy guarantee with a measured, recently-verified one. Physical infrastructure ' +
      'adds constraints software-only chaos engineering does not have — a killed OSS node or a disabled fabric link has a real hardware recovery ' +
      'time, and blast-radius planning must account for shared, in-flight jobs that a purely virtual chaos experiment would not need to consider.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What is a "steady-state hypothesis" in a chaos experiment, and why define it before injecting a\n' +
      'fault?\n' +
      'A: A measurable statement of normal behavior (e.g. "job success rate stays >= 99%") that the fault\n' +
      '   should not violate if redundancy works as designed — without it, "did the experiment succeed" has\n' +
      '   no objective answer.\n\n' +
      'Q: Why must blast radius be agreed upon before running an experiment on a shared cluster?\n' +
      'A: To bound the worst-case impact on real, in-flight jobs and get explicit sign-off — running an\n' +
      '   undefined-scope experiment on shared production infrastructure risks turning a controlled test\n' +
      "   into an actual outage.\n\n" +
      'Q: Why test the recovery path, not just the failure/failover path?\n' +
      'A: A system can fail over correctly but recover badly (e.g. a reconnect storm) — the recovery\n' +
      '   transition is often where the real production risk hides, not the initial failure.\n\n' +
      'Q: Why repeat chaos experiments periodically rather than running them once?\n' +
      'A: Infrastructure and configuration drift over time; a redundancy path validated a year ago can be\n' +
      '   silently broken by an unrelated later change, so periodic re-validation is necessary.\n\n' +
      'Q: What makes bare-metal/HPC chaos engineering different from chaos engineering on cloud VMs?\n' +
      'A: Physical failure modes (a real disk, NIC, or fabric link) have real recovery times and can affect\n' +
      '   shared, in-flight jobs on a cluster — blast-radius and scheduling decisions must account for\n' +
      '   hardware constraints that ephemeral cloud instances do not have.</code></pre>',
      try: [
        ['📖 Google SRE Book — Testing for Reliability', 'https://sre.google/sre-book/testing-reliability/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why must a chaos experiment define a "steady-state hypothesis" before injecting a fault?',
      opts: [
        'It is a formality with no real impact on the experiment',
        'It gives a measurable, objective definition of normal behavior so whether redundancy held up during the fault can actually be verified, not guessed',
        'It is only needed for software chaos experiments, not hardware ones',
        'It replaces the need for a blast-radius agreement'],
      ok: 1,
      why: 'Without a measurable steady-state definition (e.g. a specific SLI and threshold), there is no objective way to say whether the system behaved acceptably during the fault.' },
    { q: 'Why is blast radius agreed upon and bounded before running a chaos experiment on a shared HPC cluster?',
      opts: [
        'To make the experiment take longer to plan',
        'To bound the worst-case impact on real, in-flight jobs and get explicit sign-off before risking a controlled test turning into an actual outage',
        'Blast radius only matters for cloud-based systems, not bare-metal ones',
        'It is required only when testing security vulnerabilities'],
      ok: 1,
      why: 'On a shared cluster with live jobs, an unbounded or unplanned fault can escalate into a genuine outage — defining and agreeing on blast radius in advance limits and controls that risk.' },
    { q: 'Why is testing the recovery path (not just the failure/failover path) important in a chaos experiment?',
      opts: [
        'Recovery paths never fail if failover succeeded',
        'A system can fail over correctly but recover badly (e.g. a reconnect/thundering-herd storm), so the recovery transition often hides the real production risk',
        'Recovery testing is only relevant for network failures',
        'It is not important — only the failure injection matters'],
      ok: 1,
      why: 'The transition back to normal (e.g. clients reconnecting en masse) can introduce new problems even when the failover itself worked, so both the failure and recovery paths need validation.' }
  ]
};
