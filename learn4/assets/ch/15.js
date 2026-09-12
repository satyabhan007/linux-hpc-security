/* linux-hpc-security Learn — Part 4 · Chapter 15: Case Study — Anatomy of a Fleet-Wide Compromise & Incident Response */
window.CH[15] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>It starts small: a build-agent service account, granted broad access years ago for a migration nobody scoped back down ' +
      '(Ch 11), gets its credentials phished from a developer\'s laptop. Nothing looks dramatic at first — one login, from a slightly ' +
      'unusual IP, that a busy on-call engineer might reasonably have scrolled past. Every fleet-wide compromise starts as one small, ' +
      'individually-explainable event; the damage comes from what happens in the hours nobody connects the dots.</p>' +
      '<pre><code>One phished credential, unnoticed           →     A full kill chain: initial access → lateral movement\n' +
      '  (looks like a minor, isolated event)               → privilege escalation → fleet-wide persistence</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A single cracked window vs. the whole house being ransacked.</b> ' +
      'The crack itself is not the disaster — what matters is how long it takes anyone to notice it, and how much stands between the ' +
      'window and everything valuable inside. This case study is about that "how much stands between" question.</p></div>',
      try: [
        ['📖 MITRE ATT&CK — the kill-chain framework', 'https://attack.mitre.org/', 'o'],
        ['🛡️ Ch 10 — privileged access management & just-in-time access', '#ch10', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Reconstructing the timeline: the attacker used the phished build-agent credential (<b>T1078 — Valid Accounts</b>) to SSH into ' +
      'the build tier, then exploited the flat network path found in Ch 11\'s tabletop scenario (<b>T1021 — Remote Services</b>) to reach ' +
      'the database tier directly, then used a cached, never-rotated static database credential (Ch 6\'s anti-pattern) to exfiltrate data ' +
      'and plant a cron-based persistence mechanism (<b>T1053 — Scheduled Task/Job</b>):</p>' +
      '<pre><code># the detection that eventually fired — 6 hours after initial access\n' +
      '$ ausearch -k priv_cmd -ts recent | grep "unexpected cron write"\n' +
      'type=PATH ... name="/etc/cron.d/sys-maint" ... key="priv_cmd"\n\n' +
      '# containment: isolate affected hosts at the network layer FIRST, before touching anything else\n' +
      '$ nft add rule inet filter input ip saddr 10.10.20.14 drop     # quarantine, don\'t reboot/wipe yet\n\n' +
      '# eradication: rotate every credential the compromised account could have touched, not just the one leaked\n' +
      '$ vault lease revoke -prefix database/creds/\n\n' +
      '# recovery: rebuild from a known-good image, not a "cleaned" version of the compromised one\n' +
      '$ packer build known-good-image.pkr.hcl</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard incident-response phases are <b>Detection → ' +
      'Containment → Eradication → Recovery → Post-Incident Review</b>, following the <b>NIST SP 800-61</b> incident-handling ' +
      'lifecycle, with containment (network isolation) always happening before eradication (removing the attacker\'s access/tools) — ' +
      'reversing that order risks tipping off the attacker to accelerate their damage before they are cut off.</p></div>',
      try: [
        ['📖 NIST SP 800-61 — Computer Security Incident Handling Guide', 'https://csrc.nist.gov/pubs/sp/800/61/r2/final', 'o'],
        ['📖 MITRE ATT&CK — technique reference', 'https://attack.mitre.org/techniques/enterprise/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A containment decision under uncertainty.</b> Six hours in, ' +
      'the incident commander has to decide: quarantine the entire database tier (guaranteed to cause a customer-facing outage right ' +
      'now) or leave it reachable while gathering more evidence (risking further exfiltration in the meantime). Fix: this decision needs ' +
      'a pre-agreed severity framework, decided BEFORE an incident (not improvised at 3am) — e.g. "any confirmed lateral movement toward ' +
      'a data-bearing tier triggers immediate quarantine, outage risk accepted" — so the on-call incident commander is executing a ' +
      'decision the org already made, not making a novel judgment call alone under pressure.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The post-incident writeup that named root causes, not just ' +
      'symptoms.</b> The easy writeup says "an employee got phished." The useful writeup traces it further back: WHY did that one ' +
      'phished credential have a path to the database tier at all (Ch 11\'s segmentation gap), WHY was the database credential static ' +
      'and never rotated (Ch 6\'s anti-pattern), and WHY did detection take six hours (Ch 8\'s auditd rule existed but nobody was paged ' +
      'on it, Ch 9\'s FIM baseline was stale). Fix: a good post-incident review produces a control-gap list mapped to THIS course\'s ' +
      'chapters — each gap becomes a tracked, owned fix, the same discipline as an AAR (Ch 14).</p></div>' +
      '<p><b>Every gap in this incident was individually "known" somewhere before it happened:</b> the segmentation gap, the static ' +
      'credential, the unpaged alert — none were a novel discovery. The failure was organizational (no one owned closing them), not technical.</p>',
      try: [
        ['📖 SANS — incident handler\'s handbook', 'https://www.sans.org/white-papers/33901/', 'o'],
        ['🛡️ Ch 6 — secrets management at scale', '#ch6', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN (in this incident)              FIX\n' +
      'Broad standing access left over from a       Time-box and revoke access grants once their original justification\n' +
      '  years-old migration, never revoked            (Ch 10) is over — a stale grant is a permanent, silent attack surface.\n' +
      'A flat network path from build tier to        Enforce default-deny micro-segmentation (Ch 11) so a compromised\n' +
      '  database tier, found but never closed         build agent cannot reach the database tier directly, at all.\n' +
      'A static, never-rotated database credential   Use short-lived, dynamic credentials (Ch 6) so a leaked credential\n' +
      '  cached and reused by the attacker              expires quickly and rotation does not require finding every user.\n' +
      'A real auditd detection rule existed but      Ensure every detection rule maps to an actual paging/alert path\n' +
      '  nobody was actually paged when it fired        (Ch 8) — a rule that fires into a log nobody reads detects nothing.\n' +
      'Incident commander improvises the             Pre-agree a severity/containment decision framework (before any\n' +
      '  containment-vs-evidence tradeoff live          incident) so 3am decisions execute policy, not novel judgment alone.\n' +
      'Post-incident writeup stops at "an employee   Trace root causes back through every contributing control gap (segmentation,\n' +
      '  got phished" (the proximate cause only)       credential hygiene, alert routing) and track each as an owned fix.</code></pre>' +
      '<p><b>The real test:</b> for every gap this incident exposed, was it a genuinely NEW discovery, or something a chapter of this ' +
      'course already described as a known anti-pattern? (In this case study: every single one was already known.)</p>',
      try: [
        ['📖 NIST SP 800-61 — incident handling guide', 'https://csrc.nist.gov/pubs/sp/800/61/r2/final', 'o'],
        ['🛡️ Ch 14 — red team / blue team exercise design', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, the most important lesson of this case study is not any single technical control — it is that a fleet-wide ' +
      'compromise almost never depends on a novel, unknown technique. It depends on a CHAIN of individually-known, individually-minor ' +
      'gaps (a stale access grant, a flat network path, a static credential, an unpaged alert) that nobody owned closing. Defense in ' +
      'depth works precisely because it forces an attacker to defeat multiple independent layers — but only if each layer is actually ' +
      'maintained, not left as a known gap "for later".</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Walk through the four IR phases in this incident, in order, and why the order matters.\n' +
      "A: Detection (the cron-write AVC/audit alert fired), Containment (network-isolate the affected hosts\n" +
      "   FIRST, before anything else, to stop further lateral movement), Eradication (revoke every credential\n" +
      '   the compromised account could reach, remove the persistence mechanism), Recovery (rebuild from a\n' +
      '   known-good image, never a "cleaned" version of a compromised one). Containment before eradication\n' +
      '   matters because acting on the attacker\'s access before cutting them off risks tipping them into\n' +
      '   accelerating damage.\n\n' +
      'Q: Why rebuild from a known-good image during recovery instead of just removing the malicious files\n' +
      '   found on the compromised host?\n' +
      'A: You can only be confident about what you found, not about what you might have missed — a\n' +
      '   "cleaned" host may still harbor an undiscovered secondary persistence mechanism; a rebuild from a\n' +
      '   trusted source eliminates that uncertainty entirely.\n\n' +
      'Q: Why should the containment-vs-evidence-gathering tradeoff be decided BEFORE an incident, not during\n' +
      '   one?\n' +
      'A: Deciding a severity/response framework in advance means the on-call incident commander executes\n' +
      '   pre-agreed organizational policy under pressure, rather than making a high-stakes, novel judgment\n' +
      '   call alone at 3am with incomplete information.\n\n' +
      'Q: Why is "an employee got phished" an inadequate root cause for a post-incident writeup?\n' +
      'A: It only names the proximate trigger; the actual root causes are the control gaps that let one\n' +
      "   phished credential turn into a fleet-wide incident — the segmentation gap, the static credential,\n" +
      '   the unpaged alert — each of which needs its own tracked fix.\n\n' +
      'Q: What is the single biggest structural lesson from a case study like this one?\n' +
      'A: Fleet-wide compromises are usually a CHAIN of already-known, individually-minor gaps rather than one\n' +
      '   novel technique — defense in depth only works if every layer in the chain is actually maintained,\n' +
      '   not left as a known-but-unowned gap.</code></pre>',
      try: [
        ['📖 NIST SP 800-61 — incident handling lifecycle', 'https://csrc.nist.gov/pubs/sp/800/61/r2/final', 'o'],
        ['🛡️ Ch 16 — the compliance-as-code security platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why must containment (network isolation) happen before eradication (removing the attacker\'s access/tools) during incident response?',
      opts: [
        'The order does not matter as long as both happen eventually',
        'Acting on the attacker\'s access or tools before isolating the affected hosts risks tipping them off and causing them to accelerate damage before they can be cut off',
        'Eradication is always technically impossible before containment',
        'Containment is only relevant for network-based attacks, not credential-based ones'],
      ok: 1,
      why: 'Isolating affected hosts first prevents further lateral movement or exfiltration while the response team works, without alerting the attacker prematurely.' },
    { q: 'During recovery, why rebuild a compromised host from a known-good image rather than removing the malicious files that were found?',
      opts: [
        'Rebuilding is always faster than cleaning a host',
        'You can only be confident about what was found, not what might have been missed — a "cleaned" host may still harbor an undiscovered secondary persistence mechanism',
        'Cleaning files is technically impossible on Linux systems',
        'Known-good images are required by regulation in every case'],
      ok: 1,
      why: 'A rebuild from a trusted source eliminates the uncertainty of whether every trace of a compromise was actually found and removed.' },
    { q: 'Why is "an employee got phished" considered an inadequate root cause in a post-incident writeup for a fleet-wide compromise?',
      opts: [
        'Phishing is never actually the initial access vector in real incidents',
        'It only names the proximate trigger; the real root causes are the underlying control gaps (e.g. flat network segmentation, static credentials, unpaged alerts) that let one credential escalate into a fleet-wide incident',
        'Employees should never be mentioned in incident reports',
        'This statement is factually always incorrect'],
      ok: 1,
      why: 'A useful post-incident review traces the chain of contributing control gaps back to their root, since those gaps — not the initial phishing click — are what turned a minor event into a fleet-wide compromise.' }
  ]
};
