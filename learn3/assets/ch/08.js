/* linux-hpc-security Learn — Part 3 · Chapter 8: HPC Job Scheduling Policy Design */
window.CH[8] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>Chapter 1 covered how Slurm's fairshare, priority, and backfill mechanisms <i>work</i>. This chapter is about <i>designing</i> the
      actual policy those mechanisms enforce: how much should a lab's recent usage lower its priority? Should a deadline-critical job be
      allowed to <b>preempt</b> (kick off) a running lower-priority job? How much slack should backfill leave so small jobs can slot into
      gaps? These are organizational decisions encoded as numbers in <code>slurm.conf</code>, and a bad policy makes a physically capable
      cluster feel broken to its users.</p>
      <pre><code>Policy question               →  slurm.conf knob
"who gets priority?"          →  PriorityWeightFairshare, PriorityWeightAge, PriorityWeightJobSize
"can urgent jobs jump ahead?" →  PreemptType, PreemptMode, QOS-level PreemptExemptTime
"how aggressively backfill?"  →  SchedulerParameters=bf_window, bf_resolution, bf_max_job_test</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Writing the rules of the road, not driving the car.</b> Chapter 1 was
      about how a traffic signal (Slurm) actually operates. This chapter is about deciding the rules the signal enforces: does an ambulance
      (a deadline job) get to run every red light? How long is a yellow light (backfill window)? Get these rules wrong and the traffic
      signal works perfectly — it's just enforcing bad rules, and everyone sits in traffic that didn't need to happen.</p></div>`,
      try: [
        ['📖 Slurm — Multifactor Priority Plugin', 'https://slurm.schedmd.com/priority_multifactor.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p><b>Preemption</b> lets a higher-priority/QOS job forcibly suspend, requeue, or cancel a running lower-priority job to free
      resources immediately rather than waiting in the normal queue. Backfill's aggressiveness (how far ahead it looks, how many jobs it
      tests per scheduling pass) is tuned via <code>SchedulerParameters</code>:</p>
      <pre><code># define a preemptible QOS: jobs at this QOS get requeued if a higher-priority job needs the nodes
$ sacctmgr add qos preemptible Priority=10 Flags=...
$ sacctmgr modify qos normal set GraceTime=60 PreemptMode=REQUEUE

# slurm.conf: what preemption actually does when triggered
PreemptType=preempt/qos
PreemptMode=REQUEUE
PreemptExemptTime=00:05:00   # jobs running <5min are protected from preemption

# backfill tuning: how far ahead and how many jobs to consider per pass
SchedulerParameters=bf_window=1440,bf_resolution=600,bf_max_job_test=1000

# check what backfill currently projects for a pending job
$ squeue --start -j 123456</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard preemption modes are <b><code>REQUEUE</code></b> (kill and
      resubmit — needs the job to be restartable, see Chapter 7's checkpointing), <b><code>SUSPEND</code></b> (freeze in place, resume when
      resources free up, holding memory the whole time), and <b><code>CANCEL</code></b> (kill outright, no automatic resubmission). Site
      policy documents (an internal RFC, not just <code>slurm.conf</code> comments) should state <i>why</i> each QOS gets its preemption
      behavior, since these choices directly encode organizational priorities.</p></div>`,
      try: [
        ['📖 Slurm — Preemption', 'https://slurm.schedmd.com/preempt.html', 'o'],
        ['📖 Slurm — sched/backfill Scheduling Parameters', 'https://slurm.schedmd.com/sched_config.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Tuning backfill to fit small jobs into gaps.</b> A cluster's
      utilization graphs show plenty of idle core-hours, yet users complain small jobs wait for hours. Investigation finds
      <code>bf_max_job_test</code> set too low (default-era value from a much smaller cluster) — backfill gives up scanning the pending
      queue for a fit before it reaches most small jobs, especially during a busy period with thousands of pending jobs ahead of them in
      priority order. Fix: raise <code>bf_max_job_test</code> and <code>bf_window</code> to match the cluster's actual queue depth and job
      mix, verified with before/after <code>squeue --start</code> projections — a config change, not a hardware upgrade, fixed a real
      utilization problem.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A preemption policy for a burst deadline job.</b> A grant deadline
      means one lab needs guaranteed capacity for 48 hours regardless of what else is queued. Rather than a one-off manual intervention
      (draining nodes, holding other users' jobs), the site creates a time-boxed high-priority QOS with <code>PreemptMode=REQUEUE</code>
      that only checkpoint-capable job classes are allowed to submit under (see Chapter 7) — so preempted jobs resume rather than lose all
      progress — and the QOS is disabled again after the deadline window closes. This makes an exceptional need fit inside the existing
      policy machinery instead of becoming an ad hoc, undocumented one-time hack that nobody remembers the reasoning for six months
      later.</p></div>
      <p><b>A scheduling-policy RFC</b> — a short internal document stating the goals (e.g. "no job waits more than 24h for &lt;4 nodes,"
      "GPU jobs get priority parity with CPU jobs of equal fairshare") before touching <code>slurm.conf</code> — turns policy design from
      ad hoc tuning into something reviewable, and gives a paper trail for "why is it configured this way" months later.</p>`,
      try: [
        ['📖 Slurm — Scheduling Configuration Guide', 'https://slurm.schedmd.com/sched_config.html', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Enabling preemption without requiring      REQUEUE-mode preemption on non-checkpointed jobs means
checkpoint support on preemptible jobs     preempted work is simply lost — pair preemption QOS with
                                             checkpoint-capable job classes (Chapter 7).
Backfill parameters left at defaults       bf_window/bf_max_job_test/bf_resolution should scale with
regardless of cluster/queue size            actual queue depth and job-size mix — stale defaults silently
                                             stop backfill from reaching most of a busy queue.
One-off manual interventions for urgent    Encode exceptional needs as a QOS with an explicit expiry,
deadlines (draining nodes by hand)         not a manual hack nobody remembers the reasoning for later.
No written policy rationale, only          A scheduling-policy RFC stating goals in plain language makes
slurm.conf comments (or nothing)           the numeric config auditable and reviewable, not tribal
                                             knowledge held by one admin.
SUSPEND-mode preemption on memory-heavy    Suspended jobs still hold their memory allocation — using
jobs without checking memory headroom      SUSPEND on large-memory jobs can leave a node unable to
                                             actually free enough RAM for the preempting job.
Treating "policy is fine, nobody's         Absence of complaints is not evidence of good policy — actual
complaining" as validation                  utilization and wait-time metrics (Chapter 13) validate policy,
                                             silence just means nobody escalated yet.</code></pre>
      <p><b>The real test:</b> can you point to a written rationale for every non-default priority weight and preemption rule in
      <code>slurm.conf</code> — or would a new admin inheriting the cluster have to reverse-engineer the politics from the numbers alone?</p>`,
      try: [
        ['📖 Slurm — QOS Preemption Exemptions', 'https://slurm.schedmd.com/qos.html', 'o'],
        ['🖥️ Ch 13 — HPC monitoring & telemetry', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, scheduling policy design is <b>organizational governance encoded as a config file</b> — every priority weight,
      preemption rule, and backfill parameter is a claim about whose work matters more, under what circumstances, and it should be treated
      with the same rigor as a budget: written down, reviewed, revisited on a schedule, and revised deliberately rather than by whoever
      last had root and a complaint to address. The scheduler will faithfully execute whatever politics gets encoded, correct or not.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why should preemption never be enabled on a QOS without also requiring checkpoint-capable jobs?
A: REQUEUE-mode preemption kills the running job; without checkpointing (Chapter 7), all progress since
   the job started is lost, not just since the last save. Preemption policy and checkpoint capability are
   two halves of the same design — one without the other either loses work or can't actually free
   resources on demand.

Q: A cluster has idle core-hours but users report small jobs waiting for hours. What's a likely
   backfill-tuning explanation, and how would you confirm it?
A: bf_max_job_test or bf_window may be too low for current queue depth, so backfill's per-pass scan
   never reaches most pending small jobs. Confirm with squeue --start projections before/after raising
   the parameters — a scheduler config issue, not a capacity issue.

Q: Why write a scheduling-policy RFC before changing slurm.conf priority weights?
A: The weights encode organizational tradeoffs (whose work gets priority, under what conditions). A
   written rationale makes those tradeoffs auditable and reviewable, rather than tribal knowledge that
   the next admin has to reverse-engineer from numbers alone.

Q: Why can SUSPEND-mode preemption fail to actually free enough resources for a high-priority job on a
   memory-constrained node?
A: SUSPEND freezes a job in place — it keeps its memory allocation the whole time it's suspended. On a
   memory-heavy node, suspending a job frees compute cycles but not RAM, so a preempting job that needs
   the freed memory may still not fit.

Q: How do you handle a one-time urgent capacity need (e.g. a grant deadline) without creating
   undocumented, ad hoc scheduler hacks?
A: Create a time-boxed QOS with an explicit expiry and documented scope (which job classes may use it,
   what preemption mode applies), rather than manually draining nodes or hand-editing running jobs' state
   — this keeps the exception inside the same reviewable policy machinery as everything else.</code></pre>`,
      try: [
        ['📖 Slurm — Fair Tree Fairshare Algorithm', 'https://slurm.schedmd.com/fair_tree.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should preemption (PreemptMode=REQUEUE) never be enabled on a QOS unless jobs allowed to submit under it support checkpointing?',
      opts: [
        'REQUEUE mode is purely cosmetic and never actually terminates a job',
        'Without checkpointing, a REQUEUE-preempted job loses all progress since it started, not just since a save point',
        'Checkpointing is required by Slurm to enable any QOS',
        'REQUEUE mode only works on GPU jobs'],
      ok: 1,
      why: 'REQUEUE-mode preemption kills the running job outright; without application or system-level checkpointing, all in-progress work is lost, making preemption policy and checkpoint capability inseparable design decisions.' },
    { q: 'A cluster shows idle core-hours but small jobs still wait hours in queue. What scheduler-config explanation should you investigate?',
      opts: [
        'The cluster definitely needs more physical nodes',
        'Backfill parameters like bf_max_job_test or bf_window may be too low for current queue depth, so the scan never reaches most pending jobs',
        'Fairshare has been disabled entirely',
        'The partition definitions have too few nodes assigned'],
      ok: 1,
      why: 'Stale backfill parameters sized for a smaller cluster/queue can silently prevent backfill from evaluating most of a busy pending queue, which is a config fix, not a capacity problem.' },
    { q: 'Why can SUSPEND-mode preemption fail to free enough resources for a high-priority job on a memory-constrained node?',
      opts: [
        'SUSPEND immediately releases all resources including memory',
        'A suspended job retains its memory allocation the entire time it is suspended, so only compute cycles (not RAM) are freed',
        'SUSPEND mode does not exist in Slurm',
        'SUSPEND only works for single-node jobs'],
      ok: 1,
      why: 'SUSPEND freezes the job in place rather than terminating it, so its memory footprint remains reserved — a preempting job needing that RAM may still not fit even after suspension.' }
  ]
};
