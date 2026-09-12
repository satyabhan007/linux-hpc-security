/* linux-hpc-security Learn — Part 3 · Chapter 6: GPU Scheduling: MIG, Time-Slicing & GRES */
window.CH[6] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A single high-end GPU (like an A100 or H100) is often far more compute than one small job needs, but GPUs traditionally could only
      be claimed whole by one job at a time. Slurm's <b>GRES</b> (Generic RESource) plugin is how the scheduler tracks and allocates GPUs
      like any other countable resource, and modern NVIDIA GPUs add two ways to actually share one physical card: <b>MIG</b> (Multi-Instance
      GPU — hardware-partitioned, isolated slices) and <b>time-slicing</b> (software-scheduled turns on the same, undivided GPU).</p>
      <pre><code>Whole-GPU job:        1 job  ←→  1 entire A100
MIG-sliced GPU:        7 jobs ←→  7 isolated hardware slices of 1 A100 (separate memory + compute)
Time-sliced GPU:       N jobs ←→  1 undivided A100, taking turns (no hardware isolation)</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An apartment building vs. a timeshare.</b> MIG is like permanently
      subdividing one building into separate apartments with their own locks, utilities, and walls — true isolation, but the number of units
      is fixed once you build it. Time-slicing is a timeshare: everyone gets the whole place, just on a rotating schedule, with no physical
      wall stopping one tenant from noticing (or being slowed by) the others.</p></div>`,
      try: [
        ['📖 Slurm — Generic Resource (GRES) Scheduling', 'https://slurm.schedmd.com/gres.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Configuring GPUs in Slurm needs two files kept in sync: <code>gres.conf</code> (what hardware exists on each node) and
      <code>slurm.conf</code> (that the partition/node advertises the GRES type). MIG partitioning itself is done with NVIDIA's
      <code>nvidia-smi</code> before Slurm ever sees the resulting instances:</p>
      <pre><code># enable MIG mode on a GPU, then create instances (profile "1g.10gb" = 1/7 compute, 10GB mem slice)
$ nvidia-smi -i 0 -mig 1
$ nvidia-smi mig -cgi 1g.10gb,1g.10gb,1g.10gb,1g.10gb,1g.10gb,1g.10gb,1g.10gb -C

# list the resulting MIG UUIDs Slurm will reference
$ nvidia-smi -L
GPU 0: NVIDIA A100 (MIG 1g.10gb) UUID: MIG-xxxxxxx...

# gres.conf on the node — one line per MIG instance
Name=gpu Type=1g.10gb File=/dev/nvidia0 MultipleFiles=... AutoDetect=nvml

# slurm.conf — advertise the count on this node's line
NodeName=gpu01 Gres=gpu:1g.10gb:7 ...

# a user requests a slice, not a whole card
$ srun --gres=gpu:1g.10gb:1 nvidia-smi</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard mechanism is Slurm's <b><code>gres.conf</code></b> +
      <b><code>AutoDetect=nvml</code></b>, which queries NVIDIA's NVML library so Slurm auto-discovers MIG instances instead of requiring
      hand-maintained device paths. Time-slicing, in contrast, doesn't create separate GRES types in Slurm at all — it's configured
      entirely at the Kubernetes/NVIDIA device-plugin layer or via CUDA MPS, and from Slurm's perspective the whole GPU is still one
      resource being shared unsafely unless MPS quotas are enforced.</p></div>`,
      try: [
        ['📖 Slurm — GRES: GPU Management', 'https://slurm.schedmd.com/gres.html#gpu_management', 'o'],
        ['📖 NVIDIA — MIG User Guide', 'https://docs.nvidia.com/datacenter/tesla/mig-user-guide/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A GRES misconfiguration silently under-allocating GPUs.</b> A node
      with 4 physical GPUs shows only 2 usable in Slurm after a maintenance reboot. <code>gres.conf</code> still lists 4 devices by static
      <code>/dev/nvidia*</code> path, but the node's PCIe re-enumeration after the reboot reordered device indices — two paths now point to
      GPUs already claimed by something else, or to nothing. Fix: switch to <code>AutoDetect=nvml</code> so Slurm queries NVML for the
      current, correct device mapping at daemon start instead of trusting static paths that can silently drift across reboots — this class
      of bug is invisible until someone notices "we have 4 GPUs but only 2 are ever schedulable."</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Time-slicing vs. MIG for a multi-tenant ML cluster.</b> A shared ML
      research cluster has many small inference/dev workloads that each need a fraction of a GPU. MIG gives hardware-enforced memory and
      fault isolation — one tenant's crash or memory leak cannot touch another's slice — but the partition sizes are fixed at creation
      and can't be resized without draining the GPU. Time-slicing is more flexible (no fixed partition sizes, any job just takes turns) but
      offers no isolation: one tenant's greedy kernel can starve another's latency-sensitive inference request with no hard limit. Fix:
      the team chooses MIG for production multi-tenant inference (isolation matters, workloads are predictable) and reserves time-slicing
      for internal dev/debug GPUs where flexibility matters more than isolation guarantees.</p></div>
      <p><b>MIG profiles are not infinitely flexible:</b> an A100's 7 possible <code>1g.5gb</code> slices vs. fewer, larger
      <code>3g.20gb</code> slices is a fixed menu set at partition-creation time (<code>nvidia-smi mig -cgi</code>) — reconfiguring a live
      GPU's MIG layout requires draining every running job off it first, so MIG partition planning should reflect actual expected job-size
      distribution, not be changed reactively every week.</p>`,
      try: [
        ['📖 NVIDIA — MIG Supported Profiles', 'https://docs.nvidia.com/datacenter/tesla/mig-user-guide/index.html#supported-profiles', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Static /dev/nvidia* paths in gres.conf     Use AutoDetect=nvml so Slurm queries live NVML device state
                                             instead of paths that can silently drift after a reboot.
Time-slicing a shared GPU with no per-      Pair time-slicing with CUDA MPS quotas (or move to MIG) —
tenant memory/fault isolation               unbounded time-slicing means one tenant's crash or leak can
                                             degrade or take down every other tenant sharing that GPU.
Reconfiguring MIG partitions reactively,    MIG layout changes require draining the GPU first; plan
draining production GPUs on short notice    partition sizes against expected job-size distribution
                                             up front, not as a weekly firefight.
Advertising "N GPUs" in slurm.conf that     If gres.conf and the physical device count silently diverge
don't match physically present hardware     (a dead GPU, a reordered index), jobs get scheduled onto
                                             resources that don't actually exist and fail mysteriously.
Assuming MIG and time-slicing are           They solve different problems: MIG = hardware isolation with
interchangeable "GPU sharing" options       fixed partition sizes; time-slicing = flexible turns with zero
                                             isolation. Pick based on whether isolation or flexibility wins.
No GPU health check integrated with         A GPU throwing Xid errors should auto-drain via Slurm's node
Slurm's node state                          health check hooks — a broken GPU accepting jobs wastes every
                                             job scheduled onto it until a human notices failures.</code></pre>
      <p><b>The real test:</b> when a team asks "should we use MIG or time-slicing," can you frame the answer around isolation-vs-flexibility
      tradeoffs and the actual workload's failure blast radius — rather than just picking whichever is newer or trendier?</p>`,
      try: [
        ['📖 NVIDIA — Multi-Process Service (MPS) Overview', 'https://docs.nvidia.com/deploy/mps/', 'o'],
        ['🖥️ Ch 9 — node health checks & automated remediation', '#ch9', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, GPU scheduling is a <b>resource-fragmentation and isolation-boundary</b> problem layered on top of everything
      Slurm already does for CPU/memory: GRES makes GPUs schedulable, but MIG and time-slicing each trade off differently between hardware
      isolation, partition flexibility, and utilization efficiency, and the wrong choice for a given workload mix either wastes expensive
      accelerator capacity (over-isolating small jobs into whole-GPU allocations) or creates silent cross-tenant interference (under-isolating
      latency-sensitive workloads onto a time-sliced card).</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: A node shows 4 physical GPUs but only 2 are ever schedulable in Slurm after a reboot. What's the
   likely cause and fix?
A: gres.conf likely uses static /dev/nvidia* device paths that no longer match the post-reboot PCIe
   device enumeration. Switch to AutoDetect=nvml so Slurm queries NVML for live, correct device mapping
   instead of trusting paths that can silently drift.

Q: When would you choose MIG over time-slicing for a multi-tenant GPU cluster?
A: When hardware-enforced memory and fault isolation matters more than partition-size flexibility — e.g.
   production multi-tenant inference where one tenant's crash or memory leak must not affect another's
   SLA. Time-slicing offers no such isolation.

Q: What's the operational cost of choosing MIG over time-slicing?
A: MIG partition sizes are fixed at creation and reconfiguring them requires draining every running job
   off that GPU first. This makes MIG less responsive to changing job-size distributions than
   time-slicing, which needs no such drain.

Q: Why doesn't Slurm natively model time-sliced GPU sharing as separate GRES the way it does MIG
   instances?
A: Time-slicing doesn't partition the GPU at the hardware level — it's the same physical device being
   handed to multiple processes in turns, typically via CUDA MPS or a device-plugin layer outside Slurm's
   GRES model. Slurm still sees and allocates "the GPU," not N independent slices of it.

Q: How should a GPU throwing NVIDIA Xid errors be integrated with Slurm's scheduling?
A: Via automated node health checks that detect Xid errors in system logs and auto-drain the node
   (state=DRAIN with a reason string) before more jobs schedule onto hardware already showing signs of
   failure — waiting for a human to notice wastes every job scheduled in the interim.</code></pre>`,
      try: [
        ['📖 Slurm — GRES AutoDetect Configuration', 'https://slurm.schedmd.com/gres.html#AutoDetect', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A node with 4 physical GPUs shows only 2 as schedulable in Slurm after a routine reboot. What is the most likely cause?',
      opts: [
        'Slurm has a hard-coded 2-GPU limit per node',
        'gres.conf uses static /dev/nvidia* device paths that no longer match post-reboot PCIe device enumeration',
        'The GPUs physically failed during the reboot',
        'MIG mode was accidentally disabled cluster-wide'],
      ok: 1,
      why: 'Static device paths in gres.conf can silently drift after PCIe re-enumeration; AutoDetect=nvml queries live NVML state instead, avoiding this class of bug.' },
    { q: 'What is the key tradeoff between MIG and time-slicing for sharing one GPU across multiple tenants?',
      opts: [
        'They are functionally identical with different names',
        'MIG gives hardware-enforced isolation with fixed partition sizes; time-slicing gives flexible turns with no isolation',
        'Time-slicing always requires more GPUs than MIG',
        'MIG can only be used with a single tenant at a time'],
      ok: 1,
      why: 'MIG hardware-partitions memory and compute for true isolation but partition sizes are fixed until drained/reconfigured; time-slicing is flexible but offers no protection between tenants sharing the same undivided GPU.' },
    { q: 'Why doesn\'t Slurm\'s GRES model represent time-sliced GPU sharing as separate resource units the way it does MIG instances?',
      opts: [
        'Time-slicing is not supported on any NVIDIA hardware',
        'Time-slicing shares one undivided physical GPU via turns (e.g. through CUDA MPS), so Slurm still sees and allocates it as a single GPU resource',
        'GRES can only track CPU resources, never GPUs',
        'Time-slicing requires a completely separate scheduler from Slurm'],
      ok: 1,
      why: 'Unlike MIG, which creates distinct hardware-isolated instances Slurm can enumerate via NVML, time-slicing has no hardware partition — the sharing happens outside Slurm\'s GRES resource model.' }
  ]
};
