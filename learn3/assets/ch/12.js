/* linux-hpc-security Learn — Part 3 · Chapter 12: Burst-to-Cloud HPC */
window.CH[12] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>An on-prem cluster is sized for typical demand, not the occasional spike — a grant deadline or a conference submission pushes
      queue wait times from hours to days. <b>Burst-to-cloud</b> is an <b>elastic partition</b> that spins up cloud compute nodes on demand
      when the on-prem queue backs up past a threshold, runs jobs there indistinguishably from a local node (same Slurm, same job script),
      and tears the cloud nodes back down when the backlog clears — paying for capacity only during the spike instead of buying enough
      hardware to sit idle the rest of the year.</p>
      <pre><code>Queue backs up  →  elastic partition triggers  →  cloud nodes join the cluster (power_save plugin)
      →  jobs run identically to on-prem  →  queue clears  →  cloud nodes shut down, billing stops</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A restaurant renting extra tables for a holiday rush.</b> Owning enough
      tables for the busiest night of the year means most nights those tables sit empty. Renting extra tables just for the rush, then
      returning them, matches capacity to actual demand — but only works if the rental tables (cloud nodes) can be set up and connected
      to the kitchen (data/fabric) fast enough to actually help during the rush itself, not after it's over.</p></div>`,
      try: [
        ['📖 Slurm — Cloud Scheduling Guide', 'https://slurm.schedmd.com/elastic_computing.html', 'o'],
        ['🖥️ Ch 8 — HPC job scheduling policy design', '#ch8', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Slurm's <b>power_save plugin</b> and <b>cloud node</b> support (nodes defined with <code>State=CLOUD</code>) let a partition
      contain nodes that don't exist yet — Slurm calls a <code>ResumeProgram</code> script to provision them (typically via the cloud
      provider's API/Terraform) the moment a job needs them, and a <code>SuspendProgram</code> to tear them down after an idle timeout:</p>
      <pre><code># slurm.conf: a cloud-bursting partition with nodes that provision on demand
NodeName=cloud[001-050] State=CLOUD CPUs=32 RealMemory=128000
PartitionName=burst Nodes=cloud[001-050] MaxTime=12:00:00

# scripts Slurm calls automatically — this is the actual "burst" mechanism
ResumeProgram=/usr/local/sbin/cloud_resume.sh    # boots the cloud instance, joins the cluster
SuspendProgram=/usr/local/sbin/cloud_suspend.sh  # terminates the instance after SuspendTimeout
ResumeTimeout=600
SuspendTimeout=300

# a user submits identically — Slurm decides on-prem vs. cloud placement
$ sbatch --partition=burst job.sh</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard integration pattern uses Slurm's <b>power_save</b>
      framework with cloud-provider-specific <code>ResumeProgram</code>/<code>SuspendProgram</code> scripts (commonly wrapping Terraform,
      AWS ParallelCluster, or a cloud vendor's own HPC bursting toolkit). The scheduler-side mechanism is identical regardless of which
      cloud is behind it — only the provisioning script implementation changes.</p></div>`,
      try: [
        ['📖 Slurm — Power Saving Guide (Elastic Computing)', 'https://slurm.schedmd.com/power_save.html', 'o'],
        ['📖 AWS ParallelCluster — Documentation', 'https://docs.aws.amazon.com/parallelcluster/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Configuring a cloud burst partition.</b> A site wants bursting to
      only trigger for jobs that actually benefit and can tolerate cloud latency/cost — not silently redirect every pending job to
      expensive cloud capacity the moment the on-prem queue has any backlog at all. The burst partition is scoped with its own QOS
      (<code>MaxWall</code>, a cost-aware priority tier) and users opt in explicitly via <code>--partition=burst</code>, rather than Slurm
      making that decision for them — cloud bursting works best as a deliberate choice the researcher makes (accepting the cost/latency
      tradeoff) rather than an invisible fallback.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Moving input data to a burst node without saturating the WAN
      link.</b> A burst job needs a 2TB training dataset that lives on the on-prem Lustre filesystem (Chapter 5). Naively copying it fresh
      to cloud storage for every burst event saturates the site's WAN uplink and adds huge latency before the job even starts computing —
      this is the classic <b>data-gravity problem</b>: compute is elastic, but the data it needs often isn't. Fix: pre-stage frequently-used
      datasets to cloud object storage ahead of time (not during the burst), use a caching/sync layer that only transfers deltas, and design
      burst-eligible workloads to prefer datasets that are already cloud-resident or small enough to move quickly.</p></div>
      <p><b>A cost-vs-queue-time bursting policy</b> quantifies the actual tradeoff explicitly: bursting to cloud costs real money per
      node-hour that on-prem capacity (already paid for) doesn't, so the trigger threshold (e.g. "burst when the queue projects &gt;6 hours
      wait for a job under 4 nodes") should reflect what the organization is actually willing to pay to save researcher wait time — a
      number that should come from a real policy conversation, not a default nobody examined.</p>`,
      try: [
        ['📖 AWS — Data Gravity and Hybrid HPC Storage Patterns', 'https://aws.amazon.com/hpc/', 'o'],
        ['🖥️ Ch 14 — cluster capacity planning & TCO', '#ch14', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Bursting triggered invisibly for every     Scope bursting to an opt-in partition/QOS so cost/latency
job the moment on-prem queue has slack     tradeoffs are a deliberate researcher choice, not a silent
                                             default that surprises the budget at month-end.
Copying the full dataset to cloud fresh    Pre-stage frequently-used datasets ahead of the burst event;
on every burst event                       sync only deltas — moving data during the burst defeats much
                                             of the latency benefit of bursting at all.
No cost cap or alerting on cloud burst      A misconfigured ResumeProgram or a runaway job class can
spend                                       burst far more nodes than intended — treat cloud spend like
                                             any other budget with alerting thresholds, not just a receipt.
Treating cloud nodes as functionally        Cloud instance network/storage latency to fabric-dependent
identical to on-prem for any workload      services (Chapter 4/5) differs meaningfully — not every
                                             workload (e.g. tightly-coupled MPI) bursts well.
No SuspendTimeout tuning — cloud nodes      Idle cloud nodes billing by the hour after a burst clears is
lingering idle after the backlog clears    pure waste; tune SuspendTimeout against actual job arrival
                                             patterns, not a generic default.
ResumeProgram failures treated as a         A cloud API outage or quota limit should degrade gracefully
scheduler bug rather than a cloud API       (job stays pending on-prem-only) with clear alerting, not
issue                                        silently fail jobs that expected burst capacity.</code></pre>
      <p><b>The real test:</b> can you show, with real numbers, what a burst event actually cost against the researcher wait-time it saved
      — or is "we have cloud bursting" a checkbox nobody has audited against its own stated purpose?</p>`,
      try: [
        ['📖 Slurm — Cloud Node States Reference', 'https://slurm.schedmd.com/elastic_computing.html', 'o'],
        ['🖥️ Ch 13 — HPC monitoring & telemetry', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, burst-to-cloud HPC is fundamentally a <b>data-gravity-constrained elasticity</b> problem: compute is easy to make
      elastic (spin up an instance in minutes), but the datasets, fabric performance, and storage semantics that HPC workloads depend on are
      not, which means the workloads that benefit most from bursting (embarrassingly parallel, modest data footprint) are often not the ones
      under the most queue pressure (large, tightly-coupled, data-heavy simulations). Designing a bursting strategy means being honest about
      which workload classes actually burst well, rather than treating bursting as a universal pressure-relief valve.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why is "data gravity" the central design constraint for cloud bursting, more than compute
   provisioning speed?
A: Cloud compute can be provisioned in minutes, but moving the large datasets many HPC workloads depend
   on cannot happen nearly as fast, and doing it during the burst event adds latency and WAN cost that
   can exceed the benefit of bursting at all. Pre-staging data ahead of demand is what actually makes
   bursting viable for data-heavy workloads.

Q: Why should cloud bursting typically be an opt-in partition rather than an invisible fallback for any
   pending job?
A: Bursting has real cost and latency tradeoffs that on-prem capacity doesn't. Making it invisible risks
   surprising the budget with cloud spend a researcher didn't consciously choose to trade off; an opt-in
   partition/QOS keeps that decision deliberate and auditable.

Q: What class of HPC workload bursts to cloud poorly, and why?
A: Tightly-coupled, large-scale MPI jobs with heavy fabric (RDMA) dependence and large working datasets.
   Cloud instance interconnects and storage typically can't match on-prem InfiniBand/parallel-filesystem
   performance, and moving the required data adds latency that can dominate the job's actual runtime.

Q: How should the burst trigger threshold (e.g. queue wait time) actually be set?
A: As an explicit policy decision quantifying what the organization is willing to pay per node-hour of
   cloud burst against the researcher wait-time saved — not a default value nobody has examined against
   real cost and demand data.

Q: What operational safeguard prevents a runaway or misconfigured burst event from generating an
   unexpectedly large cloud bill?
A: Cost caps and alerting thresholds on cloud burst spend, monitored the same way any other budget line
   is — plus tuned SuspendTimeout values so idle cloud nodes are torn down promptly once the backlog that
   triggered them clears.</code></pre>`,
      try: [
        ['📖 Slurm — Elastic Computing Best Practices', 'https://slurm.schedmd.com/elastic_computing.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is "data gravity" typically the central constraint on cloud bursting, more than how fast cloud compute can be provisioned?',
      opts: [
        'Cloud providers cannot provision compute instances quickly',
        'Moving the large datasets many HPC workloads depend on takes far longer than provisioning compute, and doing so during the burst can outweigh the benefit',
        'Data gravity refers to physical server weight, unrelated to bursting',
        'Cloud storage is always faster than on-prem parallel filesystems'],
      ok: 1,
      why: 'Compute elasticity is easy; data elasticity is not. Pre-staging frequently-used datasets ahead of a burst event, rather than moving them during it, is what makes bursting practical for data-heavy workloads.' },
    { q: 'Why should a cloud burst partition typically be opt-in for users rather than an invisible fallback whenever the on-prem queue has any backlog?',
      opts: [
        'Slurm technically cannot support automatic bursting',
        'Bursting carries real cost and latency tradeoffs that should be a deliberate, auditable choice rather than a silent default that surprises the budget',
        'Opt-in partitions run faster than automatic ones',
        'Users are not allowed to submit to cloud partitions under any circumstances'],
      ok: 1,
      why: 'Making bursting an explicit choice keeps its cost/latency tradeoff visible and intentional, rather than allowing it to silently trigger and accumulate unexpected cloud spend.' },
    { q: 'Which class of HPC workload typically bursts to cloud poorly?',
      opts: [
        'Embarrassingly parallel jobs with small data footprints',
        'Tightly-coupled, large-scale MPI jobs with heavy RDMA fabric dependence and large datasets',
        'Single-node batch scripts with no external data dependencies',
        'All workloads burst equally well regardless of characteristics'],
      ok: 1,
      why: 'Cloud interconnects and storage typically cannot match on-prem InfiniBand/parallel-filesystem performance, and moving large required datasets adds latency that can dominate runtime for such jobs.' }
  ]
};
