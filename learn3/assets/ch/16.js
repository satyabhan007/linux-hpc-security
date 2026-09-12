/* linux-hpc-security Learn — Part 3 · Chapter 16: Reference Architecture — The Production HPC Cluster */
window.CH[16] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>Fifteen chapters covered scheduling, provisioning, fabric, storage, GPUs, resilience, policy, health, containers, accounting,
      cloud bursting, telemetry, and cost — each piece in isolation. A real production HPC cluster is all of them running together,
      simultaneously, each depending on the others working correctly. This chapter is the one diagram: how the pieces actually connect,
      end to end, from a user typing <code>sbatch</code> to a completed job's results landing back in their home directory.</p>
      <pre><code>User → sbatch → Slurm (Ch1,8) picks nodes → Warewulf-provisioned node (Ch2) with GRES-scheduled
GPU (Ch6) → MPI ranks placed topology-aware (Ch3) over RDMA fabric (Ch4) → reads/writes Lustre/GPFS
(Ch5) → checkpoints periodically (Ch7) → NHC watches health throughout (Ch9) → accounting records
usage (Ch11) → telemetry captures efficiency (Ch13) → job completes, feeds next capacity plan (Ch14)</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An orchestra, not a collection of soloists.</b> Every musician
      (subsystem) can be individually excellent — a great scheduler, a great filesystem, a great fabric — and the performance still fails
      if they're not playing from the same score, in time with each other. The reference architecture is the score: it's not a 16th
      subsystem, it's the explicit statement of how all fifteen actually fit together into one coherent, working cluster.</p></div>`,
      try: [
        ['📖 Slurm — Architecture Overview', 'https://slurm.schedmd.com/overview.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>A reference architecture document is concrete, not aspirational — it names actual versions, actual topologies, and actual
      failure-domain boundaries, so a new team member (or an auditor, or a disaster-recovery plan) can understand the whole system without
      interviewing every subsystem owner individually:</p>
      <pre><code># the kind of concrete inventory a real reference architecture pins down:
Scheduler:      Slurm 24.05, slurmctld HA pair (Ch15's lesson: failover tested quarterly)
Provisioning:   Warewulf 4, 6 node classes (login/compute/bignode/gpu/storage/burst) (Ch2)
Fabric:         2-layer non-blocking fat-tree, HDR200 InfiniBand, dual redundant SM (Ch4)
Storage:        Lustre, 4 OSS pairs / 2 MDS pairs, /home (backed up) + /scratch (purged 30d) (Ch5)
GPU:            A100x8 nodes, MIG-partitioned for the "interactive" partition (Ch6)
Accounting:     slurmdbd + MariaDB, nightly backup, TRES billing weights per Ch11
Monitoring:     Prometheus + Grafana + DCGM exporter + slurm-exporter, 13-month retention (Ch13)</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard artifact is a living <b>architecture decision record
      (ADR)</b> or reference-architecture document, version-controlled alongside (or referencing) the actual <code>slurm.conf</code>,
      <code>gres.conf</code>, and Warewulf profiles it describes — not a one-time slide deck from the initial procurement that nobody
      updates as the cluster evolves.</p></div>`,
      try: [
        ['📖 Slurm — slurm.conf Full Reference', 'https://slurm.schedmd.com/slurm.conf.html', 'o'],
        ['🖥️ Ch 2 — Warewulf & stateless provisioning at scale', '#ch2', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Designing your org's HPC cluster architecture from scratch.</b>
      A new site's design review walks every chapter in this part as a checklist against the actual proposed hardware: what's the fabric
      oversubscription ratio and does it match the dominant workload (Ch4)? Is GPU sharing MIG or time-sliced, and does that match the
      multi-tenancy model (Ch6, Ch11)? Is there a tested controller failover path before day one (Ch15), not added reactively after the
      first outage? Answering each chapter's core question explicitly, in writing, before hardware is racked, catches the kind of
      structural mismatch (e.g. buying a fully non-blocking fabric for a workload that doesn't need it — wasted budget per Ch4/Ch14) that's
      far cheaper to fix on paper than after procurement.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The "walk me through your cluster design" interview question.</b>
      A strong answer doesn't recite a list of quiz-book fairshare formulas or MIG profile counts — it narrates the actual end-to-end
      request path, naming the real tradeoffs made at each layer and why: "we chose 2:1 oversubscription because our workload mix is
      dominated by loosely-coupled parameter sweeps, not all-reduce-heavy training (Ch4); we use MIG not time-slicing because our
      multi-tenant inference SLA needs hardware isolation (Ch6); our fairshare half-life is 14 days because that matched our grant funding
      cycle (Ch11)." Every design choice traces to a specific workload or policy reason — that traceability is what "understanding your
      own architecture" actually looks like.</p></div>
      <p><b>An architecture document earns its keep during an incident:</b> Chapter 15's postmortem needed exactly this kind of document
      to answer "which health check should have caught this" quickly — a cluster whose actual configuration lives only in institutional
      memory turns every incident into archaeology before it can even become remediation.</p>`,
      try: [
        ['📖 Slurm — Site Configuration Best Practices', 'https://slurm.schedmd.com/big_sys.html', 'o'],
        ['🖥️ Ch 15 — case study: anatomy of a cluster-wide outage', '#ch15', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Architecture exists only as a one-time     Version-control the reference architecture alongside the
procurement slide deck                     actual configs it describes; update it when the cluster
                                             changes, not just when someone remembers to.
Design decisions with no documented        Every non-default config choice (fabric oversubscription,
workload-based rationale                   MIG vs time-slicing, fairshare half-life) should trace to a
                                             specific workload or policy reason, per Ch4/6/11's lessons.
Treating each subsystem's design in        A fabric decision (Ch4) affects what MPI placement (Ch3) can
isolation from the others                  achieve; a storage decision (Ch5) affects checkpoint I/O cost
                                             (Ch7) — design across chapters, not chapter-by-chapter alone.
No design-time answer to "what's our       Chapter 15's lesson generalizes: a reference architecture
worst-case single point of failure"        should explicitly enumerate SPOFs (controller, SM, MDS) and
                                             their tested (not assumed) failover/mitigation plan.
Skipping a pre-procurement design review    Catching a fabric-oversubscription/workload mismatch (Ch4)
against the workload mix                   on paper is far cheaper than discovering it after racking
                                             hardware sized for the wrong communication pattern.
Reciting subsystem facts in a design       A strong "walk me through your architecture" answer narrates
interview instead of narrating tradeoffs   the end-to-end request path and WHY each tradeoff was made,
                                             not a disconnected list of feature names.</code></pre>
      <p><b>The real test, and the test for this entire part:</b> given any single-subsystem question from Chapters 1-15, can you also
      explain how that subsystem's design decision affects at least one other subsystem elsewhere in the stack — because in production,
      nothing in this list actually works in isolation?</p>`,
      try: [
        ['📖 Slurm — Large Cluster Administration Guide', 'https://slurm.schedmd.com/big_sys.html', 'o'],
        ['🖥️ Ch 14 — cluster capacity planning & TCO', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, "reference architecture" is not a diagram — it's the demonstrated ability to reason about a production HPC
      cluster as one interconnected system where a decision in any single chapter of this part ripples into several others: fabric
      topology (Ch4) constrains what MPI placement (Ch3) can achieve; storage architecture (Ch5) sets the ceiling on checkpoint I/O cost
      (Ch7); accounting rigor (Ch11) is what makes capacity planning (Ch14) trustworthy; telemetry (Ch13) is what makes every other
      chapter's claims about "how well this is working" verifiable rather than assumed. Mastery of HPC cluster orchestration at scale is
      mastery of these cross-chapter dependencies, not memorization of any single chapter's commands in isolation.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Walk me through what happens, system by system, from a researcher running sbatch to their MPI job's
   results landing back in their home directory.
A: Slurm (Ch1/8) selects nodes per partition/QOS/fairshare policy on Warewulf-provisioned, stateless
   compute nodes (Ch2). GRES (Ch6) allocates any requested GPUs. srun places MPI ranks with topology
   awareness (Ch3) over the RDMA fabric (Ch4). The job reads/writes striped data on Lustre/GPFS (Ch5)
   and periodically checkpoints (Ch7). NHC watches node health throughout (Ch9) and drains anything
   faulty. Accounting (Ch11) records exact usage; telemetry (Ch13) captures efficiency. On completion,
   results land back on the home filesystem and the job's accounting data feeds future capacity
   planning (Ch14).

Q: Why can't fabric topology (Ch4), storage architecture (Ch5), and MPI placement (Ch3) be designed
   independently of each other?
A: Fabric oversubscription sets the ceiling on how much collective-communication benefit topology-aware
   MPI placement can actually realize; storage striping and I/O bandwidth set the real-world cost of
   checkpoint frequency (Ch7). Optimizing any one in isolation can leave a bottleneck the others can't
   compensate for.

Q: Why is telemetry (Ch13) described as foundational to nearly every other chapter in this part?
A: Fairshare/accounting (Ch1/11) assumes usage reflects real work; capacity planning (Ch14) assumes
   utilization trends are accurate; scheduling policy tuning (Ch8) assumes backfill/preemption behavior
   is measurable. Without telemetry, every one of those assumptions is unverifiable guesswork.

Q: What's the single most common structural mistake in a first-time HPC cluster design, based on this
   part's chapters?
A: Designing each subsystem (fabric, storage, scheduler policy, GPU sharing model) in isolation against
   generic best practices, rather than against the cluster's actual dominant workload's communication and
   I/O pattern — leading to mismatches like over-provisioned non-blocking fabric for loosely-coupled
   workloads, or MIG partitioning that doesn't match real job-size distribution.

Q: How does Chapter 15's outage case study connect to this reference-architecture chapter?
A: It's the practical proof that architecture documentation isn't academic — during that incident, having
   (or lacking) a clear, current picture of the controller's HA design and its tested (or untested)
   failover path directly determined how fast the team could diagnose and trust the fix, versus
   reconstructing the architecture from memory under pressure.</code></pre>`,
      try: [
        ['📖 Slurm — Reference Configurations & Case Studies', 'https://slurm.schedmd.com/publications.html', 'o'],
        ['🖥️ Ch 15 — case study: anatomy of a cluster-wide outage', '#ch15', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should a reference architecture document be version-controlled and kept current, rather than treated as a one-time procurement artifact?',
      opts: [
        'Version control is only useful for source code, never documentation',
        'A cluster\'s actual configuration evolves, and a stale document turns every incident or audit into archaeology instead of quick reference',
        'Reference architectures never need to change once written',
        'Slurm automatically generates and maintains this document'],
      ok: 1,
      why: 'As shown in Chapter 15\'s outage case study, an accurate, current architecture picture is what lets a team diagnose and trust fixes quickly during a real incident.' },
    { q: 'Why can\'t fabric topology, storage architecture, and MPI placement decisions be made independently of each other in a production HPC cluster design?',
      opts: [
        'They are entirely unrelated subsystems with no interaction',
        'Fabric oversubscription limits what topology-aware MPI placement can achieve, and storage I/O bandwidth sets the real-world cost of checkpoint frequency, among other cross-dependencies',
        'Only one of the three subsystems actually affects job performance',
        'Slurm automatically reconciles any mismatches between these subsystems'],
      ok: 1,
      why: 'These subsystems are interdependent: a fabric decision constrains placement benefits, and storage decisions constrain checkpointing costs — optimizing one in isolation can leave bottlenecks the others can\'t fix.' },
    { q: 'Why is telemetry (Chapter 13) described as foundational to nearly every other subsystem covered in this part?',
      opts: [
        'Telemetry is only relevant to GPU-specific workloads',
        'Fairshare, accounting, capacity planning, and scheduling-policy tuning all depend on accurate usage/efficiency data that only telemetry provides',
        'Telemetry has no dependency relationship with any other chapter',
        'Telemetry replaces the need for accounting entirely'],
      ok: 1,
      why: 'Without telemetry, claims about usage, efficiency, and policy effectiveness across the rest of the cluster\'s subsystems are unverifiable assumptions rather than measured facts.' }
  ]
};
