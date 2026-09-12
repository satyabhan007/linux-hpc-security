/* linux-hpc-security Learn — Part 3 · Chapter 15: Case Study — Anatomy of a Cluster-Wide Outage */
window.CH[15] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>02:14 on a Tuesday: every job on a 4,000-node cluster stops dispatching. Nodes are up, the fabric is healthy, users can still
      <code>squeue</code> and see their jobs sitting PENDING — but nothing new starts, and nothing finishes cleanly either. This chapter
      walks one realistic incident, composited from the kind of failure real HPC sites see, from first symptom through root cause to
      recovery, the way an actual postmortem reads.</p>
      <pre><code>02:14  PagerDuty: "no job state transitions in slurmctld for 6 minutes" (a real, working alert)
      02:19  On-call engineer confirms: squeue works, sbatch works, but nothing moves PENDING → RUNNING
      02:31  slurmctld log shows repeated "Node registration violates ... " and RPC timeout messages</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A hospital's admissions desk stops assigning beds.</b> The building is
      fine, every ward has capacity, patients keep arriving and getting logged — but nobody is being walked to an actual bed. Something in
      the coordination layer (not any individual ward, not any individual patient) has stalled. Slurm's controller (<code>slurmctld</code>)
      is that admissions desk; when it stalls, the fact every individual node is healthy doesn't matter at all.</p></div>`,
      try: [
        ['📖 Slurm — slurmctld Troubleshooting', 'https://slurm.schedmd.com/troubleshoot.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>The on-call engineer's actual diagnostic sequence — the real tools from earlier chapters, used under pressure — is what separates
      a 20-minute recovery from a 6-hour one:</p>
      <pre><code># is the controller process even alive and responsive?
$ systemctl status slurmctld
$ scontrol ping
Slurmctld(primary/backup) at cluster-ctl1/cluster-ctl2 are UP/DOWN

# controller log is the primary evidence — grep for the moment things went wrong
$ journalctl -u slurmctld --since "02:00" | grep -iE "error|violat|timeout"

# is the accounting database (which slurmctld blocks on for state writes) reachable?
$ mysqladmin ping -h slurmdbd-host
$ systemctl status slurmdbd

# controller's own resource usage — a hung/thrashing process often shows here first
$ top -p $(pgrep slurmctld)</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard first move for "scheduler stopped dispatching fleet-wide"
      is exactly this order: confirm the daemon is alive (<code>scontrol ping</code>), read its log for the exact failure signature, then
      check its dependencies (<code>slurmdbd</code>, the accounting database) before assuming the bug is in <code>slurmctld</code> itself —
      a huge fraction of "Slurm is broken" incidents are actually the database or network path underneath it.</p></div>`,
      try: [
        ['📖 Slurm — slurmdbd Configuration & Troubleshooting', 'https://slurm.schedmd.com/slurmdbd.html', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A Slurm controller failover gone wrong.</b> The log grep reveals
      the real story: at 02:12, the primary controller host's disk hit 100% (a runaway log file from an unrelated cron job filled
      <code>/var</code>), and <code>slurmctld</code> started failing writes to its state save location. Rather than failing over cleanly to
      the backup controller, the primary kept running in a degraded state — accepting connections but unable to persist state changes —
      because the automated failover health check only tested "is the process running," not "can it actually write state." Fix: clear the
      disk, restart <code>slurmctld</code>, and — critically — fix the failover health check to test actual write capability, not just
      process liveness, since this exact failure mode would recur identically otherwise.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Reading slurmctld logs during an outage, and what the red herrings
      looked like.</b> Early in the investigation, "Node registration violates" messages from a handful of nodes looked like the cause —
      easy to fixate on since they're the most alarming-looking log lines. They turned out to be a downstream <i>symptom</i>: nodes
      couldn't register because the controller wasn't processing anything, not because the nodes themselves had a problem. The actual root
      cause (the full disk) was in a quieter, easy-to-scroll-past log line 20 minutes earlier. Lesson: during an outage, work backward from
      the <i>earliest</i> anomalous log line, not the loudest one — the loudest symptom is often furthest downstream from the actual
      cause.</p></div>
      <p><b>The post-incident writeup</b> that came out of this: a timeline (exactly like the L1 box above), the root cause (disk fill →
      degraded-not-failed primary → inadequate failover health check), the fix applied immediately (disk cleanup, health check patch), and
      the follow-up action items (disk usage alerting on controller hosts before they hit 100%, and a periodic failover drill so this
      exact gap doesn't get discovered live again next time).</p>`,
      try: [
        ['📖 Slurm — High Availability / Backup Controller', 'https://slurm.schedmd.com/quickstart_admin.html', 'o'],
        ['🖥️ Ch 9 — node health checks & automated remediation', '#ch9', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Failover health checks that only test      Test actual write/state-persistence capability, not just
"is the process alive"                     process liveness — a degraded-but-running daemon is often
                                             worse than an outright-dead one, since nothing fails over.
Chasing the loudest/most alarming log      Work backward from the EARLIEST anomalous log line during an
line first during an active incident       outage — the loudest symptom is often furthest downstream
                                             from the actual root cause.
No disk usage alerting on controller       A full disk on slurmctld's host is a fleet-wide outage risk;
hosts specifically                         monitor it with the same rigor as any other single point of
                                             failure, not as a generic "some server, somewhere" alert.
Untested failover paths ("we have a        A backup controller that's never actually been failed over
backup controller, so we're covered")      to in a drill is an assumption, not a tested capability —
                                             schedule periodic failover drills.
Treating the incident as resolved once     Root cause without a follow-up fix (the health check gap
service is restored, skipping the writeup  here) just schedules a repeat incident — the writeup and its
                                             action items ARE the fix, not paperwork after the fix.
Mixing cron/log-management jobs onto       Controller hosts are single points of failure for the entire
the same host as slurmctld without limits  cluster; unrelated jobs filling shared disk should never be
                                             able to affect it — isolate or quota unrelated disk usage.</code></pre>
      <p><b>The real test:</b> after this incident, could the exact same failure (full disk → degraded-not-failed primary → no failover)
      happen again tomorrow — or did the follow-up actions actually close that specific gap, not just restore service this one time?</p>`,
      try: [
        ['📖 Slurm — StateSaveLocation and Controller Recovery', 'https://slurm.schedmd.com/slurm.conf.html', 'o'],
        ['🖥️ Ch 13 — HPC monitoring & telemetry', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, this incident is a case study in a general HPC-operations principle: <b>the most dangerous failure mode is
      degraded, not dead</b>. A cleanly-crashed <code>slurmctld</code> triggers automated failover immediately and correctly; a
      <code>slurmctld</code> that stays running but can't persist state slips through any health check that only tests liveness, and causes
      a much longer, more confusing outage precisely because everything <i>looks</i> partially fine. Designing health checks, failover
      logic, and incident response around "assume degraded states exist and design to detect them specifically" — not just up/down — is
      the throughline connecting this chapter back to Chapter 9's node health checks and Chapter 13's telemetry.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why is a "degraded but running" slurmctld more dangerous than a cleanly crashed one?
A: A crashed process triggers automated failover immediately. A degraded process (e.g. unable to persist
   state due to a full disk) can keep accepting connections and passing a liveness check while silently
   failing its actual job, so no failover triggers and the outage persists far longer, undetected.

Q: During a live incident, why should you work backward from the earliest anomalous log line rather than
   the most alarming one?
A: The loudest, most alarming symptom (e.g. "Node registration violates...") is often a downstream effect
   of an earlier, quieter root cause (e.g. a disk-full warning 20 minutes prior). Fixating on the loudest
   line wastes time chasing a symptom instead of the cause.

Q: What's the concrete difference between "the outage is resolved" and "the incident is actually
   closed"?
A: Restoring service (clearing the disk, restarting slurmctld) resolves the outage. The incident isn't
   closed until the underlying gap (a failover health check that only tests liveness, not write
   capability) is fixed — otherwise the exact same failure mode can recur identically.

Q: Why should disk usage on controller (slurmctld) hosts get dedicated monitoring rather than generic
   host-level disk alerts?
A: The controller is a single point of failure for the entire cluster's job dispatching. A full disk
   there has fleet-wide blast radius, unlike a full disk on an arbitrary compute node — it deserves
   monitoring proportional to its criticality, not the same generic threshold as any other host.

Q: What does "test failover, don't assume it" mean in practice for HPC controller HA?
A: Running periodic, scheduled failover drills that actually promote the backup controller to primary,
   rather than trusting that HA configuration works because it was correctly configured once. An
   untested failover path is a hypothesis, not a verified capability.</code></pre>`,
      try: [
        ['📖 Slurm — Building a Postmortem Culture (community practices)', 'https://slurm.schedmd.com/', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is a "degraded but still running" slurmctld often more dangerous than a cleanly crashed one?',
      opts: [
        'Degraded processes always crash within seconds anyway',
        'A liveness-only health check can miss it entirely, so automated failover never triggers even though the daemon can no longer persist state',
        'Degraded processes automatically fix themselves faster than crashed ones',
        'Slurm has no concept of a degraded state, only up or down'],
      ok: 1,
      why: 'A health check testing only process liveness passes even when the daemon can no longer do its actual job (persist state), so failover — which depends on detecting failure — never triggers.' },
    { q: 'During a live cluster-wide outage investigation, why should you work backward from the earliest anomalous log line rather than the loudest one?',
      opts: [
        'The loudest log line is always the root cause',
        'The most alarming symptom is often a downstream effect of a quieter, earlier root cause',
        'Log timestamps are unreliable and should be ignored',
        'Earliest and loudest log lines are always identical'],
      ok: 1,
      why: 'Chasing the most alarming symptom (a downstream effect) wastes time; the actual root cause is often an earlier, easy-to-miss log line.' },
    { q: 'What distinguishes "the outage is resolved" from "the incident is actually closed"?',
      opts: [
        'There is no difference — restoring service is the end of the process',
        'The incident isn\'t closed until the underlying gap that allowed the failure (e.g. an inadequate failover health check) is actually fixed',
        'An incident is closed the moment the on-call engineer goes back to sleep',
        'Incidents are closed automatically by Slurm after a timeout'],
      ok: 1,
      why: 'Restoring service addresses the symptom; closing the incident requires fixing the systemic gap so the same failure mode cannot recur identically.' }
  ]
};
