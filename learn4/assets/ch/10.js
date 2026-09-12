/* linux-hpc-security Learn — Part 4 · Chapter 10: Privileged Access Management & Just-in-Time Access */
window.CH[10] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Every engineer on the infra team has standing root/sudo on every production host, granted the day they joined and never ' +
      'revisited. When someone\'s laptop gets phished, the attacker does not need to escalate privilege at all — the compromised account ' +
      'already has it, everywhere, all the time. Standing access is not a convenience with a small security cost; it is a permanent, ' +
      'fleet-wide backdoor waiting for one phished credential.</p>' +
      '<pre><code>Standing root access, granted once,          →     Just-in-time access: request → approve → time-\n' +
      '  never expires, rarely reviewed                    boxed grant → auto-revoke → full session log</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Every employee having a master key to every room, forever, vs. ' +
      'requesting the server-room key from security for a specific, logged task.</b> The master key is convenient until it is stolen — ' +
      'then it opens everything, indefinitely. The requested key expires the moment the task is done and every use is on record.</p></div>',
      try: [
        ['📖 NIST SP 800-53 — access control family (AC)', 'https://csrc.nist.gov/pubs/sp/800/53/r5/final', 'o'],
        ['🛡️ Ch 6 — secrets management at scale', '#ch6', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Just-in-time (JIT) privileged access replaces standing sudo/root with a <b>request → approve → time-boxed grant → automatic ' +
      'revocation</b> workflow, with every privileged session recorded for audit:</p>' +
      '<pre><code># sudoers: no standing NOPASSWD entries — access is granted per-request via a PAM/JIT broker\n' +
      '# instead, a time-boxed sudo rule is generated and revoked by the JIT tool itself, e.g.:\n' +
      '$ jit-access request --host db-prod-04 --reason "INC-4821 diagnose replication lag" --ttl 1h\n' +
      '# ...after approval, the broker writes a scoped, time-limited sudoers.d entry...\n' +
      '$ sudo -l                          # confirm only the granted, scoped commands are available\n\n' +
      '# session recording for a privileged bastion session (typescript-style capture)\n' +
      '$ script -f /var/log/pam-sessions/$(date +%s)-$USER.log\n\n' +
      '# revoke standing access identified in a PAM rollout audit\n' +
      '$ usermod -G wheel -R alice        # remove alice from the wheel group\'s standing privilege</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern is a <b>PAM/JIT broker</b> ' +
      '(e.g. Teleport, CyberArk, or an internal Vault-backed workflow) issuing short-lived, scoped credentials or sudoers entries ' +
      'gated by an approval step, combined with <b>session recording</b> on any privileged bastion/jump host and a periodic access ' +
      'review that actively revokes standing grants rather than only adding new ones.</p></div>',
      try: [
        ['📖 Teleport — access requests / JIT access docs', 'https://goteleport.com/docs/', 'o'],
        ['📖 NIST — privileged access management guidance', 'https://csrc.nist.gov/pubs/sp/800/53/r5/final', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The JIT rollout that broke incident response.</b> A team ' +
      'rolls out mandatory approval-gated access with a 15-minute SLA for approvals — then a 3am outage strikes and the one approver ' +
      'on-call is asleep, leaving the responding engineer locked out of the exact host they need. Fix: JIT access needs a documented, ' +
      'audited break-glass path for declared incidents (auto-approved but heavily logged and reviewed after the fact) — approval ' +
      'friction cannot be allowed to make outages worse than the access control problem it solves.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Revoking standing access surfaced years of unused grants.</b> ' +
      'An access-review pass ahead of a JIT rollout finds that forty percent of standing sudo grants belong to people who changed teams ' +
      'or roles a year or more ago and never lost the access. Fix: treat the review itself as the valuable output, not just a ' +
      'prerequisite step — a periodic, forced re-justification of every standing grant (not just new ones) is what actually prevents ' +
      'this from re-accumulating after the JIT rollout is declared "done".</p></div>' +
      '<p><b>Session recording is only useful if someone actually watches (or searches) it:</b> a bastion that records every privileged ' +
      'session into a write-only archive nobody queries provides forensic value after a breach, but zero deterrent or detection value ' +
      'before one.</p>',
      try: [
        ['📖 CISA — zero trust maturity model (identity pillar)', 'https://www.cisa.gov/zero-trust-maturity-model', 'o'],
        ['🛡️ Ch 14 — red team / blue team exercise design', '#ch14', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Standing root/sudo granted once at          Time-boxed, request-approved JIT grants that auto-revoke — no\n' +
      '  onboarding, never revisited                 privilege persists longer than the task that justified it.\n' +
      'JIT approval has no break-glass path for     Provide a documented, heavily-logged emergency access path for\n' +
      '  a 3am incident with no approver awake        declared incidents — approval friction must not worsen outages.\n' +
      'Access reviews only ever ADD grants,          Force periodic re-justification of every EXISTING grant, not just\n' +
      '  never actively revoke stale ones              new requests — stale grants from role changes accumulate silently.\n' +
      'Session recordings archived write-only,       Actively search/sample recorded sessions and alert on suspicious\n' +
      '  nobody ever reviews or searches them          patterns — an unreviewed archive has only after-the-fact forensic value.\n' +
      'One flat privilege tier ("has sudo" vs        Scope grants per-task/per-host (e.g. specific commands on one host)\n' +
      '  "does not") regardless of task                rather than an all-or-nothing sudo grant for unrelated systems.\n' +
      'JIT rollout treated as a one-time project     Treat it as an ongoing program — new hosts, new roles, and new\n' +
      '  with no ongoing maintenance                   services need the same scoped, time-boxed model applied by default.</code></pre>' +
      '<p><b>The real test:</b> pick any currently-active privileged grant at random. Can you name the specific task it was requested ' +
      'for, and does it expire on its own — or does someone have to remember to take it away?</p>',
      try: [
        ['📖 NIST — Zero Trust Architecture (SP 800-207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 11 — network segmentation & micro-segmentation for bare metal', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, PAM/JIT access is about eliminating <b>standing attack surface</b>: every credential or grant that exists ' +
      'independent of an active, justified task is a liability sitting idle, waiting for its holder\'s account to be the one that gets ' +
      'phished. JIT access does not make compromise impossible — it dramatically shrinks the window and scope of what a compromised ' +
      'account can do, because privilege only exists while a specific, logged, time-boxed task is in progress.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is standing root/sudo access, granted once and never revisited, a significant security liability\n' +
      '   even if every engineer holding it is trustworthy?\n' +
      'A: The risk is not the engineer\'s intent — it is that a phished or otherwise compromised account\n' +
      '   inherits whatever standing privilege it already has, with no additional step required. Standing\n' +
      '   access turns any single compromised credential into full, ongoing privileged access.\n\n' +
      'Q: A JIT access rollout requires manual approval for every request. What critical gap must be\n' +
      "   addressed before going live?\n" +
      'A: A documented, heavily-logged break-glass path for incidents when no approver is available — without\n' +
      '   one, approval friction can turn a 3am outage into a worse incident by locking out the responder.\n\n' +
      'Q: Why should periodic access reviews focus on revoking existing grants, not just approving new ones?\n' +
      'A: Standing grants accumulate silently as people change teams or roles; without active re-justification\n' +
      '   of EXISTING access, stale privilege builds up indefinitely even in an otherwise well-run JIT program.\n\n' +
      'Q: What is the actual security value of session recording on a privileged bastion?\n' +
      'A: Recording alone provides only after-the-fact forensic value; its detective/deterrent value requires\n' +
      '   active review or automated anomaly search — an unreviewed write-only archive is closer to a\n' +
      '   compliance checkbox than a real control.\n\n' +
      'Q: How does JIT access reduce blast radius compared to standing access, given that a determined\n' +
      '   attacker who compromises a JIT user\'s workflow could still request access?\n' +
      'A: Every grant is scoped to a specific, approved task, time-boxed, and logged — so even a successful\n' +
      '   attack is confined to the scope and duration of one legitimate-looking request, rather than\n' +
      '   inheriting broad, indefinite privilege immediately.</code></pre>',
      try: [
        ['📖 CISA — identity, credential, and access management (ICAM)', 'https://www.cisa.gov/identity-credential-and-access-management', 'o'],
        ['🛡️ Ch 6 — secrets management at scale', '#ch6', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is standing (never-expiring) root/sudo access considered a significant security liability, even for trustworthy engineers?',
      opts: [
        'Trustworthy engineers never make mistakes, so this is not actually a concern',
        'A phished or otherwise compromised account inherits whatever standing privilege it already holds, with no additional escalation step required',
        'Standing access is slower to use than just-in-time access',
        'sudo cannot log commands run under standing access'],
      ok: 1,
      why: 'The risk is independent of the individual\'s intent — standing privilege means a compromised credential immediately has full, ongoing access with no extra barrier.' },
    { q: 'A just-in-time access system requires manual approval for every privileged request. What critical gap must be addressed before rollout?',
      opts: [
        'Nothing — approval-gated access is always safe to deploy as-is',
        'A documented, heavily-logged break-glass path for incidents when no approver is available, so approval friction cannot worsen an active outage',
        'All approvers must be replaced with fully automated approval for every request',
        'The system should require two separate approvers for every request regardless of urgency'],
      ok: 1,
      why: 'Without an emergency access path, approval friction during a real incident (e.g. no approver awake at 3am) can lock out the very responder trying to fix the problem.' },
    { q: 'Why should periodic access reviews in a PAM program focus on revoking existing stale grants, not just approving new requests?',
      opts: [
        'Existing grants never need review once initially approved',
        'Standing grants accumulate silently as people change roles or teams, so active re-justification of existing access is needed to prevent indefinite privilege buildup',
        'Revoking access is only relevant during employee offboarding',
        'New requests are always riskier than old, unreviewed grants'],
      ok: 1,
      why: 'Without actively revoking outdated grants, a PAM/JIT program can still accumulate significant stale standing access over time, even while doing a good job vetting new requests.' }
  ]
};
