/* linux-hpc-security Learn — PART 3 (HPC Cluster Orchestration at Scale).
 * Hub metadata only; chapter bodies load lazily from assets/ch/NN.js */
window.PART = {
  num: 3,
  kicker: 'Part 3',
  heroTitle: 'HPC cluster orchestration at scale',
  heroSub: '16 chapters on running an HPC cluster as a production platform: Slurm scheduler internals (partitions/QOS/fairshare), ' +
    'Warewulf stateless provisioning, MPI job placement &amp; topology awareness, RDMA/InfiniBand fabric design, parallel ' +
    'filesystems at scale (Lustre/GPFS), GPU scheduling (MIG/time-slicing), checkpoint/restart, job scheduling policy design, ' +
    'automated node health, containerized workloads, multi-tenant accounting, burst-to-cloud HPC, monitoring/telemetry, and ' +
    'capacity planning. Each in 5 levels ending in an <b>Interview drill</b>.',
  standardNote: 'Part 1 introduced Slurm and cluster basics. This part is about running the cluster the way a production HPC ' +
    'center actually does — fairshare policy, fabric design, parallel storage at scale, and GPU multi-tenancy — with the ' +
    'standard tooling (Slurm, Warewulf, Lustre/GPFS), not a bespoke scheduler.',
  prev: { href: '../learn2/', label: 'Part 2 — Linux kernel internals & performance engineering' },
  next: { href: '../learn4/', label: 'Part 4 — security hardening & compliance engineering at scale' },
  chapters: [
    { num: 1, emoji: '🧮', title: 'Slurm Scheduler Internals: Partitions, QOS & Fairshare', layer: 'Foundation',
      tagline: 'How Slurm actually decides whose job runs next — partitions, QOS, and the fairshare tree that keeps one team from starving the rest.',
      apps: ['designing a partition layout for mixed GPU/CPU nodes', 'a fairshare dispute between two research groups', 'debugging a job stuck in PD forever'] },
    { num: 2, emoji: '📀', title: 'Warewulf & Stateless Provisioning at Scale', layer: 'Foundation',
      tagline: 'PXE boot to a running compute node in minutes with no local state to drift — imaging a 1,000-node cluster the same way every time.',
      apps: ['building a Warewulf overlay for a new node class', 'a stateless-node kernel/driver mismatch', 'imaging a rack after a firmware update'] },
    { num: 3, emoji: '🧭', title: 'MPI Job Placement & Topology Awareness', layer: 'Performance',
      tagline: 'Rank 0 next to rank 1 on the same socket matters — placing MPI ranks so the fabric, not the scheduler, becomes the bottleneck.',
      apps: ['tuning --cpu-bind and --distribution for an MPI job', 'a topology-unaware placement tanking a benchmark', 'debugging noisy-neighbor cross-job interference'] },
    { num: 4, emoji: '🔗', title: 'RDMA/InfiniBand Fabric Design', layer: 'Foundation',
      tagline: 'Fat-tree vs dragonfly, subnet managers, and why the fabric topology decides your cluster\'s ceiling before a single job runs.',
      apps: ['sizing a fat-tree for a new GPU cluster', 'diagnosing a subnet-manager failover', 'an InfiniBand vs RoCE fabric decision'] },
    { num: 5, emoji: '🗄️', title: 'Parallel Filesystems at Scale: Lustre & GPFS', layer: 'Foundation',
      tagline: 'Striping, metadata servers, and the "one directory, ten thousand small files" pattern that brings a parallel filesystem to its knees.',
      apps: ['choosing a Lustre stripe count for a workload', 'an MDS bottleneck from small-file I/O', 'a GPFS vs Lustre architecture decision'] },
    { num: 6, emoji: '🎮', title: 'GPU Scheduling: MIG, Time-Slicing & GRES', layer: 'Operations',
      tagline: 'One A100 sliced into seven tenants, or one job claiming the whole board — GRES plugins and MIG partitioning in Slurm.',
      apps: ['configuring MIG profiles for a shared GPU node', 'a GRES misconfiguration silently under-allocating GPUs', 'time-slicing vs MIG for a multi-tenant ML cluster'] },
    { num: 7, emoji: '💾', title: 'Checkpoint/Restart for Long-Running Jobs', layer: 'Operations',
      tagline: 'A 72-hour job dies at hour 71 without checkpointing — CRIU and application-level checkpointing that make preemption survivable.',
      apps: ['adding CRIU-based checkpointing to a long job', 'restarting a preempted job from its last checkpoint', 'sizing checkpoint frequency against I/O overhead'] },
    { num: 8, emoji: '📋', title: 'HPC Job Scheduling Policy Design', layer: 'Governance',
      tagline: 'Backfill, preemption, and priority weights — the policy knobs that decide whether small jobs starve behind big ones.',
      apps: ['tuning backfill to fit small jobs into gaps', 'a preemption policy for a burst deadline job', 'a scheduling-policy RFC for a shared cluster'] },
    { num: 9, emoji: '🩺', title: 'Node Health Checks, Draining & Automated Remediation', layer: 'Operations',
      tagline: 'Catching a bad DIMM or a stuck GPU before it silently corrupts a week-long job — automated health checks that drain, not just alert.',
      apps: ['a Node Health Check script catching a Xid GPU error', 'auto-draining a node with ECC errors', 'the "job failed on node 47 again" recurring-failure hunt'] },
    { num: 10, emoji: '📦', title: 'Containerized HPC Workloads: Apptainer on Slurm', layer: 'Delivery',
      tagline: 'Reproducible science without root — Apptainer/Singularity images that run identically on a laptop and a 10,000-node cluster.',
      apps: ['building an Apptainer image for a research pipeline', 'GPU passthrough into a container on Slurm', 'a container-vs-module reproducibility argument'] },
    { num: 11, emoji: '🧑‍🤝‍🧑', title: 'Multi-Tenancy, Accounting & Fairshare at Scale', layer: 'Governance',
      tagline: 'Charging compute hours accurately across departments, and stopping one group\'s burst from starving everyone else\'s fairshare.',
      apps: ['setting up Slurm accounting (sacctmgr) for chargeback', 'a fairshare decay tuning decision', 'auditing GPU-hour usage for a grant report'] },
    { num: 12, emoji: '☁️', title: 'Burst-to-Cloud HPC', layer: 'Architecture',
      tagline: 'Elastic partitions that spin up cloud nodes when the on-prem queue backs up — and the data-gravity problem that makes it hard.',
      apps: ['configuring a cloud burst partition', 'a cost-vs-queue-time bursting policy', 'moving input data to a burst node without saturating the WAN link'] },
    { num: 13, emoji: '📈', title: 'HPC Monitoring & Telemetry', layer: 'Observability',
      tagline: 'Prometheus exporters for Slurm and fabric health, plus per-job telemetry that answers "was this job actually using the GPU?"',
      apps: ['a Slurm job-efficiency exporter (CPU/GPU utilization)', 'a fabric-health dashboard catching a degraded link', 'the "why did my job run slow" self-service report'] },
    { num: 14, emoji: '💰', title: 'Cluster Capacity Planning & TCO', layer: 'Cost',
      tagline: 'Sizing the next cluster refresh from real utilization data — and the total-cost-of-ownership math that includes power and cooling.',
      apps: ['a utilization-driven capacity-planning model', 'a build-vs-cloud-burst TCO comparison', 'justifying a GPU refresh to a budget committee'] },
    { num: 15, emoji: '🚨', title: 'Case Study — Anatomy of a Cluster-Wide Outage', layer: 'Case study',
      tagline: 'A real "the scheduler stopped dispatching jobs fleet-wide" incident, read top to bottom: symptoms, diagnosis, recovery.',
      apps: ['a Slurm controller failover gone wrong', 'reading slurmctld logs during an outage', 'the post-incident writeup'] },
    { num: 16, emoji: '🗺️', title: 'Reference Architecture — The Production HPC Cluster', layer: 'Case study',
      tagline: 'Every piece of this part assembled: scheduler, provisioning, fabric, storage, GPUs, monitoring — one diagram.',
      apps: ['designing your org\'s HPC cluster architecture', 'an HPC platform RFC', 'the "walk me through your cluster design" interview'] }
  ]
};
