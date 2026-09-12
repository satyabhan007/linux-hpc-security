/* linux-hpc-security Learn — Part 3 · Chapter 4: RDMA/InfiniBand Fabric Design */
window.CH[4] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>Ethernet moves data by copying it through the kernel's networking stack on both ends — fine for a web request, far too slow for an
      MPI job exchanging billions of small messages per second. <b>RDMA</b> (Remote Direct Memory Access) lets one node write directly into
      another node's memory, bypassing the CPU and kernel entirely on the data path. <b>InfiniBand</b> is the dominant fabric built around
      this idea, and the physical wiring pattern connecting every node to every other node — the <b>topology</b> — decides the cluster's
      ceiling before a single job ever runs.</p>
      <pre><code>Ethernet + TCP: app → kernel copy → NIC → wire → NIC → kernel copy → app   (CPU involved both ends)
      RDMA:          app → NIC → wire → NIC → app                          (CPU bypassed both ends)</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A dedicated pneumatic tube vs. the office mail cart.</b> The mail cart
      (TCP/IP) has to be loaded, wheeled through the building, and unloaded by a person at both ends — every hop costs someone's attention.
      A pneumatic tube (RDMA) drops a message straight into the recipient's inbox with nobody touching it in between. Fabric topology is the
      building's floor plan: a badly laid-out floor plan means even a great tube system has bottleneck junctions everywhere.</p></div>`,
      try: [
        ['📖 InfiniBand Trade Association — Overview', 'https://www.infinibandta.org/about-infiniband/', 'o'],
        ['🖥️ Ch 3 — MPI job placement & topology awareness', '#ch3', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Two topologies dominate HPC fabric design: <b>fat-tree</b> (a hierarchical tree where link capacity increases toward the root,
      giving full bisection bandwidth if built "non-blocking") and <b>dragonfly</b> (groups of densely-connected switches joined by fewer,
      longer inter-group links — cheaper at very large scale, at the cost of possible congestion on those inter-group hops). A
      <b>Subnet Manager (SM)</b> is the control-plane software that discovers the fabric and assigns routing:</p>
      <pre><code># see the fabric's active subnet manager and its state
$ sminfo
sminfo: sm lid 1 sm guid 0x...., activity count 4210 priority 0 state 3 SMINFO_MASTER

# discover the physical topology as OpenSM/the SM sees it
$ ibnetdiscover | head -20

# check per-port link health — error counters are the fabric's "check engine light"
$ ibqueryerrors -s SymbolErrorCounter,LinkDowned,PortRcvErrors

# see all endpoints and their current link speed/width (e.g. 4X HDR = 200Gb/s)
$ ibstat</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard control-plane software is <b><code>OpenSM</code></b> (or a
      vendor-managed SM on modern NVIDIA/Mellanox switches), and the standard diagnostic suite is the <b>InfiniBand diagnostic tools</b>
      package (<code>ibnetdiscover</code>, <code>ibqueryerrors</code>, <code>ibstat</code>, <code>perfquery</code>). Every serious fabric
      runs redundant SMs with automatic failover — a fabric with a single SM is a single point of failure for the entire cluster's
      networking.</p></div>`,
      try: [
        ['📖 Linux RDMA — Subnet Manager (OpenSM) docs', 'https://enterprise-support.nvidia.com/s/', 'o'],
        ['📖 NVIDIA — InfiniBand Network Diagnostics', 'https://docs.nvidia.com/networking/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Sizing a fat-tree for a new GPU cluster.</b> A 64-node GPU cluster
      needs full bisection bandwidth for large all-reduce collectives during distributed training. A 2-layer fat-tree with non-blocking
      1:1 oversubscription at every leaf switch guarantees any node can talk to any other node at full link rate simultaneously — but doubles
      the switch/cable count versus a 2:1 oversubscribed design. The real sizing question isn't "can we afford non-blocking" but "does our
      actual workload's collective pattern need it" — a training job dominated by all-reduce over the full node set benefits far more from
      non-blocking than a loosely-coupled parameter-sweep workload, which tolerates 2:1 or even 4:1 oversubscription without a measurable
      slowdown.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Diagnosing a subnet-manager failover.</b> Jobs across the whole
      cluster start reporting intermittent RDMA timeouts for about 90 seconds, then recover on their own. <code>sminfo</code> shows the SM
      priority and master GUID changed right at the timeout window — the master SM's host rebooted for a routine kernel update, and the
      standby SM took over, which is supposed to be seamless but briefly re-computes routing tables while the primary is unreachable.
      Fix: this is expected fat-tree/SM behavior during a failover, not a network fault — the actual bug, if any, is scheduling that kernel
      update without confirming the standby SM's failover path had been tested recently.</p></div>
      <p><b>InfiniBand vs. RoCE (RDMA over Converged Ethernet):</b> RoCE runs the RDMA verbs API over Ethernet, letting a site reuse existing
      Ethernet operational tooling at the cost of needing Priority Flow Control (PFC) tuned correctly to avoid packet loss killing RDMA
      performance — a fabric decision that trades InfiniBand's purpose-built lossless design for Ethernet's ecosystem familiarity.</p>`,
      try: [
        ['📖 NVIDIA — RoCE vs InfiniBand Considerations', 'https://docs.nvidia.com/networking/', 'o'],
        ['🖥️ Ch 5 — parallel filesystems at scale: Lustre & GPFS', '#ch5', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Single Subnet Manager, no standby           Run redundant SMs (different hosts) with automatic priority-
                                             based failover; test the failover path, don't assume it works.
Sizing the fabric off node count alone,     Size against the actual collective communication pattern
ignoring the workload's traffic pattern     (all-reduce-heavy training vs. loosely-coupled sweeps) —
                                             oversubscription that's fine for one workload cripples another.
Ignoring port error counters until a        ibqueryerrors should run on a schedule; a slowly climbing
job fails                                   SymbolErrorCounter predicts a future link failure well before
                                             it causes a job-fatal timeout.
Treating InfiniBand and RoCE as             RoCE needs Priority Flow Control (PFC) and ECN tuned
interchangeable "just RDMA"                 correctly or it silently degrades to lossy behavior that
                                             tanks RDMA throughput — it is not a drop-in swap.
Cabling a fat-tree without documenting      Undocumented cabling makes root-cause of a bisection-
the intended non-blocking ratio             bandwidth regression nearly impossible — a bad cable can
                                             silently turn a "non-blocking" fabric into an oversubscribed one.
Assuming dragonfly's cost savings are       Dragonfly's inter-group links can congest heavily on
"free" at any scale                         adversarial or all-to-all traffic patterns — validate with the
                                             actual expected traffic matrix, not just node count.</code></pre>
      <p><b>The real test:</b> can you explain your fabric's <i>oversubscription ratio</i> and justify it against the specific communication
      pattern of your dominant workload — not just recite "we bought a fat-tree" as if the topology name alone tells you anything about
      performance under load?</p>`,
      try: [
        ['📖 NVIDIA — Fat-Tree Topology Design Guide', 'https://docs.nvidia.com/networking/', 'o'],
        ['🖥️ Ch 12 — burst-to-cloud HPC', '#ch12', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, fabric design is an economics problem disguised as a networking problem: every dollar spent pushing
      oversubscription toward 1:1 (non-blocking) is a dollar not spent on compute or storage, and the right answer depends entirely on
      whether your workload's traffic matrix actually stresses bisection bandwidth. A cluster dominated by loosely-coupled, embarrassingly
      parallel jobs is wasting money on a fully non-blocking fat-tree; a cluster dominated by large all-reduce training runs is losing far
      more in wall-clock time than it would spend removing oversubscription.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: What does RDMA actually bypass, and why does that matter for MPI performance?
A: RDMA lets a NIC write directly into a remote process's registered memory, bypassing the CPU and
   kernel networking stack on both ends. This eliminates per-message copy and context-switch overhead,
   which dominates latency for the many small messages typical of tightly-coupled MPI collectives.

Q: When is a 2:1 oversubscribed fat-tree the right choice over a fully non-blocking one?
A: When the dominant workload's communication pattern doesn't stress full bisection bandwidth
   simultaneously across the whole fabric — e.g. loosely-coupled parameter sweeps or embarrassingly
   parallel jobs. Paying for non-blocking capacity that's rarely exercised is a wasted capital cost.

Q: Jobs cluster-wide see ~90 seconds of intermittent RDMA timeouts, then recover. sminfo shows the SM
   master GUID changed at that time. What happened?
A: The active Subnet Manager failed over to a standby (e.g. its host rebooted). This is expected
   behavior during failover, not a fabric fault — routing recomputation briefly disrupts traffic. The
   real question is whether the failover was tested/expected, not whether the network is broken.

Q: What's the operational risk of running RoCE instead of native InfiniBand without tuning PFC/ECN?
A: RoCE depends on a lossless-like Ethernet fabric via Priority Flow Control; if PFC/ECN aren't tuned,
   packet loss under congestion silently degrades RDMA throughput and can trigger head-of-line blocking
   across unrelated traffic classes — RoCE is not a drop-in Ethernet replacement for InfiniBand.

Q: Why should port error counters (ibqueryerrors) be monitored continuously rather than checked only
   after a job fails?
A: Symbol errors and link-down counts typically climb gradually before a link fails outright. Continuous
   monitoring turns a future job-fatal fabric failure into a scheduled, proactive cable/port replacement.</code></pre>`,
      try: [
        ['📖 NVIDIA — InfiniBand vs Ethernet for AI/HPC Fabrics', 'https://docs.nvidia.com/networking/', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'What does RDMA fundamentally bypass compared to a traditional TCP/IP network path?',
      opts: [
        'The physical network cable',
        'The CPU and kernel networking stack on both the sending and receiving ends',
        'The switch hardware entirely',
        'The need for any addressing scheme'],
      ok: 1,
      why: 'RDMA lets a NIC write directly into remote registered memory, avoiding per-message CPU copies and kernel involvement — the source of its latency advantage for MPI-style workloads.' },
    { q: 'Cluster-wide jobs see about 90 seconds of intermittent RDMA timeouts, and sminfo shows the master Subnet Manager GUID changed at that moment. What is the most likely explanation?',
      opts: [
        'A cluster-wide hardware failure requiring immediate replacement of all switches',
        'A Subnet Manager failover to a standby, briefly recomputing routing — expected behavior, not necessarily a fault',
        'A misconfigured MPI job consuming all bandwidth',
        'A DNS outage unrelated to the fabric'],
      ok: 1,
      why: 'SM failover is designed to be resilient but briefly disruptive while routing tables recompute; the real question is whether the failover path was tested, not whether the fabric is broken.' },
    { q: 'When is a 2:1 (or higher) oversubscribed fat-tree an appropriate design choice over a fully non-blocking one?',
      opts: [
        'Never — non-blocking is always required for any HPC cluster',
        'When the dominant workload is loosely-coupled and does not simultaneously stress full bisection bandwidth cluster-wide',
        'Only for storage-only clusters with no compute',
        'Oversubscription ratio has no effect on any workload'],
      ok: 1,
      why: 'Oversubscription is a cost/performance tradeoff that should be justified against the actual traffic matrix of the dominant workload, not chosen by default in either direction.' }
  ]
};
