/* linux-hpc-security Learn — Part 3 · Chapter 1: Slurm Scheduler Internals: Partitions, QOS & Fairshare */
window.CH[1] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Two hundred researchers submit jobs to the same cluster. Some jobs need one core for an hour, others need 512 cores for three ' +
      'days. Nobody wants the small job to wait behind the big one forever, and nobody wants one lab to burn the whole cluster while everyone ' +
      'else\'s jobs sit pending. <b>Slurm</b> is the scheduler that decides, continuously, whose job runs next and on which nodes.</p>' +
      '<pre><code>sbatch job.sh  →  PENDING (in the queue)  →  Slurm picks it  →  RUNNING on allocated nodes  →  COMPLETED</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An air-traffic controller for compute, not planes.</b> Every job is a ' +
      'flight requesting a runway (nodes) for a duration. The controller (Slurm) juggles priority, fairness across airlines (fairshare across ' +
      'labs), and gaps in the schedule (backfill) so small quick flights can slot in without waiting behind a long-haul departure.</p></div>',
      try: [
        ['📖 Slurm — Quick Start Admin Guide', 'https://slurm.schedmd.com/quickstart_admin.html', 'o'],
        ['🖥️ Part 1: the HPC/Slurm fundamentals', '../learn/#ch8', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Three concepts do most of the work: a <b>partition</b> groups nodes with shared limits (a queue with a name), a <b>QOS</b> (quality ' +
      'of service) attaches extra limits/priority on top of a partition, and <b>fairshare</b> lowers a user\'s or account\'s priority the more ' +
      'compute they have already consumed relative to their allocated share:</p>' +
      '<pre><code># partitions: named queues over a subset of nodes, each with its own limits\n' +
      '$ sinfo -s\n' +
      'PARTITION   AVAIL  TIMELIMIT   NODES(A/I/O/T)\n' +
      'gpu            up    2-00:00:00      12/4/0/16\n' +
      'cpu            up    7-00:00:00      88/12/0/100\n\n' +
      '# QOS: extra caps layered on top of a partition (max jobs, max walltime, priority boost)\n' +
      '$ sacctmgr show qos format=Name,Priority,MaxWall,MaxTRESPerUser\n\n' +
      '# fairshare: usage-weighted priority per account, decayed over time\n' +
      '$ sshare -a\n' +
      'Account   User   RawShares   RawUsage   FairShare\n' +
      'physics   alice  100         842000     0.71\n' +
      'physics   bob    100         102000     0.94</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>Production clusters run the <b><code>sched/backfill</code></b> plugin ' +
      '(the default): it lets lower-priority jobs "backfill" into gaps in the schedule as long as they will not delay any higher-priority ' +
      'job\'s expected start time. Job priority is computed from a weighted mix of <b>fairshare</b>, age (time waiting), job size, ' +
      'and QOS — tunable per site with <code>PriorityWeightFairshare</code> and friends in <code>slurm.conf</code>.</p></div>',
      try: [
        ['📖 Slurm — Multifactor Priority Plugin', 'https://slurm.schedmd.com/priority_multifactor.html', 'o'],
        ['📖 Slurm — Fair Tree fairshare algorithm', 'https://slurm.schedmd.com/fair_tree.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The job stuck PENDING forever.</b> A researcher\'s 64-node job sits ' +
      'in the queue for days with reason <code>Resources</code> while smaller jobs keep starting around it. Investigation shows the cluster ' +
      'never has 64 idle nodes simultaneously, and backfill correctly refuses to delay the big job\'s reservation by starting anything that ' +
      'would push its earliest possible start time out further — except nothing ever frees exactly 64 nodes at once. Fix: either lower the ' +
      'requested node count, request a specific feature/partition with more headroom, or set an advance reservation so the scheduler starts ' +
      'draining nodes toward the requirement instead of waiting for a lucky gap.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The fairshare dispute between two research groups.</b> Group A ' +
      'runs continuously and its fairshare priority drops; Group B runs rarely and shows up with high priority the moment they submit, ' +
      'jumping ahead of Group A\'s backlog. Group A calls this unfair since they "were here first" — but Fair Tree fairshare is deliberately ' +
      'usage-relative-to-allocation, not first-come-first-served. Fix: this is a policy conversation, not a bug — either adjust each group\'s ' +
      '<code>RawShares</code> to reflect a renegotiated allocation, or introduce a QOS with a max-jobs cap so no single group can starve the ' +
      'others even while their fairshare is briefly high.</p></div>' +
      '<p><b>Partitions overlap on purpose:</b> the same physical nodes are often reachable through multiple partitions (e.g. a fast ' +
      '"debug" partition with a short time limit, and a "batch" partition with a long one) so short interactive jobs are not stuck behind ' +
      'a queue full of multi-day runs.</p>',
      try: [
        ['📖 Slurm — Resource Limits', 'https://slurm.schedmd.com/resource_limits.html', 'o'],
        ['🖥️ Ch 8 — HPC job scheduling policy design', '#ch8', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                             FIX\n' +
      'One giant partition, no QOS tiers          Layer partitions + QOS: a debug/short queue for interactive\n' +
      '                                            work, a batch/long queue for production, caps per QOS.\n' +
      'Fairshare set once and never revisited     Fairshare reflects an ALLOCATION agreement (RawShares) —\n' +
      '                                            revisit it when budgets or team sizes actually change.\n' +
      'Requesting max walltime "just in case"      Inflated walltime requests hurt the requester\'s own backfill\n' +
      '                                            eligibility and make the whole queue harder to pack.\n' +
      'No MaxJobs/MaxSubmit cap per user            One user submitting 50,000 array-job tasks can dominate\n' +
      '                                            the pending queue and starve everyone else\'s scheduling pass.\n' +
      'Treating PENDING "Resources" as a bug        It usually means the schedule is correctly waiting for\n' +
      '                                            enough simultaneous capacity — check backfill projections\n' +
      '                                            (`squeue --start`) before assuming Slurm is broken.\n' +
      'Ignoring node weight / feature tags          Slurm can prefer packing jobs onto fewer, less-power-\n' +
      '                                            efficient nodes first if NodeWeight and TRES billing are unset.</code></pre>' +
      '<p><b>The real test:</b> for a "why is my job not starting" question, can you read <code>squeue --start</code> (backfill\'s projected ' +
      'start time), <code>sprio</code> (the priority breakdown), and <code>sshare</code> (current fairshare) together to explain the exact ' +
      'reason — instead of guessing "the cluster is busy"?</p>',
      try: [
        ['📖 Slurm — sprio(1)', 'https://slurm.schedmd.com/sprio.html', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, Slurm tuning is a <b>policy-encoding</b> problem: partitions, QOS, and fairshare weights are how an organization\'s ' +
      'compute-allocation politics get turned into a deterministic, auditable algorithm. The scheduler cannot resolve "whose work matters ' +
      'more" — it can only faithfully execute whatever priority formula the site has configured. Getting this right means treating ' +
      '<code>slurm.conf</code> priority weights as a governance artifact, reviewed the same way a budget is.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A 64-node job has sat PENDING for three days with reason "Resources". Is Slurm broken?\n' +
      "A: Not necessarily. Backfill will not start a lower-priority job if doing so delays this job's projected\n" +
      '   start time. If the cluster never simultaneously frees 64 nodes, the job waits correctly. Check\n' +
      '   `squeue --start` for its projected start before assuming a bug.\n\n' +
      'Q: Group A runs constantly and their fairshare drops; Group B runs rarely and jumps the queue when they\n' +
      '   submit. Is this a bug?\n' +
      'A: No — Fair Tree fairshare is usage-relative-to-allocated-share, not first-come-first-served. This is\n' +
      "   expected behavior; disagreement about it is a policy conversation about RawShares, not a defect.\n\n" +
      'Q: What is the difference between a partition and a QOS?\n' +
      'A: A partition is a named queue over a subset of nodes with its own base limits. A QOS layers\n' +
      '   additional limits and/or a priority boost on top, and the same QOS can be attached to jobs across\n' +
      '   multiple partitions — they compose rather than substitute for each other.\n\n' +
      'Q: Why can inflated walltime requests hurt the requester?\n' +
      'A: Backfill scheduling uses the REQUESTED walltime to decide whether starting a job would delay\n' +
      '   higher-priority jobs. An inflated request makes the job look like it will occupy nodes longer,\n' +
      '   reducing its own chances of slotting into a backfill gap.\n\n' +
      'Q: How do you stop one user from dominating the pending queue with thousands of array-job tasks?\n' +
      'A: Set MaxSubmitJobs / MaxJobs limits per user or QOS in sacctmgr, so a single burst of submissions\n' +
      "   cannot crowd out every other user's jobs from the scheduler's consideration set.</code></pre>",
      try: [
        ['📖 Slurm — QOS documentation', 'https://slurm.schedmd.com/qos.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A 64-node job has been PENDING for three days with reason "Resources", while smaller jobs keep starting. What does this most likely mean?',
      opts: [
        'Slurm is broken and needs a restart',
        'Backfill is correctly refusing to delay the big job\'s projected start time, and the cluster has not yet had 64 nodes free simultaneously — check `squeue --start`',
        'The job was submitted with the wrong partition name',
        'The user has run out of fairshare entirely and can never run again'],
      ok: 1,
      why: 'Backfill only starts lower-priority jobs when doing so will not delay a higher-priority job\'s projected start. A large node request can validly wait for a rare simultaneous-capacity gap.' },
    { q: 'Group A runs continuously and their fairshare priority drops over time; Group B runs rarely and gets high priority when they submit. What is this?',
      opts: [
        'A bug in the Fair Tree algorithm that should be reported',
        'Expected behavior — fairshare is usage-relative-to-allocated-share, so heavy recent users get lower priority regardless of who submitted first',
        'Proof that Group B is cheating the scheduler',
        'A sign that the cluster needs more nodes'],
      ok: 1,
      why: 'Fairshare intentionally lowers priority for accounts that have consumed more than their allocated share recently. Disagreement about the outcome is a policy (RawShares) conversation, not a defect.' },
    { q: 'What is the practical difference between a Slurm partition and a QOS?',
      opts: [
        'They are the same thing with different names',
        'A partition is a named queue over a subset of nodes with base limits; a QOS layers additional limits/priority on top and can apply across multiple partitions',
        'A QOS only exists for GPU jobs',
        'A partition can only be used by one user at a time'],
      ok: 1,
      why: 'Partitions and QOS compose: the same QOS (e.g. a "high-priority" tier with tighter caps) can be attached to jobs in several different partitions rather than duplicating limits per partition.' }
  ]
};
