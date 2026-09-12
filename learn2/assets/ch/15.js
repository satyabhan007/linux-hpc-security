/* linux-hpc-security Learn — Part 2 · Chapter 15: Case Study — Diagnosing a Fleet-Wide Latency Regression */
window.CH[15] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Monday morning, a routine kernel security update rolled out over the weekend to the entire API-serving fleet. By Monday ' +
      'afternoon, p99 latency across every service has quietly doubled — no errors, no crashes, nothing in application logs, just ' +
      '"everything feels slower." The on-call engineer\'s first instinct is to check what code deployed recently. Nothing did. The only ' +
      'thing that changed was the kernel underneath everything.</p>' +
      '<pre><code>Before: p99 latency ~40ms, stable for weeks\n' +
      'After weekend kernel upgrade: p99 latency ~85ms, every service, no app code changes</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Every car in a city suddenly getting worse gas mileage after a ' +
      'single road resurfacing project.</b> No driver changed how they drive; the shared surface underneath every trip changed instead. ' +
      'This case study is about learning to suspect the road (the kernel) when every car (every service) is affected identically.</p></div>',
      try: [
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The investigation starts with the same tools from earlier chapters, applied in sequence. First, confirm scope: is this ' +
      'every service, or a subset with something in common? Second, confirm timing: does the regression line up exactly with the kernel ' +
      'rollout, or something else that happened the same weekend (a config change, a traffic pattern shift)?</p>' +
      '<pre><code># confirm the kernel actually changed, and when\n' +
      '$ uptime -s                          # when did this host last boot (should match the maintenance window)\n' +
      '$ uname -r                           # confirm new kernel version vs the known-good baseline\n' +
      '$ grep -h "" /var/log/dpkg.log* 2>/dev/null | grep linux-image | tail -5\n\n' +
      '# confirm it correlates fleet-wide, not host-specific\n' +
      '$ for h in $(cat fleet-hosts.txt); do ssh $h "uname -r"; done | sort | uniq -c\n\n' +
      '# take a broad, unbiased CPU profile on an affected host as the very first diagnostic action\n' +
      '$ perf record -F 99 -a -g -- sleep 30\n' +
      '$ perf script | stackcollapse-perf.pl | flamegraph.pl > after.svg</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard first move for "everything got slower after an ' +
      'infra-level change" is exactly this: confirm the change (<code>uname -r</code>, package logs), confirm the correlation is ' +
      'fleet-wide, and take a broad <b><code>perf record -a -g</code></b> profile before forming any theory — the profile itself tells ' +
      'you where to look next.</p></div>',
      try: [
        ['📖 Brendan Gregg — perf Examples', 'https://www.brendangregg.com/perf.html', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The kernel-upgrade regression bisection.</b> With the ' +
      '"after" flamegraph in hand, the team pulls a matching "before" flamegraph from the continuous-profiling system they had already ' +
      'running (Ch 5\'s payoff: a baseline existed before anyone knew they would need one). Diffing the two with <code>perf diff</code> ' +
      'shows a new, wide frame inside the scheduler\'s load-balancing path — the new kernel changed default behavior around how ' +
      'aggressively CFS/EEVDF (Ch 1) migrates tasks across cores, and the fleet\'s workload pattern (many short-lived request-handling ' +
      'threads) is exactly the case that change made worse.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Reading a perf diff across kernel versions.</b> The specific ' +
      'regression traces to a changed default for a scheduler tunable that the new kernel version ships with different defaults for ' +
      '(mirroring the real EEVDF migration story from Ch 1). Cross-checking against the kernel changelog between the two versions ' +
      'confirms a documented behavioral change, not a bug — the fix is an explicit sysctl/scheduler-tunable override (Ch 13\'s fleet-wide, ' +
      'versioned sysctl baseline) rather than a kernel rollback, since the new kernel also carries the security fix the upgrade was ' +
      'for.</p></div>' +
      '<p><b>The post-incident writeup</b> documents: what changed (kernel version + specific scheduler default), how it was found ' +
      '(perf diff against a pre-existing baseline), what the fix was (an explicit sysctl override, deployed via the fleet-wide baseline ' +
      'from Ch 13), and — critically — that the next kernel upgrade\'s rollout plan now includes a canary stage with an automated ' +
      'perf-based comparison against the pre-upgrade baseline before fleet-wide rollout.</p>',
      try: [
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o'],
        ['🐧 Ch 13 — sysctl tuning at fleet scale', '#ch13', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Assuming a "no app code changed" regression   Kernel/OS-level upgrades are changes too -- treat them with the\n' +
      '  cannot be infrastructure-caused                same suspicion as an application deploy when timing correlates.\n' +
      'Rolling back the kernel immediately           If the upgrade also carries a security fix, rolling back re-opens\n' +
      '  without checking why it slowed things down    that exposure -- diagnose and override the specific behavior first.\n' +
      'Profiling only AFTER the regression is         Without a pre-existing baseline (continuous profiling, Ch 5),\n' +
      '  reported, with no "before" to diff against     you cannot cleanly separate "new" from "always there."\n' +
      'Treating a scheduler-default change as a      Check the kernel changelog between versions first -- many\n' +
      '  bug to report upstream immediately             "regressions" are documented, intentional behavior changes.\n' +
      'Fixing the regression on one host only        The fix (a sysctl override) must go through the fleet-wide,\n' +
      '  during the incident                            versioned baseline (Ch 13), or the fix itself becomes drift.\n' +
      'Closing the incident without changing the     A regression that reached production undetected until users\n' +
      '  kernel-upgrade rollout process                 noticed means the rollout process itself needs a canary gate.</code></pre>' +
      '<p><b>The real test:</b> after this incident, does the NEXT kernel upgrade get an automated before/after performance comparison ' +
      'during a canary stage — or does the fleet just wait for the next "everything is slow" report to start the same investigation from ' +
      'scratch?</p>',
      try: [
        ['🐧 Ch 11 — debugging production kernel panics & oopses', '#ch11', 'o'],
        ['🐧 Ch 12 — live kernel patching', '#ch12', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>The expert-level lesson of this case study is not the specific scheduler tunable — it is the investigative shape: scope ' +
      '(fleet-wide vs host-specific), timing correlation (what changed, exactly when), a broad unbiased profile before forming a theory, ' +
      'a diff against a pre-existing baseline rather than a fresh guess, and a fix that goes through the same versioned-config discipline ' +
      '(Ch 13) as everything else — plus a process change so the same class of regression is caught automatically next time.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Walk me through your first three actions when every service\'s p99 latency doubles fleet-wide with no app deploy.\n' +
      'A: First, confirm scope (is this every host, or a subset with something in common). Second, confirm timing\n' +
      "   correlation against anything that DID change (kernel upgrade, config push, traffic pattern). Third,\n" +
      '   take a broad perf record -a -g profile on an affected host before forming any theory.\n\n' +
      'Q: Why was having a continuous, pre-existing performance baseline critical to solving this case?\n' +
      "A: Without a \"before\" profile captured before anyone knew there would be a regression, there is nothing\n" +
      '   to diff the "after" profile against -- you cannot cleanly distinguish a genuinely new hot path from one\n' +
      '   that was always there but never investigated.\n\n' +
      'Q: The new kernel also fixes a security CVE. Why not just roll back to resolve the latency regression fastest?\n' +
      'A: Rolling back re-opens the security exposure the upgrade existed to close. The correct fix is diagnosing\n' +
      '   the specific regressed behavior and overriding it explicitly (e.g. a scheduler-related sysctl), keeping\n' +
      '   the security fix while addressing the performance side-effect.\n\n' +
      'Q: Why does the fix need to go through the fleet-wide sysctl baseline rather than being applied ad hoc during the incident?\n' +
      'A: An ad hoc, undocumented fix applied only to the affected hosts during the incident becomes untracked\n' +
      '   drift the moment those hosts are reimaged or new hosts are added -- it needs to be versioned config\n' +
      '   (Ch 13) applied consistently fleet-wide.\n\n' +
      'Q: What should change in the kernel-upgrade rollout PROCESS as a result of this incident, not just the immediate fix?\n' +
      'A: Add a canary stage with an automated before/after performance comparison (perf-based) against the\n' +
      "   pre-upgrade baseline, so a regression like this is caught before fleet-wide rollout, not after users notice.</code></pre>",
      try: [
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'p99 latency doubles fleet-wide with no application deploy, right after a weekend kernel security upgrade. What is the correct first diagnostic instinct?',
      opts: [
        'Assume it must be an application bug and start reviewing recent code commits, since the kernel is unlikely to matter',
        'Treat the kernel upgrade as a real change worth investigating -- confirm the version/timing correlation fleet-wide, then take a broad perf profile before forming a theory',
        'Immediately roll back the kernel without further investigation',
        'Wait a few days to see if the latency resolves on its own'],
      ok: 1,
      why: 'An infrastructure-level change (a kernel upgrade) is a change like any other and should be suspected when its timing correlates with a fleet-wide regression that has no corresponding application deploy.' },
    { q: 'Why was it important that the team already had continuous profiling data from before the kernel upgrade?',
      opts: [
        'It was not important -- a fresh profile taken after the regression would have been just as useful',
        'Without a pre-existing "before" baseline, there is nothing to diff the "after" profile against, making it much harder to isolate what specifically got worse',
        'Continuous profiling is only useful for security auditing, not performance regressions',
        'Old profiles are required by compliance regulations regardless of their diagnostic value'],
      ok: 1,
      why: 'A performance diff (perf diff) requires two points of comparison. A pre-existing baseline turns "something in here changed" into "this exact function/path became different," dramatically narrowing the investigation.' },
    { q: 'The new kernel fixes a security CVE but also caused a latency regression. Why is rolling back the kernel not the right fix?',
      opts: [
        'Rolling back kernels is technically impossible once deployed',
        'Rolling back would re-expose the security vulnerability the upgrade was meant to close -- the correct approach is to diagnose and explicitly override the specific regressed behavior instead',
        'The latency regression was unrelated to the kernel and rolling back would not help anyway',
        'Kernel rollbacks always cause data loss and are never advisable'],
      ok: 1,
      why: 'Rolling back trades a known, already-fixed security exposure for temporary performance relief. The better path is identifying the specific behavioral change (often a changed default) and overriding just that, keeping the security fix intact.' }
  ]
};
