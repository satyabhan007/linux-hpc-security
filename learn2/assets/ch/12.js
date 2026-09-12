/* linux-hpc-security Learn — Part 2 · Chapter 12: Live Kernel Patching */
window.CH[12] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A critical kernel CVE drops on a Tuesday. The fix requires a new kernel, which requires a reboot, which requires a ' +
      'maintenance window, which requires scheduling around a fleet of stateful services that take twenty minutes each to drain and ' +
      'restart safely. Multiply by a few hundred hosts and "just patch it" becomes a multi-week project — while the CVE sits ' +
      'unpatched. <b>Live kernel patching</b> exists to close exactly this gap: fixing the running kernel in memory, with no reboot.</p>' +
      '<pre><code>Traditional patch:  install new kernel  →  reboot  →  new kernel loads  →  fixed (minutes of downtime)\n' +
      'Live patch:         running kernel\'s code is replaced in memory, in place  →  fixed (no downtime)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Replacing a plane\'s engine part mid-flight instead of landing ' +
      'first.</b> It sounds implausible, but for a narrow, well-understood category of fix (swap one specific faulty component for a ' +
      'compatible one) it is exactly what live patching does to a running kernel — carefully, and only for changes that fit the ' +
      'technique\'s constraints.</p></div>',
      try: [
        ['📖 Kernel docs — Livepatch', 'https://docs.kernel.org/livepatch/livepatch.html', 'o'],
        ['🐧 Ch 11 — debugging production kernel panics & oopses', '#ch11', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The mainline kernel\'s built-in mechanism is <b>livepatch</b> (built on <b>ftrace</b>\'s function-redirection ' +
      'infrastructure), with <b>kpatch</b> (Red Hat) as the tooling that builds a livepatch kernel module from a source diff. A ' +
      'commercial alternative, <b>kGraft</b> (SUSE-originated, now converged with kpatch/livepatch upstream), pioneered the same idea. ' +
      'Each redirects calls from the old, vulnerable function to a new, patched one, loaded as a kernel module.</p>' +
      '<pre><code># build a kpatch module from a source-level patch against the running kernel\n' +
      '$ kpatch-build -t vmlinux --sourcedir /usr/src/kernels/$(uname -r) my-cve-fix.patch\n' +
      '$ ls kpatch-*.ko\n\n' +
      '# load it into the running kernel -- no reboot\n' +
      '$ sudo kpatch load kpatch-my-cve-fix.ko\n\n' +
      '# confirm it is active and see what it patches\n' +
      '$ sudo kpatch list\n' +
      'Loaded patch modules:\n' +
      'kpatch_my_cve_fix [enabled]\n\n' +
      '# make it persist across future reboots too (until a real kernel upgrade supersedes it)\n' +
      '$ sudo kpatch install kpatch-my-cve-fix.ko</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard toolchain is <b><code>kpatch</code></b> (build/load/manage) ' +
      'on top of the kernel\'s <b>livepatch</b> infrastructure, or a vendor-distributed pre-built livepatch (Red Hat, SUSE, Canonical ' +
      'Livepatch, TuxCare) for CVEs the distro has already validated — most fleets consume pre-built patches rather than building their ' +
      'own from source diffs.</p></div>',
      try: [
        ['📖 Red Hat docs — kpatch', 'https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/applying-patches-with-kernel-live-patching_managing-monitoring-and-updating-the-kernel', 'o'],
        ['📖 LWN — Kernel live patching', 'https://lwn.net/Articles/634649/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Rolling out a kpatch module fleet-wide.</b> A critical, ' +
      'actively-exploited privilege-escalation CVE is announced, and stateful database nodes cannot take a reboot window for another two ' +
      'weeks per policy. Fix: deploy the vendor-provided livepatch via the fleet\'s config management (a package install plus ' +
      '<code>kpatch load</code>, or the distro\'s livepatch client service) to close the exposure window immediately, then still ' +
      'schedule the eventual full kernel upgrade during the planned maintenance window — live patching buys time, it does not replace ' +
      'the underlying upgrade.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Deciding when live-patching is NOT enough.</b> A CVE fix ' +
      'requires changing an in-memory data structure\'s layout (not just a function\'s logic), which livepatch\'s function-redirection ' +
      'model cannot safely express — some fixes need a real reboot because the running kernel\'s in-memory state itself is incompatible ' +
      'with the fix. Fix: recognize this class of CVE early (vendor advisories typically state "not livepatch-eligible") and prioritize ' +
      'those hosts for the next real maintenance window instead of assuming live patching is universally applicable.</p></div>' +
      '<p><b>Verifying a live patch actually applied</b> is not optional: <code>kpatch list</code> confirms the module loaded, but ' +
      'confirming the vulnerable code path is actually unreachable (e.g. via the vendor\'s specific verification steps, or checking ' +
      '<code>/sys/kernel/livepatch/&lt;patch&gt;/enabled</code>) closes the loop that the fix is not just loaded but active.</p>',
      try: [
        ['📖 Kernel docs — Livepatch', 'https://docs.kernel.org/livepatch/livepatch.html', 'o'],
        ['🐧 Ch 13 — sysctl tuning at fleet scale', '#ch13', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Treating a live patch as a permanent          Schedule the real kernel upgrade during the next maintenance\n' +
      '  substitute for the underlying kernel upgrade  window regardless -- live patching buys time, it is not a\n' +
      '                                                permanent replacement for staying on a supported kernel.\n' +
      'Assuming every CVE fix is livepatch-eligible  Some fixes change in-memory data structure layout, which\n' +
      '                                                function-redirection livepatching cannot safely express --\n' +
      '                                                check the vendor advisory\'s livepatch eligibility explicitly.\n' +
      'Loading a kpatch module without verifying     kpatch list confirms the module loaded; separately confirm the\n' +
      '  the patch is actually active                  vulnerable path is unreachable per the vendor\'s verification steps.\n' +
      'Building kpatch modules from source diffs     Building your own kpatch modules requires exactly matching build\n' +
      '  in-house without matching build environment  environment/compiler versions to the running kernel -- mismatches\n' +
      '                                                can produce a patch that fails to load or behaves unpredictably.\n' +
      'Stacking many live patches indefinitely       Layered live patches accumulate complexity and edge cases --\n' +
      '  instead of periodically rebasing               periodically roll accumulated patches into a real kernel upgrade.\n' +
      'Skipping the maintenance-window kernel        Even with live patching in place, a fleet that never reboots to a\n' +
      '  upgrade schedule entirely                     current kernel accumulates non-livepatch-eligible debt over time.</code></pre>' +
      '<p><b>The real test:</b> for a livepatch deployment, can you show both "the module is loaded" (<code>kpatch list</code>) and "the ' +
      'vulnerable path is actually closed" (a specific verification step), rather than assuming load success equals fix success?</p>',
      try: [
        ['📖 Red Hat docs — kpatch', 'https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/applying-patches-with-kernel-live-patching_managing-monitoring-and-updating-the-kernel', 'o'],
        ['🐧 Ch 11 — debugging production kernel panics & oopses', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, live patching is a bridge, not a destination: it closes the exposure window between "CVE announced" and ' +
      '"fleet-wide reboot completed" for the specific class of fixes that fit function-redirection (most security fixes; not data ' +
      'structure layout changes), while the fleet still needs a disciplined, regular kernel-upgrade cadence so live-patch debt does not ' +
      'accumulate indefinitely and so non-eligible fixes still get applied on a predictable schedule.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What class of kernel fix CANNOT be safely applied via live patching, and why?\n' +
      "A: Fixes that change in-memory data structure layout, because livepatch's function-redirection model\n" +
      '   redirects calls to new code but cannot safely reconcile old in-memory structures with a new layout\n' +
      '   the running kernel is already using -- those require a real reboot.\n\n' +
      'Q: Why is `kpatch list` showing a patch as loaded not sufficient proof the CVE is actually fixed?\n' +
      'A: It confirms the module loaded into the kernel, not that the vulnerable code path is unreachable in\n' +
      '   practice -- verification requires the vendor\'s specific check (or confirming the patched function is\n' +
      '   actually the one being called via the redirection).\n\n' +
      'Q: Why should a fleet still maintain a regular kernel-upgrade cadence even with live patching in place?\n' +
      'A: Live patches accumulate as layered fixes over time, adding complexity, and some CVEs are simply not\n' +
      '   livepatch-eligible -- without periodic real upgrades, both patch-stack complexity and unpatched-CVE\n' +
      '   debt grow unbounded.\n\n' +
      'Q: What underlying kernel mechanism does livepatch build on to redirect execution to patched code?\n' +
      'A: ftrace\'s function-redirection infrastructure -- the same mechanism used for tracing is repurposed to\n' +
      '   transparently redirect calls from the original vulnerable function to the patched replacement.\n\n' +
      'Q: When would you choose a vendor-distributed livepatch over building one in-house with kpatch-build?\n' +
      'A: Almost always for production -- building your own requires an exactly matching build environment to\n' +
      "   the running kernel, and a vendor's pre-built, pre-validated patch removes that risk and the validation\n" +
      '   burden entirely.</code></pre>',
      try: [
        ['📖 Kernel docs — Livepatch', 'https://docs.kernel.org/livepatch/livepatch.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why can some kernel CVE fixes NOT be applied via live patching, requiring a full reboot instead?',
      opts: [
        'Live patching is purely theoretical and has never worked in production',
        'Fixes that change in-memory data structure layout cannot be safely applied through livepatch\'s function-redirection model, since the running kernel\'s existing in-memory state would be incompatible with the new layout',
        'Live patching only works on kernels compiled with a specific unsupported flag',
        'Live patching can only fix userspace bugs, never kernel bugs'],
      ok: 1,
      why: 'Livepatch redirects function calls to new code, but it cannot retroactively change the layout of data structures already in memory. Fixes requiring that kind of structural change need a real reboot into a new kernel.' },
    { q: 'Why is `kpatch list` showing a patch module as loaded and enabled not sufficient proof that a CVE has actually been closed?',
      opts: [
        'kpatch list is always inaccurate and cannot be trusted at all',
        'It only confirms the module loaded into the kernel, not that the specific vulnerable code path is now unreachable -- separate verification against the vendor\'s guidance is needed',
        'kpatch list only works for patches built in-house, never vendor-supplied ones',
        'kpatch list requires a reboot to reflect the true patch status'],
      ok: 1,
      why: 'Module load success and functional fix verification are two different checks. Confirming the patch is loaded does not by itself prove the vulnerable path is actually redirected and closed in practice.' },
    { q: 'Why should a fleet maintain a regular kernel-upgrade cadence even after adopting live patching?',
      opts: [
        'Live patching becomes unnecessary once a fleet is fully upgraded, so upgrades should stop',
        'Live patches accumulate as layered fixes over time and some CVEs are not livepatch-eligible at all, so without periodic real upgrades both patch-stack complexity and unpatched-CVE debt grow unbounded',
        'Kernel upgrades are required by law for all production systems',
        'Live patches expire automatically after 30 days regardless of upgrade cadence'],
      ok: 1,
      why: 'Live patching buys time and closes exposure windows for eligible fixes, but it is not a substitute for staying current -- non-eligible CVEs and accumulating patch-stack complexity both require a real, scheduled kernel upgrade path.' }
  ]
};
