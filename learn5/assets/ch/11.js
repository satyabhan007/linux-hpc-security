/* linux-hpc-security Learn — Part 5 · Chapter 11: Runbook Automation & Self-Healing Remediation */
window.CH[11] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A runbook that says "if disk usage > 90%, SSH in and delete old logs" still requires a human to wake up, read it, and type the ' +
      'commands — every single time the same known problem happens. If the fix is always the same three commands, a script can run them the ' +
      'moment the condition is detected, and the human only gets paged if the automated fix does not work. That is <b>runbook automation</b>: ' +
      'turning a documented manual fix into a program that runs it for you.</p>' +
      '<pre><code>Alert fires → human reads runbook → human types commands → fixed (15-30 min, every time)\n' +
      'Alert fires → script runs the SAME commands automatically → fixed (seconds, human paged only on failure)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A thermostat vs. someone manually adjusting the heat every time it feels ' +
      'cold.</b> A thermostat detects the condition and acts immediately, every time, without waiting for a human to notice and respond — a ' +
      'human only needs to intervene when something is actually unusual (the thermostat itself breaks).</p></div>',
      try: [
        ['📖 Google SRE Book — Automation', 'https://sre.google/sre-book/eliminating-toil/', 'o'],
        ['📡 Ch 10 — on-call & incident response for infrastructure teams', '#ch10', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The pattern: detect (a metric crosses a threshold or an alert fires), decide (is this the known, safe-to-automate case), act (run the ' +
      'fix), verify (did it actually work), and escalate to a human only if verification fails or a safety limit is hit. A <b>dry-run mode</b> ' +
      'lets you test the automation\'s logic without it taking real action — essential before trusting it to run unattended.</p>' +
      '<pre><code># a disk-full auto-remediation script (dry-run aware, with a hard safety limit)\n' +
      '#!/usr/bin/env bash\n' +
      'set -euo pipefail\n' +
      'THRESHOLD=90; DRY_RUN="${1:-}"\n' +
      'usage=$(df --output=pcent /var/log | tail -1 | tr -dc "0-9")\n' +
      'if (( usage > THRESHOLD )); then\n' +
      '  echo "disk at ${usage}%, cleaning logs older than 7 days"\n' +
      '  find /var/log -name "*.log.*.gz" -mtime +7 -print $([ "$DRY_RUN" = "--dry-run" ] && echo "" || echo "-delete")\n' +
      'fi</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tooling is a lightweight remediation runner (a shell/Python ' +
      'script triggered by an <b>Alertmanager webhook</b> or a config-management tool like <b>Ansible</b>) wrapping the runbook\'s known-safe ' +
      'steps, always with a dry-run flag and a hard iteration/rate limit before it pages a human instead of retrying forever.</p></div>',
      try: [
        ['📖 Prometheus Alertmanager — webhook receiver', 'https://prometheus.io/docs/alerting/latest/configuration/#webhook_config', 'o'],
        ['📖 Google SRE Workbook — Automating incident response', 'https://sre.google/workbook/eliminating-toil/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>An automated remediation for a known-flapping service.</b> A service ' +
      'that occasionally deadlocks and needs a restart used to page on-call three times a week for the same five-second fix; an automated ' +
      'restart-on-detected-deadlock script eliminates those pages entirely, and the team only hears about it via a daily digest — freeing on-call ' +
      'attention for problems that actually need a human.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A self-healing script with a hard safety limit before it pages a ' +
      'human.</b> The same restart-on-deadlock script is given a limit of 3 restarts per hour; on the 4th trigger within an hour, it stops taking ' +
      'action and pages a human instead — because a service deadlocking that often is not "the known, safe case" anymore, it is a new problem ' +
      'that blind automated restarts would just mask instead of fix.</p></div>' +
      '<p><b>Auditing what automated remediation actually did during an incident</b> matters as much as the fix itself: every automated action ' +
      'must be logged (what triggered it, what it did, what the result was) so a postmortem (Ch 14) can reconstruct the full incident timeline, ' +
      'including the actions no human was awake to see happen.</p>',
      try: [
        ['📡 Ch 14 — postmortems for infrastructure incidents', '#ch14', 'o'],
        ['📖 Google SRE Book — Eliminating Toil', 'https://sre.google/sre-book/eliminating-toil/', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Automation with no dry-run mode              Build and test a dry-run flag before ever running the\n' +
      '                                             script unattended against production.\n' +
      'No limit on retries/repeated remediation      Set a hard rate limit (e.g. 3x/hour) — beyond it, the\n' +
      '                                             problem is no longer "the known safe case" and needs a\n' +
      '                                             human, not more automated restarts.\n' +
      'Automated actions that are not logged          Log every trigger, action, and result — an incident\n' +
      '                                             timeline with invisible automated actions is impossible\n' +
      '                                             to reconstruct accurately in a postmortem.\n' +
      'Automating a fix nobody has manually verified  Only automate a remediation once the manual runbook\n' +
      'works reliably                              version has been proven reliable by humans — automating\n' +
      '                                             an unreliable fix just makes the unreliability faster.\n' +
      'No verification step after the automated fix  Check that the fix actually worked (metric back to\n' +
      '                                             normal) before declaring success — an automation that\n' +
      "                                             assumes success is a blind spot, same as Ch 1's staleness\n" +
      '                                             gap.\n' +
      'Treating automation as "set and forget"        Review automated remediation logs periodically — a\n' +
      '                                             script silently firing 50 times a day on a masked\n' +
      '                                             underlying problem is toil in disguise, not toil\n' +
      '                                             eliminated.</code></pre>' +
      '<p><b>The real test:</b> if your self-healing script fired twenty times last night, would anyone know by morning — or does the automation ' +
      'quietly mask a worsening problem simply because it keeps "fixing" the symptom before anyone gets paged?</p>',
      try: [
        ['📖 Google SRE Book — Eliminating Toil', 'https://sre.google/sre-book/eliminating-toil/', 'o'],
        ['📡 Ch 12 — capacity planning for compute clusters', '#ch12', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, runbook automation is a <b>trust-and-visibility</b> problem, not just a scripting exercise: every fix you automate ' +
      'removes a human decision point, which is good when the decision is truly routine and bad when it silently absorbs a worsening problem ' +
      'that should have escalated. The hard safety limit and the audit log are not optional add-ons — they are what keeps automation from ' +
      'becoming a way to hide degradation instead of a way to eliminate toil.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why should a self-healing remediation script have a hard limit on how many times it acts before\n' +
      'paging a human?\n' +
      'A: Beyond a certain frequency, the problem is no longer the known, safe-to-automate case — it needs\n' +
      '   human investigation, and unlimited automated retries would just mask a worsening issue instead of\n' +
      '   surfacing it.\n\n' +
      'Q: Why is a dry-run mode essential before trusting remediation automation to run unattended?\n' +
      'A: It lets you verify the automation\'s detection and action logic without it taking real, possibly\n' +
      '   destructive action — critical before letting a script run against production with no human in the\n' +
      '   loop.\n\n' +
      'Q: Why must every automated remediation action be logged?\n' +
      'A: A postmortem needs the full incident timeline, including actions no human was awake to witness —\n' +
      '   an unlogged automated fix creates a gap that makes accurate root-cause analysis impossible.\n\n' +
      'Q: Why only automate a fix that has already been proven reliable as a manual runbook?\n' +
      'A: Automating an unreliable or unverified fix just makes the unreliable outcome happen faster and\n' +
      '   with less human oversight — automation should follow proven reliability, not substitute for it.\n\n' +
      'Q: What is the risk of treating self-healing automation as "set and forget"?\n' +
      'A: A script that keeps "fixing" a symptom without anyone reviewing how often it fires can mask a\n' +
      '   worsening underlying problem — periodic review of remediation logs is necessary to catch that.</code></pre>',
      try: [
        ['📖 Google SRE Book — Eliminating Toil', 'https://sre.google/sre-book/eliminating-toil/', 'o'],
        ['📡 Ch 16 — the production operations platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should a self-healing remediation script have a hard limit (e.g. 3 restarts per hour) before it pages a human instead of retrying?',
      opts: [
        'To reduce server load from running the script too often',
        'Beyond that frequency, the problem is no longer the known, safe-to-automate case, and continued automated action would mask a worsening issue instead of surfacing it',
        'Rate limits are required by most compliance frameworks',
        'It has no real purpose beyond convention'],
      ok: 1,
      why: 'A hard safety limit ensures that when the automated fix keeps failing to hold, the situation escalates to a human rather than the automation looping indefinitely and hiding a deeper problem.' },
    { q: 'Why must every action a remediation automation takes be logged?',
      opts: [
        'Logging is only needed for compliance audits, not incident analysis',
        'A postmortem needs the complete incident timeline, and an unlogged automated action creates a gap that makes accurate root-cause analysis impossible',
        'Logs are needed only to debug the automation script itself',
        'It is not necessary if the automation dry-run was tested beforehand'],
      ok: 1,
      why: 'Automated actions happen without a human watching in real time; without logs, a postmortem cannot reconstruct what actually happened during the incident.' },
    { q: 'Why should a fix only be automated after it has been proven reliable as a manual runbook step?',
      opts: [
        'Automation is always slower to build than the manual process, so proving it first saves time',
        'Automating an unreliable or unverified fix just makes the unreliable outcome happen faster with less human oversight, rather than actually solving the problem',
        'Manual runbooks are legally required before any automation can be built',
        'It has no real bearing on automation quality'],
      ok: 1,
      why: 'Automation should scale a fix that is already known to work reliably; automating an unproven fix compounds the risk rather than reducing toil safely.' }
  ]
};
