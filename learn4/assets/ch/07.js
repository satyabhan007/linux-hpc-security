/* linux-hpc-security Learn — Part 4 · Chapter 7: Security Patching Pipelines */
window.CH[7] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A critical kernel CVE drops. The instinct is "patch everything tonight" — so a maintenance window rolls a kernel update to ' +
      'all five thousand nodes at once, half of them reboot into a kernel/driver combination nobody tested, and now there is an outage ' +
      'bigger than the vulnerability ever would have caused. Patching fast and patching safely are different skills, and treating them ' +
      'as the same thing is how a security fix becomes the incident.</p>' +
      '<pre><code>Patch all 5,000 nodes in one maintenance     →     Patch a canary ring first, watch it, then patch\n' +
      '  window because the CVE is "critical"              wider rings on a schedule driven by real signal</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Tasting a new recipe on one dinner table before serving the whole ' +
      'restaurant.</b> The head chef does not serve a never-tried dish to every table simultaneously just because the ingredients are ' +
      'urgent to use — one table tastes it first, and if something is wrong, only one table sends it back.</p></div>',
      try: [
        ['📖 CISA — Known Exploited Vulnerabilities catalog', 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', 'o'],
        ['🛡️ Ch 1 — DISA STIG automation at fleet scale', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A fleet patching pipeline rolls updates through <b>canary rings</b> (a small, monitored subset first, then progressively ' +
      'wider rings) and prefers <b>live-patching</b> (applying a kernel fix without a reboot) as the fastest safe first response to a ' +
      'zero-day, buying time for a full, tested reboot-based rollout:</p>' +
      '<pre><code># check what CVEs a live-patch (kpatch / kernel livepatch) already covers, no reboot required\n' +
      '$ kpatch list\n' +
      '$ uname -v      # confirm the live-patched kernel version is active\n\n' +
      '# roll a full kernel update through progressive rings via Ansible, ring by ring\n' +
      '$ ansible-playbook patch.yml -i inventory.ini --limit ring1_canary --check\n' +
      '$ ansible-playbook patch.yml -i inventory.ini --limit ring1_canary\n' +
      '# ...monitor error rates / health checks for the soak period before proceeding...\n' +
      '$ ansible-playbook patch.yml -i inventory.ini --limit ring2_wider\n\n' +
      '# a documented rollback plan, not an afterthought\n' +
      '$ ansible-playbook rollback.yml -i inventory.ini --limit ring1_canary</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern combines <b>kernel live-patching</b> ' +
      '(<code>kpatch</code> on RHEL/CentOS, <code>livepatch</code> on Ubuntu) for immediate zero-day mitigation with a <b>ring-based ' +
      'rollout</b> (canary → wider rings → full fleet) via Ansible/config management for the underlying full patch, each ring gated by ' +
      'automated health checks and a documented, pre-tested rollback playbook.</p></div>',
      try: [
        ['📖 Red Hat — kpatch documentation', 'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/index', 'o'],
        ['📖 Canonical — Ubuntu Livepatch', 'https://ubuntu.com/security/livepatch', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The canary ring that was too small and too similar.</b> A ' +
      'ten-node canary ring, all running the same hardware/kernel/driver combo, passes cleanly — the wider rollout then hits a driver ' +
      'incompatibility that only exists on a different hardware generation the canary ring never included. Fix: canary rings need to be ' +
      'REPRESENTATIVE of fleet diversity (hardware, kernel version, driver mix), not just "the first ten nodes alphabetically" — a ' +
      'canary of one homogeneous slice tells you almost nothing about the rest.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Live-patch-first triage bought time, then got forgotten.</b> ' +
      'A zero-day gets live-patched fleet-wide within hours — a real win — but the full kernel update that actually fixes the underlying ' +
      'issue permanently never gets scheduled because the live-patch made the pressure disappear. Fix: a live-patch is a bridge, not a ' +
      'destination — it needs a tracked follow-up item with an owner and a deadline for the full, reboot-based remediation.</p></div>' +
      '<p><b>A patch-compliance SLA needs teeth:</b> "critical CVEs patched within 72 hours" is only meaningful if there is a dashboard ' +
      'that shows, in real time, which nodes are currently outside the SLA — not a monthly spreadsheet reconstructed after the fact.</p>',
      try: [
        ['📖 NIST — patch management guidance (SP 800-40)', 'https://csrc.nist.gov/pubs/sp/800/40/r4/final', 'o'],
        ['🛡️ Ch 12 — vulnerability & patch-risk scoring at fleet scale', '#ch12', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Patching all nodes in one maintenance        Roll through canary → wider rings, gated by automated health\n' +
      '  window because the CVE is "critical"         checks at each stage — urgency is not an excuse to skip rings.\n' +
      'Canary ring is homogeneous (same hardware/    Build canary rings that are REPRESENTATIVE of fleet diversity —\n' +
      '  kernel/driver mix as each other)              a uniform canary hides incompatibilities the wider fleet will hit.\n' +
      'Live-patch applied, then the underlying        Track the live-patch as a temporary bridge with an owner and\n' +
      '  full patch never gets scheduled               deadline for the full, reboot-based, permanent remediation.\n' +
      'No rollback plan until something breaks      Write and test the rollback playbook BEFORE the rollout starts,\n' +
      '  mid-rollout                                   not improvised during an active incident.\n' +
      'Patch-compliance SLA tracked in a manually    Drive the SLA dashboard from the same automated scan pipeline\n' +
      '  updated spreadsheet                           (Ch 1) used for compliance — real-time, not reconstructed after the fact.\n' +
      'Same rollout speed for every CVE regardless   Gate rollout speed by risk score (Ch 12) — an actively-exploited\n' +
      '  of severity/exploitability                    CVE with a public PoC moves faster than a low-exposure CVE.</code></pre>' +
      '<p><b>The real test:</b> can you name, right now, exactly which ring a given node is in, when it will get the next patch, and ' +
      'what the automated rollback trigger is if its health checks fail — without asking anyone?</p>',
      try: [
        ['📖 CISA — Binding Operational Directive 22-01 (KEV remediation)', 'https://www.cisa.gov/news-events/directives/bod-22-01-reducing-significant-risk-known-exploited-vulnerabilities', 'o'],
        ['🛡️ Ch 5 — supply-chain security: SBOM & image signing', '#ch5', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, a patching pipeline is a risk-management system balancing two costs that both matter: the cost of staying ' +
      'vulnerable (measured in exploitability and exposure, Ch 12) against the cost of an untested change breaking production (measured ' +
      'in blast radius if the rollout is too aggressive). Canary rings, live-patch-first triage, and rollback plans are all mechanisms ' +
      'for buying real information about a patch\'s safety before betting the whole fleet on it.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is patching all 5,000 nodes in a single maintenance window risky, even for a critical CVE?\n' +
      'A: An untested patch applied everywhere at once turns any incompatibility (driver, kernel, config) into\n' +
      '   a fleet-wide outage instead of a contained, quickly-caught canary failure — the urgency of the CVE\n' +
      '   does not remove the need to verify the fix is safe first.\n\n' +
      'Q: What makes a canary ring effective versus a canary ring that gives false confidence?\n' +
      'A: An effective canary ring is representative of the fleet\'s hardware/kernel/driver diversity; a\n' +
      '   homogeneous canary (e.g. ten identical nodes) can pass cleanly while hiding an incompatibility that\n' +
      '   only shows up on a different slice of the fleet.\n\n' +
      'Q: Why is live-patching (kpatch/livepatch) described as a bridge rather than a solution?\n' +
      'A: It mitigates the immediate risk without a reboot, but the underlying full kernel update still needs\n' +
      "   to be scheduled and applied — without an owner and deadline, the urgency created by the CVE\n" +
      '   disappears along with the live-patch, and the permanent fix never happens.\n\n' +
      'Q: What should a patch-compliance SLA dashboard actually be driven by?\n' +
      'A: The same automated scan pipeline used for STIG/CIS compliance, updated in real time — a manually\n' +
      '   maintained spreadsheet cannot reliably show which nodes are currently outside SLA.\n\n' +
      'Q: Should every CVE roll out through the fleet at the same speed?\n' +
      'A: No — rollout speed should be gated by risk score (severity, exploitability, exposure, Ch 12); an\n' +
      '   actively exploited CVE with a public proof-of-concept warrants faster, more aggressive rollout than\n' +
      '   a theoretical, low-exposure one.</code></pre>',
      try: [
        ['📖 SANS — patch management best practices', 'https://www.sans.org/white-papers/', 'o'],
        ['🛡️ Ch 12 — vulnerability & patch-risk scoring at fleet scale', '#ch12', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is rolling a critical CVE patch to all 5,000 nodes in one maintenance window considered risky?',
      opts: [
        'Because critical CVEs should never be patched quickly',
        'An untested patch applied everywhere at once turns any incompatibility into a fleet-wide outage instead of a contained, quickly-detected canary failure',
        'Maintenance windows are not long enough to patch more than 100 nodes',
        'Kernel patches cannot be applied outside business hours'],
      ok: 1,
      why: 'Canary-then-wider-ring rollout exists specifically to catch incompatibilities on a small, monitored subset before they can affect the whole fleet.' },
    { q: 'What makes a canary ring effective at catching real rollout risk, as opposed to giving false confidence?',
      opts: [
        'Using the largest possible number of nodes in the canary ring',
        'Making the canary ring representative of the fleet\'s hardware, kernel, and driver diversity, rather than a homogeneous subset',
        'Canary rings are equally effective regardless of composition',
        'Choosing canary nodes purely alphabetically by hostname'],
      ok: 1,
      why: 'A homogeneous canary ring can pass cleanly while hiding incompatibilities that only manifest on a different slice of fleet diversity.' },
    { q: 'Why is kernel live-patching (e.g. kpatch) described as a "bridge, not a destination" in a patching pipeline?',
      opts: [
        'Live-patching is unsafe and should never be used',
        'It mitigates immediate risk without a reboot, but the underlying full patch still needs a tracked owner and deadline or the permanent fix never gets applied',
        'Live-patches automatically expire after 24 hours',
        'Live-patching replaces the need for canary rings entirely'],
      ok: 1,
      why: 'Live-patching buys time by removing urgency, which can cause the permanent, reboot-based remediation to be forgotten unless it is explicitly tracked.' }
  ]
};
