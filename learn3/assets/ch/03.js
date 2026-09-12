/* linux-hpc-security Learn — Part 3 · Chapter 3: MPI Job Placement & Topology Awareness */
window.CH[3] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>An MPI job splits work across many <b>ranks</b> (processes) that constantly talk to each other. Where those ranks physically land —
      same core, same socket, same node, or a different rack across the fabric — changes how fast that talking happens by an order of
      magnitude. Two jobs can request the identical node count and core count and get wildly different runtimes purely because of
      <b>placement</b>: which rank sits next to which.</p>
      <pre><code>16 ranks, badly placed: rank 0 and rank 1 (which talk constantly) end up on different racks
16 ranks, well placed:  rank 0 and rank 1 share a socket — same memory bus, same NUMA node</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Seating a team that talks constantly vs. one that doesn't.</b> If two
      coworkers are on a call all day, you seat them next to each other, not on different floors. MPI topology awareness is seating chart
      design for processes: put the ranks that exchange the most messages as physically close as the fabric allows, and let ranks that barely
      talk to each other live farther apart.</p></div>`,
      try: [
        ['📖 Open MPI — Rank/Process Placement', 'https://docs.open-mpi.org/en/main/running-apps/rankfiles.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Slurm's <code>srun</code> and OpenMPI/MPICH both expose placement controls. <code>--cpu-bind</code> pins a rank to specific cores so
      the kernel scheduler can't migrate it mid-run (which would evict its cache), and <code>--distribution</code> controls how ranks are
      spread across nodes/sockets — <code>block</code> fills one node before moving to the next, <code>cyclic</code> round-robins ranks across
      nodes:</p>
      <pre><code># pin each rank to a distinct core, don't let the kernel migrate it
$ srun --ntasks=32 --cpu-bind=cores ./app

# block:cyclic — fill sockets within a node (block), round-robin across nodes (cyclic)
$ srun --ntasks=64 --nodes=4 --distribution=block:cyclic ./app

# see exactly where srun put every rank before trusting a benchmark number
$ srun --ntasks=8 --cpu-bind=verbose,cores hostname
cpu-bind=MASK - node03, task  0  0 [12345]: mask 0x1 set
cpu-bind=MASK - node03, task  1  1 [12346]: mask 0x2 set

# OpenMPI's own binding report, independent of Slurm's
$ mpirun --report-bindings --bind-to core -np 8 ./app</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tool is <b>hwloc</b> (Hardware Locality) — <code>lstopo</code>
      prints the actual NUMA/socket/core/cache topology of a node, and both Slurm and OpenMPI query it under the hood to translate
      <code>--cpu-bind</code>/<code>--bind-to</code> requests into real core masks. Never guess a node's topology; run
      <code>lstopo --output-format txt</code> and design placement against what's actually there.</p></div>`,
      try: [
        ['📖 Slurm — srun(1) — cpu-bind & distribution', 'https://slurm.schedmd.com/srun.html', 'o'],
        ['📖 hwloc — lstopo documentation', 'https://www.open-mpi.org/projects/hwloc/doc/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Topology-unaware placement tanking a benchmark.</b> A CFD code
      benchmarked at 200 GFLOP/s on a vendor's test cluster runs at 90 GFLOP/s on the production cluster with identical node specs. The
      difference: the benchmark's job script pinned ranks with <code>--cpu-bind=cores --distribution=block:block</code> so nearest-neighbor
      halo-exchange ranks shared sockets; production submitted with no binding flags at all, so the kernel scheduler let ranks drift across
      NUMA nodes mid-run, turning every halo exchange into a cross-socket memory access. Fix: copy the exact <code>--cpu-bind</code>/
      <code>--distribution</code> flags into the production job script — this is a one-line fix for a 2x regression.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Noisy-neighbor cross-job interference.</b> Two unrelated jobs share
      a node (common on a CPU-only partition with core-level allocation) and one job's ranks are pinned to cores 0-7 while the other's are
      pinned to cores 8-15 — correct in isolation, except both jobs' ranks share the same last-level cache and memory bandwidth, so job A's
      memory-bound kernel silently steals bandwidth from job B, and job B's runtime becomes unpredictable run to run. Fix: for
      bandwidth-sensitive HPC workloads, prefer <b>exclusive node allocation</b> (<code>--exclusive</code> in <code>sbatch</code>) over
      sharing nodes across jobs, or use Slurm's <code>--gres-flags=enforce-binding</code> and cgroup-based memory bandwidth controls where
      available.</p></div>
      <p><b>Rank-to-topology mapping matters most for collectives:</b> operations like <code>MPI_Allreduce</code> and
      <code>MPI_Alltoall</code> touch every rank, so a topology-aware collective algorithm (which OpenMPI/MPICH select automatically based on
      message size and rank count) benefits enormously from ranks being placed so that the underlying tree/ring pattern follows the fabric's
      actual physical layout rather than an arbitrary rank order.</p>`,
      try: [
        ['📖 Open MPI — Performance Tuning', 'https://docs.open-mpi.org/en/main/tuning-apps/index.html', 'o'],
        ['🖥️ Ch 4 — RDMA/InfiniBand fabric design', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Submitting MPI jobs with no --cpu-bind      Always set --cpu-bind=cores (or =sockets for threaded MPI
or --distribution flags at all              ranks) so the kernel can't migrate ranks mid-run.
Assuming "same node count" means            Two jobs with identical --nodes/--ntasks can get different
"same performance"                          placement (block vs cyclic default differs by Slurm version)
                                             — always verify with --cpu-bind=verbose before trusting numbers.
Sharing nodes across unrelated jobs on      Bandwidth-sensitive HPC codes suffer unpredictable slowdowns
bandwidth-heavy workloads                   from LLC/memory-bandwidth contention; prefer --exclusive.
Guessing NUMA topology instead of           Run lstopo on the actual node class — topology varies by
reading it                                  vendor/generation even within "the same" cluster.
Ignoring hybrid MPI+OpenMP thread           A rank with 8 OpenMP threads needs --cpus-per-task=8 and
placement (ranks vs. threads per rank)      --cpu-bind=sockets, not the flat-rank binding used for
                                             pure-MPI jobs — otherwise threads within a rank fight for cores.
Treating a slow collective as "MPI is       Check whether the collective algorithm (tree vs. ring vs.
just slow" without checking algorithm       recursive-doubling) matches message size and rank count —
selection                                   mpirun --report-bindings and MCA params expose the choice.</code></pre>
      <p><b>The real test:</b> given a benchmark regression between two "identical" clusters, is your first move to diff the actual placement
      (<code>--cpu-bind=verbose</code> output, <code>lstopo</code>) rather than assuming the hardware itself is at fault?</p>`,
      try: [
        ['📖 Slurm — Support for Multi-core/Multi-thread Architectures', 'https://slurm.schedmd.com/mc_support.html', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, MPI placement is a co-design problem between the <b>application's communication pattern</b>, the <b>node's NUMA/
      cache topology</b>, and the <b>fabric's physical layout</b> — none of which the scheduler can infer on its own. A nearest-neighbor
      stencil code, an all-to-all FFT, and an embarrassingly-parallel Monte Carlo job each want a completely different placement strategy, and
      encoding the right one into the job script (not hoping the defaults are good enough) is the difference between a cluster that performs
      at its rated FLOPS and one that quietly runs at half of it.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Two "identical" clusters run the same MPI benchmark at 200 GFLOP/s and 90 GFLOP/s. What's your first
   diagnostic step?
A: Compare actual rank placement, not job scripts on paper — run with --cpu-bind=verbose,cores (Slurm)
   or --report-bindings (OpenMPI) on both and diff the resulting core masks. A missing --distribution or
   --cpu-bind flag on one cluster is the single most common cause of this class of regression.

Q: Why does sharing a node between two unrelated jobs hurt bandwidth-sensitive HPC codes even when core
   allocation is exclusive per job?
A: Cores can be exclusively allocated while the shared last-level cache and memory bandwidth are not.
   Two memory-bound jobs on the same socket compete for the same memory controller regardless of which
   cores they're pinned to — the fix is exclusive node allocation, not tighter core pinning.

Q: When does cyclic distribution outperform block distribution?
A: Block fills one node before moving to the next; cyclic round-robins across nodes. Cyclic helps when
   per-node resource contention (e.g. a shared NIC) matters more than intra-node locality — e.g. spreading
   I/O-heavy ranks across nodes. Block wins when intra-node/socket locality dominates, e.g. tight
   halo-exchange stencils.

Q: A hybrid MPI+OpenMP job (4 ranks/node, 8 threads/rank) runs slower than expected. What placement
   detail is most likely wrong?
A: --cpus-per-task wasn't set to match threads-per-rank, and/or --cpu-bind used =cores instead of
   =sockets — each rank's OpenMP threads then compete for a core count smaller than the thread count,
   or spill across NUMA boundaries the rank itself is bound within.

Q: Why can't the scheduler pick optimal MPI placement automatically without hints from the job script?
A: The scheduler knows node/core topology but not the application's communication pattern (stencil vs.
   all-to-all vs. embarrassingly parallel). Optimal placement requires matching that pattern to the
   topology — information only the job script (via --cpu-bind/--distribution or a rankfile) supplies.</code></pre>`,
      try: [
        ['📖 Open MPI — MCA Parameters for Collective Tuning', 'https://docs.open-mpi.org/en/main/tuning-apps/mca-params.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Two "identical" clusters run the same MPI benchmark at 200 GFLOP/s and 90 GFLOP/s. What should you check first?',
      opts: [
        'Assume one cluster has faulty hardware and file a vendor ticket',
        'Compare actual rank placement (--cpu-bind=verbose / --report-bindings output) between the two runs',
        'Re-run the benchmark more times until the numbers match',
        'Increase the node count on the slower cluster'],
      ok: 1,
      why: 'A missing or different --cpu-bind/--distribution flag between two otherwise-identical clusters is the most common cause of large, reproducible MPI performance regressions.' },
    { q: 'Why can two jobs sharing a node still suffer bandwidth contention even with exclusive, non-overlapping core allocation?',
      opts: [
        'Because Slurm always shares cores between jobs regardless of settings',
        'Because last-level cache and memory bandwidth are shared resources that core pinning alone does not isolate',
        'Because MPI requires root access to bind cores correctly',
        'Because cgroups cannot enforce core exclusivity'],
      ok: 1,
      why: 'Cores can be exclusively pinned while the memory controller and LLC remain shared, so memory-bound jobs interfere regardless of core assignment — exclusive node allocation is the real fix.' },
    { q: 'What is the practical difference between --distribution=block and --distribution=cyclic in Slurm?',
      opts: [
        'Block round-robins ranks across nodes; cyclic fills one node first',
        'Block fills one node/socket before moving to the next; cyclic round-robins ranks across nodes',
        'They are identical, just different names for the same behavior',
        'Cyclic only applies to GPU jobs'],
      ok: 1,
      why: 'Block distribution favors intra-node/socket locality (good for tight nearest-neighbor communication); cyclic spreads ranks to reduce per-node resource contention.' }
  ]
};
