/* linux-hpc-security Learn — Part 2 · Chapter 13: sysctl Tuning at Fleet Scale */
window.CH[13] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Someone SSHes into a struggling production box at 2am, runs <code>sysctl -w net.core.somaxconn=4096</code> to fix a connection ' +
      'backlog issue, and the incident is resolved. Six months later, that same box is reimaged after a hardware failure — and the ' +
      'problem comes back, because the fix was never written down anywhere. A <b>sysctl</b> is a live kernel parameter; the value only ' +
      'matters if it survives the next reboot, the next reimage, and the next person who touches the box.</p>' +
      '<pre><code>sysctl -w net.core.somaxconn=4096   # fixes it right now, in memory only\n' +
      '                                     # ... reboots, disappears, nobody remembers why it was set</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A sticky note taped to one specific server versus a documented ' +
      'building-wide policy.</b> A sticky note ("set this to 4096, ask Dave") helps exactly one box, exactly once, until Dave leaves or ' +
      'the box is replaced. Fleet-scale sysctl management means the setting lives in version control, applies consistently everywhere it ' +
      'is needed, and survives every person and every box.</p></div>',
      try: [
        ['📖 man7.org — sysctl(8)', 'https://man7.org/linux/man-pages/man8/sysctl.8.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><code>sysctl</code> reads and writes kernel tunables under <code>/proc/sys/</code>. Runtime changes ' +
      '(<code>sysctl -w</code>) do not survive reboot; persistent changes belong in files under ' +
      '<code>/etc/sysctl.d/</code>, applied at boot by <code>systemd-sysctl</code>. Fleet-scale management means those files are ' +
      'generated from version-controlled config, not hand-edited per host.</p>' +
      '<pre><code># view current value and where it would persist\n' +
      '$ sysctl net.core.somaxconn\n' +
      '$ cat /proc/sys/net/core/somaxconn\n\n' +
      '# runtime-only change (lost on reboot)\n' +
      '$ sudo sysctl -w vm.swappiness=10\n\n' +
      '# persistent change: drop a file, apply immediately, confirm no conflicts\n' +
      '$ cat /etc/sysctl.d/99-fleet-baseline.conf\n' +
      'vm.swappiness = 10\n' +
      'net.core.somaxconn = 4096\n' +
      'net.ipv4.tcp_max_syn_backlog = 8192\n' +
      '$ sudo sysctl --system                    # reload all sysctl.d files in priority order\n' +
      '$ sudo sysctl --system --dry-run 2>&1 | grep -i conflict   # catch two files setting the same key differently</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard mechanism is <b><code>/etc/sysctl.d/*.conf</code></b> ' +
      'files loaded by <b><code>systemd-sysctl</code></b> at boot (or <code>sysctl --system</code> on demand), managed fleet-wide via ' +
      '<b>Ansible/Puppet/Salt</b> modules that render these files from a single source of truth rather than editing each host by ' +
      'hand.</p></div>',
      try: [
        ['📖 man7.org — sysctl.d(5)', 'https://man7.org/linux/man-pages/man5/sysctl.d.5.html', 'o'],
        ['📖 Kernel docs — sysctl documentation index', 'https://docs.kernel.org/admin-guide/sysctl/index.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A fleet-wide sysctl baseline in config management.</b> A team ' +
      'maintains hundreds of hosts with slightly different sysctl values accumulated over years of ad-hoc tuning, making "what is our ' +
      'actual network tuning" an unanswerable question. Fix: define a single Ansible role that renders ' +
      '<code>/etc/sysctl.d/99-fleet-baseline.conf</code> from one templated source, applied idempotently to every host, with any ' +
      'host-specific overrides in a clearly separate, lower-priority file — turning "tribal knowledge on random boxes" into ' +
      'reviewable, versioned config.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Catching sysctl drift with a CI check.</b> A host is found to ' +
      'have a manually-set <code>net.ipv4.ip_forward=1</code> that was never intended and does not match the baseline — set months ago ' +
      'during a one-off debugging session and forgotten. Fix: a periodic drift-detection job compares live ' +
      '<code>sysctl -a</code> output (for the keys the baseline manages) against the intended config, alerting on any mismatch so ad-hoc ' +
      'changes get caught within days, not discovered accidentally during a security review years later.</p></div>' +
      '<p><b>Rolling back a bad <code>net.core</code> tuning change</b> is safest when the baseline itself is versioned: reverting the ' +
      'config-management commit and re-applying is faster and less error-prone than trying to remember and manually unwind a change ' +
      'made under incident pressure.</p>',
      try: [
        ['📖 man7.org — sysctl.d(5)', 'https://man7.org/linux/man-pages/man5/sysctl.d.5.html', 'o'],
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Making an incident-time sysctl -w change     Immediately follow up by committing the equivalent change to\n' +
      '  and never following up with persistence      version-controlled sysctl.d config, or it disappears on reboot.\n' +
      'Editing /etc/sysctl.conf or sysctl.d          Manage sysctl files through config management (Ansible/Puppet/\n' +
      '  files by hand, per host                       Salt) from one source of truth, not host-by-host manual edits.\n' +
      'Two sysctl.d files silently setting the      Use sysctl --system --dry-run (or equivalent lint) in CI to\n' +
      '  same key to different values                  catch conflicting definitions before they reach production.\n' +
      'Applying a new sysctl baseline fleet-wide    Canary the change on a subset of hosts under real load first --\n' +
      '  without staged rollout                        a value that is safe on one workload profile may not be on another.\n' +
      'Treating sysctl values as "set once,          Kernel defaults and recommended values change across kernel/\n' +
      '  never revisit"                                 distro versions -- periodically re-validate the baseline still\n' +
      '                                                 applies to the currently deployed kernel.\n' +
      'Ignoring namespaced sysctls in containers    Some sysctls are per-network-namespace and must be set inside\n' +
      '  vs host-level ones                             the container/pod, not just on the host -- know which is which.</code></pre>' +
      '<p><b>The real test:</b> if a host in your fleet were reimaged today, would every sysctl value that actually matters for its ' +
      'workload come back automatically from version-controlled config — or would someone need to remember and manually reapply a list ' +
      'of tribal-knowledge tweaks?</p>',
      try: [
        ['📖 Kernel docs — sysctl documentation index', 'https://docs.kernel.org/admin-guide/sysctl/index.html', 'o'],
        ['🐧 Ch 14 — container vs VM kernel isolation tradeoffs', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, sysctl management is treated exactly like application config: versioned, code-reviewed, tested under ' +
      'representative load in staging/canary before fleet-wide rollout, and continuously monitored for drift. The distinction between ' +
      '"tuning" and "configuration" collapses — a wrong <code>net.ipv4.tcp_*</code> value is as capable of causing an outage as a bad ' +
      'application deploy, and deserves the same rigor.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: An engineer runs `sysctl -w` to fix an incident at 2am. What is the required follow-up, and why?\n' +
      "A: Commit the equivalent setting to version-controlled sysctl.d config (via config management) so it\n" +
      '   survives reboot/reimage and is documented -- a runtime-only sysctl -w change is invisible to\n' +
      '   everyone else and disappears the next time the kernel restarts.\n\n' +
      'Q: Why can two sysctl.d files both being "correct" individually still cause a production problem?\n' +
      'A: If they set the same key to different values, the file with the later load priority silently wins --\n' +
      '   `sysctl --system --dry-run` or equivalent linting in CI catches this kind of conflict before deploy.\n\n' +
      'Q: Why should a new fleet-wide sysctl baseline be canaried rather than applied to every host at once?\n' +
      'A: A value safe for one workload profile (e.g. a web tier\'s TCP backlog tuning) may be wrong for another\n' +
      '   (e.g. a database node) -- staged rollout under real load surfaces workload-specific problems before\n' +
      '   they become fleet-wide incidents.\n\n' +
      'Q: Why do some sysctls need to be set inside a container/pod rather than only on the host?\n' +
      'A: Certain sysctls (many under net.*) are per-network-namespace, so a host-level setting does not\n' +
      '   automatically apply inside a container with its own network namespace -- it must be set within\n' +
      "   that namespace explicitly (subject to what the container runtime/orchestrator allows).\n\n" +
      'Q: How would you detect sysctl drift across a fleet before it causes an incident?\n' +
      'A: A periodic job comparing live sysctl -a output against the intended versioned baseline, alerting on\n' +
      '   any mismatch -- turning silent, ad-hoc changes into a caught, actionable signal within days.</code></pre>',
      try: [
        ['📖 man7.org — sysctl(8)', 'https://man7.org/linux/man-pages/man8/sysctl.8.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'An engineer runs `sysctl -w net.core.somaxconn=4096` during an incident and the problem resolves. What critical follow-up step is required?',
      opts: [
        'Nothing further is needed -- the fix is already applied',
        'Commit the equivalent setting to version-controlled sysctl.d config via config management, since a runtime-only sysctl -w change is lost on the next reboot or reimage',
        'Reboot the box immediately to make the change take effect',
        'Email the team about the change instead of persisting it anywhere'],
      ok: 1,
      why: 'sysctl -w only changes the live, in-memory kernel parameter. Without persisting the equivalent value to /etc/sysctl.d/ (managed by version control), the fix silently disappears the next time the kernel restarts.' },
    { q: 'Why can two individually-valid `/etc/sysctl.d/` files still cause a production problem when both are deployed?',
      opts: [
        'sysctl.d files are limited to one per host and having two causes a boot failure',
        'If both files set the same key to different values, the file with later load priority silently wins, which can produce an unintended effective configuration undetected until it causes an incident',
        'Only the first alphabetically-named file is ever read',
        'sysctl.d files cannot coexist and the system will refuse to boot'],
      ok: 1,
      why: 'systemd-sysctl applies files in priority order, and a later file silently overrides an earlier one for the same key. Without a conflict check (e.g. sysctl --system --dry-run in CI), this can produce a surprising effective value.' },
    { q: 'Why should a new fleet-wide sysctl baseline be rolled out via canary rather than applied to every host simultaneously?',
      opts: [
        'Canary rollouts are only needed for application code, never for kernel parameters',
        'A value that is safe for one workload profile (e.g. a web tier) may cause problems for a different workload profile (e.g. a database node) under real production load',
        'sysctl changes cannot be applied to more than one host at a time due to a kernel limitation',
        'Canarying sysctl changes is unnecessary since sysctl values never affect running services'],
      ok: 1,
      why: 'Different workloads stress the kernel differently, so a tuning value validated in one context is not guaranteed safe in another. Staged rollout under real load surfaces workload-specific issues before they affect the whole fleet.' }
  ]
};
