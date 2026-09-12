/* linux-hpc-security Learn — Part 4 · Chapter 2: CIS Benchmarks as Code */
window.CH[2] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Someone downloaded the CIS Benchmark PDF for RHEL 9, printed it, and a few settings got applied by hand on the golden image ' +
      'eighteen months ago. Nobody has looked at it since — not because the fleet is compliant, but because nobody is checking. A PDF ' +
      'is a snapshot of somebody\'s reading comprehension on the day they applied it; it has no idea what the fleet looks like today.</p>' +
      '<pre><code>CIS Benchmark as a 200-page PDF     →     CIS Benchmark as a versioned Ansible role in git,\n' +
      '  (read once, applied by hand,              run in CI on every commit, re-applied on every\n' +
      '  trusted forever)                           config-management run, diffed on every drift</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A recipe card taped to the wall vs. a bakery\'s automated dough line.</b> ' +
      'The recipe card is correct, but a tired baker at 4am will still skip a step. The automated line applies every step, every batch, ' +
      'identically — and if an ingredient is missing it stops the line instead of shipping bad bread.</p></div>',
      try: [
        ['📖 CIS Benchmarks — official list', 'https://www.cisecurity.org/cis-benchmarks', 'o'],
        ['🛡️ Ch 1 — DISA STIG automation at fleet scale', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>CIS publishes Benchmarks as PDF/XCCDF pairs and ships an assessment tool, <b>CIS-CAT</b>, that scores a host against a profile. ' +
      'At fleet scale the benchmark itself is encoded as a versioned <b>Ansible role</b> (the community <code>ansible-lockdown</code> roles ' +
      'are the reference implementation) so "apply the CIS Benchmark" is a CI job, not a person with a checklist:</p>' +
      '<pre><code># pull the community CIS role for RHEL 9 and pin it to a version in requirements.yml\n' +
      '$ ansible-galaxy install -r requirements.yml   # ansible-lockdown.RHEL9-CIS, pinned tag\n\n' +
      '# dry-run Level 1 Server controls against an inventory before touching anything\n' +
      '$ ansible-playbook site.yml -i inventory.ini --tags level1-server --check --diff\n\n' +
      '# score a live host against the CIS profile with the official assessment tool\n' +
      '$ ./CIS-CAT-Lite.sh -b benchmarks/CIS_RHEL9_Benchmark.xml -p "Level 1 - Server"</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern is a <b><code>ansible-lockdown</code></b> ' +
      '(or equivalent internally-maintained) role per OS/profile, version-pinned in <code>requirements.yml</code>, run through ' +
      '<b>Molecule</b> for role testing and applied via the same CI/CD pipeline as every other config-management change — with ' +
      '<b>CIS-CAT</b> or OpenSCAP used as the independent scoring/verification tool, not as the enforcement mechanism itself.</p></div>',
      try: [
        ['📖 CIS-CAT Lite — assessment tool', 'https://www.cisecurity.org/cybersecurity-tools/cis-cat-lite', 'o'],
        ['📖 ansible-lockdown — community CIS roles', 'https://github.com/ansible-lockdown', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>CIS and STIG disagree, and both are "authoritative".</b> ' +
      'The CIS Benchmark sets password max-age to 365 days; the DISA STIG for the same OS sets it to 60. A host subject to both frameworks ' +
      'cannot satisfy both literally. Fix: pick the stricter control per-setting and document the mapping (a control-overlap matrix) so an ' +
      'auditor sees a deliberate reconciliation, not an accidental inconsistency between two roles fighting over the same file.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The drift alert that was actually a legitimate change.</b> ' +
      'A nightly CIS-drift job flags 40 nodes for a changed SSH <code>MaxAuthTries</code> value — turns out a different team\'s emergency ' +
      'change to unblock a broken automation pipeline reverted it, then never got reconciled back into the CIS role\'s defaults. Fix: drift ' +
      'alerts need a fast path to "re-apply the role" and a separate, deliberate path to "update the role\'s defaults" — conflating the two ' +
      'means real regressions and intentional exceptions look identical in the alert queue.</p></div>' +
      '<p><b>Version-pin everything:</b> a CIS role that auto-updates to "latest" on every run can silently change what "compliant" means ' +
      'for the whole fleet overnight. Pin the role version and bump it deliberately, the same way you\'d bump any other dependency.</p>',
      try: [
        ['📖 CIS Controls — mapping & frameworks', 'https://www.cisecurity.org/controls', 'o'],
        ['🛡️ Ch 13 — compliance-as-code with OpenSCAP', '#ch13', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'CIS Benchmark applied once by hand from     Encode it as a versioned Ansible role, run through CI, applied\n' +
      '  a printed/PDF checklist                    on every config-management run — not a one-time manual pass.\n' +
      'Role pulls "latest" on every run             Pin the role to a specific tag/commit; bump it as a deliberate,\n' +
      '                                             reviewed change like any other dependency upgrade.\n' +
      'CIS and STIG roles both fight over the       Reconcile into one authoritative control per setting (usually the\n' +
      '  same setting with no reconciliation          stricter one) with a documented mapping/overlap matrix.\n' +
      'Drift alerts treated as uniform "re-apply    Distinguish real regression (re-apply the role) from a deliberate\n' +
      '  the role" actions                           exception (update the role\'s defaults) — don\'t conflate them.\n' +
      'No environment-specific tailoring            Use CIS profile levels (1/2, Server/Workstation) and Ansible\n' +
      '                                             variables to tailor per fleet segment instead of one rigid role.\n' +
      'Compliance score reported without context     Report score alongside WHICH controls are failing and why —\n' +
      '                                             a 95% score hiding a disabled firewall is worse than 80% without one.</code></pre>' +
      '<p><b>The real test:</b> if two engineers on different days run the CIS role against the same fresh VM, do they get byte-identical ' +
      'results? If not, the "benchmark as code" still has hand-applied steps hiding in it somewhere.</p>',
      try: [
        ['📖 CIS Benchmarks — Ansible/Chef/Puppet automation content', 'https://www.cisecurity.org/cis-benchmarks', 'o'],
        ['🛡️ Ch 16 — the compliance-as-code security platform reference architecture', '#ch16', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, "CIS Benchmarks as code" is really a special case of the same continuous-verification problem as Ch 1\'s STIG ' +
      'pipeline: a control framework only stays true of the fleet if it is re-derived on every run instead of trusted from a past ' +
      'application. The distinctive hard part for CIS specifically is <b>reconciliation</b> — CIS, STIG, and internal baselines routinely ' +
      'overlap and occasionally conflict, and an engineering team has to own a single source of truth per setting rather than letting three ' +
      'automation systems silently overwrite each other.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why encode a CIS Benchmark as an Ansible role instead of a one-time hardening checklist?\n' +
      'A: A checklist proves compliance on the day it was applied. An Ansible role re-applies (or at least\n' +
      "   re-verifies) the benchmark on every run, so compliance is a continuously regenerated fact, not a\n" +
      '   stale artifact — and it can run through the same CI/CD review process as any other change.\n\n' +
      'Q: A host is subject to both a CIS Benchmark and a DISA STIG with conflicting values for the same\n' +
      '   setting. How do you resolve it?\n' +
      'A: Pick one authoritative value per setting (usually the stricter one) and document the mapping in a\n' +
      '   control-overlap matrix, so the reconciliation is deliberate and auditable rather than accidental.\n\n' +
      'Q: Why pin the CIS role to a specific version instead of always pulling latest?\n' +
      'A: An auto-updating role can silently redefine "compliant" fleet-wide overnight. Pinning makes a\n' +
      '   benchmark version bump a deliberate, reviewed change like any other dependency upgrade.\n\n' +
      'Q: A nightly drift job flags 40 nodes for a changed setting. What is the first question you ask?\n' +
      'A: Whether this is an unintended regression (re-apply the role) or the trace of a deliberate,\n' +
      '   undocumented exception (needs a role-default update) — treating both the same erodes trust in the\n' +
      '   drift-alerting system either by causing outages or by training people to ignore it.\n\n' +
      'Q: Is a 95% CIS compliance score, by itself, a meaningful signal to report to leadership?\n' +
      'A: Not without knowing which 5% is failing — a high score hiding a disabled firewall or open SSH root\n' +
      '   login is a worse posture than a lower score concentrated in low-severity, cosmetic settings.</code></pre>',
      try: [
        ['📖 CIS — SecureSuite membership & automation content', 'https://www.cisecurity.org/cybersecurity-tools/cis-securesuite', 'o'],
        ['🛡️ Ch 12 — vulnerability & patch-risk scoring at fleet scale', '#ch12', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is a CIS Benchmark applied by hand from a PDF checklist a weaker compliance posture than one encoded as an Ansible role?',
      opts: [
        'PDFs cannot contain accurate security settings',
        'A hand-applied checklist proves compliance only at the moment it was applied, while a versioned role can be re-applied and re-verified on every run, catching drift',
        'Ansible roles are required by CIS licensing terms',
        'CIS Benchmarks are only published in Ansible format'],
      ok: 1,
      why: 'The core value of "as code" is continuous re-application and re-verification, turning a one-time snapshot into an ongoing, checkable state.' },
    { q: 'A host must satisfy both a CIS Benchmark and a DISA STIG that specify conflicting values for the same setting. What is the correct approach?',
      opts: [
        'Apply whichever role ran most recently and ignore the conflict',
        'Reconcile to one authoritative value per setting (typically the stricter one) and document the mapping in an overlap matrix',
        'Disable both frameworks\' automation for that setting permanently',
        'Alternate between the two values on different days'],
      ok: 1,
      why: 'Conflicting frameworks need a deliberate, documented reconciliation so an auditor sees an intentional decision, not an accidental inconsistency between competing automation.' },
    { q: 'Why should a CIS Ansible role be version-pinned in requirements.yml rather than always pulling the latest release?',
      opts: [
        'Pinning is required for CIS-CAT to function at all',
        'An auto-updating role could silently change what "compliant" means fleet-wide overnight; pinning makes a version bump a deliberate, reviewed change',
        'Unpinned roles cannot be run inside CI pipelines',
        'Version pinning has no real effect on compliance automation'],
      ok: 1,
      why: 'Treating the benchmark role like any other dependency — pinned, reviewed, deliberately bumped — prevents an unreviewed upstream change from redefining fleet-wide compliance without anyone noticing.' }
  ]
};
