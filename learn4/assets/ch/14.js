/* linux-hpc-security Learn — Part 4 · Chapter 14: Red Team / Blue Team Exercise Design */
window.CH[14] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A red team gets a shell on a target box in twenty minutes and everyone declares the exercise a success — for the red team. ' +
      'Nobody asks whether the blue team\'s monitoring even noticed, how long it would have taken them to notice without being told, or ' +
      'what changed in the detection pipeline afterward. "We got in" is an interesting fact about the attackers; it is not, by itself, a ' +
      'useful fact about the defenders.</p>' +
      '<pre><code>Exercise scored on whether red team got a     →     Exercise scored on detection coverage: did blue\n' +
      '  shell (a fact about the attackers only)             team notice, how fast, and what changed after</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A fire drill scored on whether the "fire" started vs. one scored ' +
      'on how fast everyone evacuated and whether the alarm even triggered.</b> Of course a deliberately-set fire starts — that was never ' +
      'in question. The point of the drill is finding out whether the detection and response actually worked.</p></div>',
      try: [
        ['📖 MITRE — ATT&CK Evaluations & purple teaming', 'https://attackevals.mitre-engenuity.org/', 'o'],
        ['🛡️ Ch 8 — intrusion detection: auditd & eBPF-based sensors', '#ch8', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A well-scoped exercise defines success around <b>detection coverage</b>, not just red-team success — mapping each attack ' +
      'step to a MITRE ATT&CK technique and recording whether/when the corresponding detection fired, turning "did we get hacked" into ' +
      '"which specific techniques does our detection actually cover":</p>' +
      '<pre><code># exercise scoping doc: define the specific techniques in scope, tied to ATT&CK IDs\n' +
      '# T1078 - Valid Accounts, T1021 - Remote Services, T1055 - Process Injection ...\n\n' +
      '# a purple-team run: red team executes a technique, blue team\'s detection is timed against it\n' +
      'technique: T1021.004 (SSH lateral movement)\n' +
      'executed_at: 2026-03-14T09:12:00Z\n' +
      'detected_at: 2026-03-14T09:47:00Z     # 35-minute detection gap — the actual finding, not "they got in"\n' +
      'detecting_control: auditd rule "unusual_ssh_lateral"  # or "NONE" if it never fired\n\n' +
      '# after-action: file a tracked gap-closure item, same as any other bug\n' +
      '$ gap-tracker file --technique T1021.004 --gap "no alert on internal SSH hop" --owner blue-team-lead</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard framework is <b>MITRE ATT&CK</b>-mapped scenario ' +
      'design (a purple-team collaboration where red and blue coordinate rather than a pure adversarial black-box test) with a ' +
      '<b>detection-coverage scorecard</b> per technique, and a formal <b>after-action review (AAR)</b> that produces concrete, ' +
      'owned runbook and detection-rule changes — not just a debrief slide deck.</p></div>',
      try: [
        ['📖 MITRE ATT&CK — framework', 'https://attack.mitre.org/', 'o'],
        ['📖 CISA — purple team exercise guidance', 'https://www.cisa.gov/resources-tools/services/red-and-blue-team-exercises', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Scoping a purple-team exercise against a hardened fleet.</b> ' +
      'A team plans a purple-team exercise and initially scopes it around "can red team get domain admin" — against a fleet with strong ' +
      'JIT access (Ch 10) and no standing domain admin to begin with, that framing does not test anything meaningful. Fix: scope the ' +
      'exercise around techniques relevant to the ACTUAL architecture (e.g. "can red team abuse a JIT approval workflow" or "can red ' +
      'team pivot past the network segmentation from Ch 11") rather than a generic scenario copied from a different kind of environment.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The after-action review that changed nothing.</b> An exercise ' +
      'finds three real detection gaps, the AAR meeting is well-attended and produces a thoughtful slide deck — and six months later none ' +
      'of the three gaps have a corresponding new detection rule or runbook update, because nobody was assigned an owner or a deadline. ' +
      'Fix: every AAR finding becomes a tracked ticket with an owner and a due date, reviewed for closure just like the STIG findings ' +
      'in Ch 1 — an AAR with no follow-through is theater with extra steps.</p></div>' +
      '<p><b>The exercise itself needs rules of engagement:</b> a red team causing an actual production outage "for realism" turns a ' +
      'learning exercise into an unplanned incident — scope and blast-radius limits are part of the exercise design, not an afterthought.</p>',
      try: [
        ['📖 MITRE ATT&CK — purple teaming with ATT&CK', 'https://attack.mitre.org/resources/', 'o'],
        ['🛡️ Ch 15 — case study: anatomy of a fleet-wide compromise', '#ch15', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Exercise scored solely on whether red        Score against detection COVERAGE — did blue team notice, how fast,\n' +
      '  team achieved its objective                  through which control — for every technique attempted.\n' +
      'Scenario copied generically from another      Scope the exercise around techniques relevant to THIS fleet\'s actual\n' +
      '  organization\'s exercise design                architecture (its segmentation, its JIT model, its detection stack).\n' +
      'AAR produces a debrief deck with no owners    Every finding becomes a tracked, owned, deadlined ticket — reviewed\n' +
      '  or deadlines attached to findings             for closure the same way any other compliance finding is (Ch 1).\n' +
      'No blast-radius / rules-of-engagement limits  Define scope and blast-radius limits BEFORE the exercise starts — a\n' +
      '  defined before the exercise starts            red team causing a real outage "for realism" is an incident, not a drill.\n' +
      'Red and blue teams operate in total            Run a purple-team COLLABORATIVE model at least some of the time —\n' +
      '  isolation with no shared debrief               a pure black-box test alone often teaches less than a coordinated one.\n' +
      'Exercises run once a year as a compliance     Run smaller, more frequent exercises (tabletop or live) tied to real\n' +
      '  checkbox, disconnected from real changes       architecture changes (Ch 11\'s segmentation tabletop is one example).</code></pre>' +
      '<p><b>The real test:</b> from your LAST exercise, can you name a specific detection rule or runbook that exists today, and did ' +
      'not exist before, directly because of a finding from that exercise?</p>',
      try: [
        ['📖 MITRE ATT&CK — Center for Threat-Informed Defense', 'https://ctid.mitre.org/', 'o'],
        ['🛡️ Ch 11 — network segmentation & micro-segmentation for bare metal', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, red/blue exercise design is a measurement problem: the goal is not to prove a fleet CAN be compromised — ' +
      'given enough time and privilege, almost any sufficiently complex fleet can be — the goal is to measure, per attacker technique, ' +
      'whether detection exists, how fast it fires, and whether that measurement improves release over release. An exercise program ' +
      'without that longitudinal tracking is a series of unrelated anecdotes, not a security program.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is "the red team got a shell" an incomplete measure of a red/blue exercise\'s value?\n' +
      'A: It is a fact about the attackers\' capability, not about the defenders\' detection — a well-resourced\n' +
      "   red team getting in tells you little unless paired with whether and how fast blue team detected it,\n" +
      '   which is the actually actionable signal.\n\n' +
      'Q: Why map exercise scenarios to MITRE ATT&CK technique IDs rather than a freeform narrative?\n' +
      'A: It turns the outcome into a structured, comparable coverage scorecard (which specific techniques\n' +
      '   have detection, which do not) that can be tracked over time, instead of an anecdote that is hard to\n' +
      '   compare across exercises or teams.\n\n' +
      'Q: An after-action review produces findings but no tracked follow-up tickets. What is the actual\n' +
      '   consequence?\n' +
      'A: Without an owner and deadline per finding, gaps identified in the exercise are very unlikely to\n' +
      '   actually get fixed — the exercise becomes a periodic ritual rather than a mechanism that improves\n' +
      '   real detection and response capability.\n\n' +
      'Q: Why does exercise scenario design need to be tailored to the specific fleet\'s architecture rather\n' +
      '   than reused generically?\n' +
      'A: A generic scenario (e.g. "obtain standing domain admin") may not even be a meaningful attack path\n' +
      "   against a fleet that already eliminated standing privileged access (Ch 10) — it tests nothing real\n" +
      '   and wastes the exercise\'s value.\n\n' +
      'Q: Why does an exercise need defined rules of engagement and blast-radius limits before it starts?\n' +
      'A: Without pre-agreed scope limits, a red team acting "realistically" can cause an actual production\n' +
      '   outage — turning a controlled learning exercise into an unplanned real incident.</code></pre>',
      try: [
        ['📖 MITRE ATT&CK — Purple Team exercises', 'https://attack.mitre.org/resources/enterprise-introduction/', 'o'],
        ['🛡️ Ch 8 — intrusion detection: auditd & eBPF-based sensors', '#ch8', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is "the red team successfully got a shell" an incomplete measure of a red/blue team exercise\'s value?',
      opts: [
        'Red teams should never be able to get a shell if the fleet is properly hardened',
        'It is a fact about the attackers\' capability, not the defenders\' detection — the more useful measure is whether and how fast blue team noticed and responded',
        'Shells obtained during exercises are always fake and prove nothing',
        'This outcome cannot be measured objectively at all'],
      ok: 1,
      why: 'The actionable value of the exercise comes from measuring detection and response, not from confirming that a determined red team can compromise something.' },
    { q: 'Why should red/blue exercise findings from an after-action review be converted into tracked, owned tickets with deadlines?',
      opts: [
        'This is purely a bureaucratic requirement with no effect on outcomes',
        'Without an owner and deadline, identified detection or response gaps are unlikely to actually get fixed, turning the exercise into a ritual rather than a driver of real improvement',
        'Tickets are required by MITRE ATT&CK licensing terms',
        'AAR findings never need follow-up if the debrief meeting was well-attended'],
      ok: 1,
      why: 'Follow-through with ownership and deadlines is what converts an exercise\'s findings into actual improvements to detection rules and runbooks.' },
    { q: 'Why is scoping a red/blue exercise generically (e.g. copied from an unrelated organization\'s scenario) often a mistake?',
      opts: [
        'Generic scenarios are always more thorough than tailored ones',
        'A generic scenario may not represent a meaningful attack path against this specific fleet\'s actual architecture, testing nothing real and wasting the exercise\'s value',
        'MITRE ATT&CK only supports one standard scenario',
        'Tailored scenarios take significantly longer to design with no added benefit'],
      ok: 1,
      why: 'An exercise should test techniques relevant to the fleet\'s actual controls (its segmentation, access model, detection stack) rather than a scenario irrelevant to its real architecture.' }
  ]
};
