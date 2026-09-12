/* linux-hpc-security Learn — Part 4 · Chapter 1: DISA STIG Automation at Fleet Scale */
window.CH[1] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>You hardened one server by hand from a STIG checklist: a few hundred settings, a few afternoons, done. Now you have five ' +
      'thousand servers, the checklist gets updated quarterly, and an auditor wants proof — not a memory of having done it once. Fleet-scale ' +
      'STIG compliance is not "harden a box"; it is "prove every box, continuously, and fix drift automatically".</p>' +
      '<pre><code>1 server, hand-hardened once   →   5,000 servers, scanned nightly, remediated automatically,\n' +
      '  (proof = "I remember doing it")      evidence generated on every run (proof = a signed report)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A building inspector who visits once vs. smoke detectors wired into a ' +
      'monitoring panel.</b> A one-time inspection proves the building was safe on that day. Continuous automated scanning is the smoke ' +
      'detector network — it tells you the moment something drifts out of compliance, on every floor, every night, without a human touring ' +
      'the building.</p></div>',
      try: [
        ['📖 DISA — STIGs home', 'https://public.cyber.mil/stigs/', 'o'],
        ['🐧 Part 1: hardening & STIG fundamentals', '../learn/#ch3', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A STIG is published as <b>SCAP content</b> (an XCCDF checklist referencing OVAL definitions) that a scanner can execute directly. ' +
      'The fleet-scale loop is: scan every node, capture the results as machine-readable evidence, remediate what is fixable automatically, ' +
      'and route the rest to a human for a documented exception:</p>' +
      '<pre><code># scan a host against a STIG profile and produce an ARF results file + an HTML report\n' +
      '$ oscap xccdf eval \\\n' +
      '    --profile xccdf_mil.disa.stig_profile_MAC-1_Classified \\\n' +
      '    --results scan-results.xml \\\n' +
      '    --report scan-report.html \\\n' +
      '    /usr/share/xml/scap/ssg/content/ssg-rhel9-ds.xml\n\n' +
      '# generate an Ansible remediation playbook FROM the failed rules, then apply it\n' +
      '$ oscap xccdf generate fix --fix-type ansible --result-id "" scan-results.xml > remediate.yml\n' +
      '$ ansible-playbook -i inventory.ini remediate.yml</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard toolchain is <b><code>OpenSCAP</code></b> ' +
      '(<code>oscap</code>) driven by <b>SCAP Security Guide (SSG)</b> content — the same content DISA STIGs and CIS Benchmarks are built ' +
      'from — orchestrated at fleet scale with <b>Ansible</b> (or a compliance operator in Kubernetes/OpenShift). Results are captured as ' +
      '<b>ARF</b> (Asset Reporting Format) XML so they can be aggregated into a fleet-wide dashboard, not just read as a one-off HTML report.</p></div>',
      try: [
        ['📖 OpenSCAP — user manual', 'https://static.open-scap.org/openscap-1.3/oscap_user_manual.html', 'o'],
        ['📖 ComplianceAsCode / SCAP Security Guide', 'https://github.com/ComplianceAsCode/content', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The false-positive that ate a week.</b> A STIG rule flags every ' +
      'node for "SSH IdleTimeout not configured" even though config management sets it correctly — the scanner is checking the packaged ' +
      'default config file, not the drop-in override directory the fleet actually uses. Fix: tune the SCAP content\'s OVAL check (or file a ' +
      'documented deviation with evidence) rather than repeatedly re-running the same failing scan and hand-waving the finding in every audit ' +
      'meeting — a false positive that recurs monthly is a scanner-tuning bug, not a compliance gap.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The remediation that broke production.</b> An auto-generated ' +
      'Ansible fix for a STIG password-complexity rule gets applied fleet-wide overnight and locks out a service account whose password ' +
      'rotation depends on the old policy. Fix: auto-remediation always runs through a canary ring first (a handful of non-critical nodes, ' +
      'Ch 7) with monitoring before fleet-wide rollout — "the fix is generated from official SCAP content" is not the same guarantee as ' +
      '"the fix is safe for every node\'s actual configuration".</p></div>' +
      '<p><b>Compliance percentage is a leading indicator, not the goal:</b> 98% STIG compliance with the 2% being the controls that ' +
      'actually stop lateral movement is worse than 90% compliance where the highest-severity (CAT I) findings are all closed. Weight ' +
      'remediation priority by severity, not just count.</p>',
      try: [
        ['📖 DISA — STIG Viewer & CAT I/II/III severity', 'https://public.cyber.mil/stigs/srg-stig-tools/', 'o'],
        ['🛡️ Ch 7 — security patching pipelines', '#ch7', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'STIG applied once at image-build time       Scan continuously (nightly/on every config-management run) —\n' +
      '  and never re-checked                       drift happens the moment someone hand-edits a config.\n' +
      'Chasing 100% compliance uniformly           Prioritize by severity (CAT I first) and by which controls\n' +
      '                                             map to your actual threat model, not raw pass-count.\n' +
      'Auto-remediating fleet-wide overnight        Canary the remediation on a small ring first, with monitoring,\n' +
      '                                             before the fleet-wide rollout (same discipline as Ch 7 patching).\n' +
      'Treating a scanner false-positive as a       Fix the SCAP content/OVAL check or file a documented deviation —\n' +
      '  recurring "known issue" to ignore           a recurring false positive erodes trust in every OTHER finding.\n' +
      'No mapping from STIG control to owner        Every open finding needs a named owner and a target date, or\n' +
      '                                             it silently becomes permanent technical debt.\n' +
      'Evidence as a screenshot in a slide deck      Evidence should be the signed ARF/XCCDF results file itself —\n' +
      '                                             reproducible, machine-checkable, and re-runnable by an auditor.</code></pre>' +
      '<p><b>The real test:</b> can you show an auditor a compliance dashboard whose numbers are generated the same way as the reports, ' +
      'from the same automated pipeline, on a schedule — versus a spreadsheet someone updates by hand before the audit?</p>',
      try: [
        ['📖 NIST — SCAP overview', 'https://csrc.nist.gov/projects/security-content-automation-protocol', 'o'],
        ['🛡️ Ch 13 — compliance-as-code with OpenSCAP', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, STIG automation is a <b>continuous-verification</b> problem, not a checklist problem: the goal is a pipeline where ' +
      'compliance state is regenerated from source (SCAP content + config management) on every run, so "are we compliant" always has a fresh, ' +
      'reproducible answer instead of a stale audit artifact. The hard part is not running <code>oscap</code> — it is building the exception ' +
      'process, severity-weighted prioritization, and canary discipline around it that keeps automated remediation from becoming its own ' +
      'outage source.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is scanning once at image-build time not sufficient for STIG compliance?\n' +
      "A: Configuration drift happens continuously — a hand-edit, an emergency change, or a new package can\n" +
      '   silently violate a control after the image was built. Continuous (nightly, or on every config-\n' +
      '   management run) scanning is what actually catches drift.\n\n' +
      'Q: Should you prioritize remediation by count of open findings or by severity?\n' +
      'A: By severity (CAT I/II/III) and threat-model relevance. A high compliance PERCENTAGE with the\n' +
      '   remaining gaps concentrated in the highest-severity controls is worse than a lower percentage with\n' +
      '   all CAT I findings closed.\n\n' +
      'Q: An auto-generated Ansible remediation for a STIG rule is about to roll out fleet-wide. What do you\n' +
      '   check first?\n' +
      'A: Run it through a canary ring on a small, non-critical subset of nodes with monitoring first — the\n' +
      '   fix being generated from official SCAP content does not guarantee it is safe for every node\'s\n' +
      '   actual runtime configuration.\n\n' +
      'Q: A STIG rule keeps flagging a false positive every month. What is the right fix?\n' +
      'A: Correct the SCAP/OVAL check (or file a documented, evidence-backed deviation) rather than\n' +
      '   re-explaining the same false positive in every audit meeting — a persistent known-wrong finding\n' +
      '   erodes trust in every other finding on the report.\n\n' +
      'Q: What should compliance "evidence" actually be?\n' +
      'A: The signed, machine-readable ARF/XCCDF results file from an automated, reproducible pipeline —\n' +
      '   something an auditor can re-run and get the same answer from, not a manually maintained\n' +
      '   spreadsheet or screenshot.</code></pre>',
      try: [
        ['📖 DISA — SCAP Compliance Checker (SCC)', 'https://public.cyber.mil/stigs/scap/', 'o'],
        ['🛡️ Ch 16 — the compliance-as-code security platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is scanning a server against a STIG once, at image-build time, not sufficient for ongoing compliance?',
      opts: [
        'It is sufficient — STIGs never change after publication',
        'Configuration drift (hand-edits, emergency changes, new packages) can violate controls after the image was built, so continuous re-scanning is needed to catch it',
        'OpenSCAP only works during the build process',
        'STIG profiles expire after 24 hours'],
      ok: 1,
      why: 'A point-in-time scan cannot detect drift that happens afterward. Continuous scanning (nightly or on every config-management run) is what turns compliance into an ongoing, verifiable state rather than a one-time snapshot.' },
    { q: 'A fleet is 98% STIG-compliant, but the remaining 2% are all CAT I (highest severity) findings. Is this a good compliance posture?',
      opts: [
        'Yes, 98% is a strong number and should be reported as such without further action',
        'No — remediation should be prioritized by severity, so leaving the highest-severity controls open is worse than a lower overall percentage with all CAT I findings closed',
        'It does not matter since CAT I and CAT III findings carry equal risk',
        'The percentage should be recalculated to exclude CAT I findings'],
      ok: 1,
      why: 'Raw compliance percentage hides severity concentration. A fleet should prioritize closing the highest-severity (CAT I) findings first, since those are the ones most directly tied to real compromise risk.' },
    { q: 'An auto-generated Ansible remediation playbook for a STIG finding is ready to apply fleet-wide. What is the safest rollout approach?',
      opts: [
        'Apply it to all 5,000 nodes simultaneously overnight since it was generated from official SCAP content',
        'Run it against a small canary ring of non-critical nodes first, with monitoring, before a fleet-wide rollout',
        'Skip testing entirely since OpenSCAP-generated fixes are guaranteed safe',
        'Only apply it to production nodes, skipping staging entirely'],
      ok: 1,
      why: 'Official SCAP-generated content guarantees the fix matches the control\'s intent, not that it is safe for every node\'s actual runtime configuration. Canarying catches unexpected interactions before they become a fleet-wide outage.' }
  ]
};
