/* linux-hpc-security Learn — Part 3 · Chapter 13: HPC Monitoring & Telemetry */
window.CH[13] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A cluster can be "up" — nodes online, Slurm accepting jobs — while quietly wasting most of its value: jobs requesting 64 cores
      that only ever use 4, GPUs sitting at 2% utilization while billed as fully consumed, a fabric link silently degraded to a fraction of
      its rated speed. <b>Monitoring and telemetry</b> is how a site answers "was this job actually using the hardware it reserved" instead
      of just "did the job run without crashing" — the difference between a cluster that looks healthy and one that's actually efficient.</p>
      <pre><code>Uptime monitoring:  "is the node responding?"           → necessary, not sufficient
Telemetry:          "was the GPU this job reserved       → the actually useful question
                      running at 90% utilization or 4%?"</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A car's dashboard vs. just knowing the engine turns on.</b> Knowing a
      car starts tells you almost nothing about whether it's getting good mileage, running hot, or about to need a service. The dashboard
      (telemetry) turns "it runs" into "here's exactly how well it's running, right now." A cluster with only up/down monitoring is a car
      with no dashboard — you find out about the problem only when something breaks outright.</p></div>`,
      try: [
        ['📖 Prometheus — Overview', 'https://prometheus.io/docs/introduction/overview/', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>The standard stack is <b>Prometheus</b> (metrics collection/storage) with <b>Grafana</b> (dashboards), fed by exporters that
      translate Slurm and fabric-specific data into Prometheus's metric format:</p>
      <pre><code># the slurm-exporter exposes cluster-wide scheduler metrics for Prometheus to scrape
$ curl -s localhost:8080/metrics | grep slurm_
slurm_queue_pending 42
slurm_queue_running 318
slurm_partition_cpus_idle{partition="cpu"} 96

# per-job efficiency: did this job actually use what it reserved?
$ seff 123456
Job Wall-clock time: 04:00:00
CPU Efficiency: 23.10% of 04:00:00 core-walltime
Memory Efficiency: 41.02% of 128.00 GB

# per-node exporters feed hardware-level telemetry (CPU, GPU, fabric counters) into the same stack
$ curl -s localhost:9100/metrics | grep node_

# DCGM exporter — per-GPU utilization/memory/temperature at the Prometheus layer
$ curl -s localhost:9400/metrics | grep DCGM_FI_DEV_GPU_UTIL</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard job-efficiency tool is Slurm's own <b><code>seff</code></b>
      (wraps <code>sacct</code> data into a readable CPU/memory efficiency summary), and the standard GPU telemetry exporter is
      <b>NVIDIA DCGM</b> (Data Center GPU Manager) — its Prometheus exporter is the de facto standard for per-job/per-node GPU utilization
      at HPC and ML-infrastructure sites alike.</p></div>`,
      try: [
        ['📖 Slurm — seff Utility', 'https://slurm.schedmd.com/seff.html', 'o'],
        ['📖 NVIDIA — DCGM Exporter for Prometheus', 'https://github.com/NVIDIA/dcgm-exporter', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A Slurm job-efficiency exporter catching wasted allocations.</b> A
      dashboard tracking <code>seff</code>-style efficiency across all completed jobs reveals one research group consistently requests 64
      cores but their CPU efficiency averages 15% — their code is actually single-threaded with a badly-copied job script template that
      requested far more cores "to be safe." This isn't a hardware problem or a scheduler bug; it's directly visible, actionable waste that
      a simple utilization dashboard makes obvious, where without telemetry it would just look like "the cluster is busy" from the
      scheduler's perspective (cores allocated) while doing almost no productive work.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A fabric-health dashboard catching a degraded link.</b> A specific
      InfiniBand link's <code>SymbolErrorCounter</code> (Chapter 4) has been climbing for weeks, invisible to anyone unless they happened to
      run <code>ibqueryerrors</code> manually. Feeding that counter into Prometheus with an alert threshold catches it automatically —
      turning a slow-motion hardware degradation that would eventually cause a job-fatal timeout into a scheduled cable/port swap during
      planned maintenance, at a time of the team's choosing rather than during someone's production run.</p></div>
      <p><b>The "why did my job run slow" self-service report:</b> giving researchers direct access to their own job's <code>seff</code>
      output and a Grafana dashboard scoped to their job ID turns "the cluster feels slow" support tickets into self-diagnosable answers —
      "your job used 12% of the CPU it requested" is a very different, much more actionable finding than an admin having to manually dig
      through <code>sacct</code> for every complaint.</p>`,
      try: [
        ['📖 Grafana — Getting Started', 'https://grafana.com/docs/grafana/latest/getting-started/', 'o'],
        ['🖥️ Ch 4 — RDMA/InfiniBand fabric design', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Only monitoring up/down node state,        Track per-job CPU/GPU/memory efficiency (seff, DCGM) —
never per-job resource efficiency          "the cluster is busy" and "the cluster is being used well"
                                             are completely different, and only one of them matters.
Fabric error counters checked manually,    Feed ibqueryerrors-style counters into Prometheus with
if ever, instead of continuously alerted   alert thresholds — a slowly climbing error count predicts
                                             failure well before a job-fatal timeout does.
No per-job telemetry accessible to the     Self-service seff/Grafana access turns "why was my job slow"
researcher who ran the job                 into a five-second self-diagnosis instead of an admin ticket.
Dashboards that show aggregate cluster     Aggregate utilization can look fine (85% cores allocated)
utilization but hide per-job waste         while masking that half those allocated cores are running
                                             single-threaded code at 15% efficiency — drill down by job.
Treating GPU utilization metrics as        DCGM_FI_DEV_GPU_UTIL near 100% with low memory bandwidth
optional/nice-to-have for CPU-heavy        utilization can still mean a poorly-optimized kernel — GPU
sites only                                  telemetry matters wherever GPUs are billed as a resource.
No historical retention for capacity       Point-in-time monitoring can't answer "how has utilization
planning (see Chapter 14)                  trended over 12 months" — retain enough history for the
                                             capacity-planning questions Chapter 14 actually needs answered.</code></pre>
      <p><b>The real test:</b> when someone asks "is the cluster actually being used well," can you answer with real per-job efficiency
      numbers in minutes — or only with "nodes are all allocated," which tells you nothing about whether that allocation is productive?</p>`,
      try: [
        ['📖 Slurm — Job Accounting Gather Plugins', 'https://slurm.schedmd.com/acct_gather.conf.html', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, monitoring and telemetry closes the loop between every other chapter's mechanisms and reality: fairshare and
      accounting (Chapters 1, 11) assume usage numbers reflect real work; scheduling policy (Chapter 8) assumes backfill/preemption tuning
      is working as intended; capacity planning (Chapter 14) assumes utilization trends are accurately captured. None of those assumptions
      hold without telemetry that actually measures productive use, not just allocation — a cluster can be simultaneously "fully utilized"
      by every scheduler metric and badly underperforming by every efficiency metric, and only real telemetry can tell the two apart.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: A cluster shows 95% core allocation but stakeholders suspect it's not being used well. What single
   telemetry source most directly answers this?
A: Per-job CPU/memory/GPU efficiency (seff, DCGM) aggregated across recent jobs. High allocation with low
   average efficiency reveals jobs requesting far more resources than they use — invisible to any
   metric that only tracks whether resources are allocated, not whether they're productively used.

Q: Why should fabric error counters (Chapter 4's ibqueryerrors output) be fed into continuous monitoring
   rather than checked manually when a job fails?
A: Symbol/link errors typically climb gradually before a link fails outright. Continuous monitoring with
   alert thresholds turns a slow-motion degradation into a scheduled, low-impact maintenance fix instead
   of a job-fatal failure discovered after the fact.

Q: Why give researchers direct self-service access to their own job's efficiency data instead of routing
   all such questions through admin-run investigations?
A: It converts a vague "the cluster feels slow" support ticket into an immediately actionable, specific
   finding ("your job used 12% of requested CPU") the researcher can act on themselves — scaling support
   capacity without adding admin headcount.

Q: Why can a cluster be "fully utilized" by scheduler metrics while badly underperforming by efficiency
   metrics?
A: Scheduler-level metrics (core allocation, queue depth) only measure whether resources are claimed by
   a job, not whether that job is doing productive work with them. A job holding 64 cores while running
   single-threaded code is fully "allocated" and almost entirely wasted — only per-job efficiency
   telemetry reveals this gap.

Q: How does monitoring/telemetry connect to capacity planning (Chapter 14)?
A: Capacity planning needs historical utilization trends to justify a hardware refresh or size a new
   cluster correctly. Without retained telemetry history, that planning has to guess rather than being
   grounded in actual observed demand and efficiency patterns over time.</code></pre>`,
      try: [
        ['📖 NVIDIA — DCGM Field Identifiers Reference', 'https://docs.nvidia.com/datacenter/dcgm/latest/', 'o'],
        ['🖥️ Ch 14 — cluster capacity planning & TCO', '#ch14', 'o']
      ] }
  ],

  quiz: [
    { q: 'A cluster shows 95% core allocation, but stakeholders suspect resources aren\'t being used well. What telemetry answers this most directly?',
      opts: [
        'Node uptime/reachability monitoring',
        'Per-job CPU/memory/GPU efficiency data (e.g. seff, DCGM) aggregated across recent jobs',
        'The total number of nodes in the cluster',
        'The Slurm version currently installed'],
      ok: 1,
      why: 'Allocation metrics only show resources are claimed, not that they\'re productively used; per-job efficiency data reveals the gap between requested and actually-used resources.' },
    { q: 'Why should fabric error counters be fed into continuous monitoring with alert thresholds, rather than checked manually only after a job fails?',
      opts: [
        'Manual checks are always more accurate than automated monitoring',
        'Symbol/link error counters typically climb gradually before a failure, so continuous monitoring catches degradation before it becomes job-fatal',
        'Fabric errors cannot be measured programmatically',
        'Continuous monitoring is required by InfiniBand hardware vendors'],
      ok: 1,
      why: 'Proactive, continuously monitored counters turn a slow hardware degradation into a scheduled fix, rather than a surprise failure discovered mid-job.' },
    { q: 'Why can a cluster be "fully utilized" by scheduler allocation metrics while badly underperforming by efficiency metrics?',
      opts: [
        'This situation is impossible — the two metrics always agree',
        'Allocation only measures whether resources are claimed by a job, not whether that job is using them productively',
        'Efficiency metrics are always identical to allocation metrics',
        'Scheduler metrics only apply to GPU resources, never CPU'],
      ok: 1,
      why: 'A job can hold many cores while running effectively single-threaded, showing 100% allocation but very low actual efficiency — only per-job telemetry distinguishes the two.' }
  ]
};
