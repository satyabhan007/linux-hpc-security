/* linux-hpc-security Learn — Part 2 · Chapter 3: NUMA Topology & NUMA-Aware Tuning */
window.CH[3] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>On a 2-socket server, not all RAM is equally close to every CPU. Memory attached to "your" socket is fast to reach; memory ' +
      'attached to the other socket requires a hop across the inter-socket link and is noticeably slower. A process that gets scheduled on ' +
      'one socket but has its memory allocated on the other pays that penalty on every access, invisibly, forever — unless someone tells ' +
      'the kernel to care.</p>' +
      '<pre><code>Socket 0 CPUs + local RAM  <---- interconnect (QPI/UPI/Infinity Fabric) ---->  Socket 1 CPUs + local RAM\n' +
      '     "near" memory access: ~80-100ns          "far" (cross-node) memory access: ~140-200ns+</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Two kitchens sharing one pantry that sits between them.</b> A chef ' +
      'working in Kitchen A can grab ingredients from Kitchen A\'s own shelf instantly, but if the recipe needs something stocked only in ' +
      'Kitchen B\'s shelf, someone has to walk it across — every single time that ingredient is needed. NUMA-aware tuning is making sure a ' +
      'chef\'s ingredients are stocked in the kitchen they actually work in.</p></div>',
      try: [
        ['📖 Kernel docs — NUMA memory policy', 'https://docs.kernel.org/admin-guide/mm/numa_memory_policy.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>NUMA (Non-Uniform Memory Access)</b> means each CPU socket ("node") has its own local memory controller; accessing another ' +
      'node\'s memory is slower. The kernel tries to allocate memory local to the CPU that touches it first, but scheduler migration, ' +
      'over-provisioning, or naive allocation can leave a process running on one node with memory pinned on another.</p>' +
      '<pre><code># inspect topology: nodes, CPUs per node, distances\n' +
      '$ numactl --hardware\n' +
      'available: 2 nodes (0-1)\n' +
      'node 0 cpus: 0-15 32-47\n' +
      'node 0 size: 128000 MB\n' +
      'node distances:\n' +
      'node   0   1\n' +
      '  0:  10  21\n' +
      '  1:  21  10\n\n' +
      '# run a process pinned to node 0 CPUs AND node 0 memory\n' +
      '$ numactl --cpunodebind=0 --membind=0 ./latency_sensitive_app\n\n' +
      '# check actual cross-node traffic for a running process\n' +
      '$ numastat -p &lt;pid&gt;\n' +
      '$ numastat -c &lt;pid&gt;              # compact per-node hit/miss view</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tool is <b><code>numactl</code></b> for viewing ' +
      'topology and binding CPU/memory, and <b><code>numastat</code></b> for measuring whether allocations actually landed local ' +
      '(<code>numa_hit</code>) or remote (<code>numa_foreign</code>/<code>numa_miss</code>). The kernel\'s automatic balancer is ' +
      '<b>AutoNUMA</b> (<code>numa_balancing</code> sysctl), which migrates pages toward the node that touches them most.</p></div>',
      try: [
        ['📖 man7.org — numactl(8)', 'https://man7.org/linux/man-pages/man8/numactl.8.html', 'o'],
        ['📖 man7.org — numastat(8)', 'https://man7.org/linux/man-pages/man8/numastat.8.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>New HPC node, mysterious 30% slowdown.</b> A freshly ' +
      'provisioned dual-socket compute node runs a memory-bandwidth-bound simulation 30% slower than an identical node in the same rack. ' +
      '<code>numactl --hardware</code> shows normal topology, but <code>numastat -p</code> on the running job shows heavy ' +
      '<code>numa_foreign</code> counts — the job\'s threads were scheduled across both sockets by default while its large working set ' +
      'sits on node 0. Fix: launch with <code>numactl --cpunodebind=0 --membind=0</code> (or split the job into per-node instances) so ' +
      'threads and their memory stay co-located.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The taskset-without-membind trap.</b> A team pins a ' +
      'latency-sensitive service to CPUs 0-15 (node 0) with <code>taskset</code> for cache-locality reasons, but never binds memory. ' +
      'Under memory pressure, the kernel happily allocates the process\'s heap from node 1 because node 0 is fuller — CPU pinning fixed ' +
      'half the problem and quietly made the other half worse. Fix: pair CPU affinity with an explicit memory policy ' +
      '(<code>numactl --membind</code> or <code>set_mempolicy(2)</code>), not CPU pinning alone.</p></div>' +
      '<p><b>AutoNUMA helps but is not a substitute for explicit binding</b> on latency-sensitive workloads: it migrates pages ' +
      'reactively (after observing remote-node touches), which means the first phase of a workload\'s life pays the remote-access cost ' +
      'before migration catches up.</p>',
      try: [
        ['📖 Kernel docs — NUMA memory policy', 'https://docs.kernel.org/admin-guide/mm/numa_memory_policy.html', 'o'],
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Pinning CPUs with taskset but leaving        Pair CPU affinity with an explicit memory policy (numactl\n' +
      '  memory policy unset                          --membind or set_mempolicy) so memory follows the CPUs.\n' +
      'Assuming AutoNUMA fixes all placement         AutoNUMA migrates reactively after observing remote touches --\n' +
      '  for latency-sensitive workloads               explicit binding avoids paying that warm-up cost at all.\n' +
      'Sizing a workload without checking            A workload sized larger than one node\'s local RAM forces\n' +
      '  node-local memory capacity                   cross-node spillover no matter how well threads are pinned.\n' +
      'Diagnosing "slow node" from CPU%              CPU utilization looks identical whether memory access is local\n' +
      '  alone                                         or remote -- check numastat numa_hit/numa_foreign instead.\n' +
      'Ignoring node distance asymmetry on          Distances are not always uniform (node distances table);\n' +
      '  larger multi-socket / multi-die systems      a "remote" node can be materially farther than another remote node.\n' +
      'Treating interleave as always the safe       interleave spreads allocations evenly across nodes -- good for\n' +
      '  default for a latency-sensitive service       bandwidth-bound jobs, bad for one that wants all-local access.</code></pre>' +
      '<p><b>The real test:</b> for a specific slow workload, can you show whether its memory accesses are landing local ' +
      '(<code>numa_hit</code>) or remote (<code>numa_foreign</code>/<code>numa_miss</code>) — and if remote, whether that is because of ' +
      'scheduler migration, an oversized working set, or a missing memory policy?</p>',
      try: [
        ['📖 man7.org — set_mempolicy(2)', 'https://man7.org/linux/man-pages/man2/set_mempolicy.2.html', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, NUMA tuning is about matching memory policy to workload shape: bandwidth-bound jobs that touch memory evenly ' +
      'across a large dataset often do better with <code>interleave</code> policy (spreading load across all memory controllers); ' +
      'latency-sensitive, working-set-fits-in-one-node jobs almost always do better fully bound to one node. The expert mistake is ' +
      'applying one policy fleet-wide instead of matching it to how each workload actually accesses memory.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A dual-socket box runs a job 30% slower than an identical node. numactl --hardware looks normal. What next?\n' +
      'A: Run numastat -p &lt;pid&gt; on the job. High numa_foreign/numa_miss counts indicate the job\'s threads and its\n' +
      '   memory are on different nodes -- the topology is fine, the placement is not.\n\n' +
      'Q: Why is `taskset --cpu-list 0-15` alone not enough for NUMA-aware pinning?\n' +
      'A: taskset only pins CPU affinity. Without an explicit memory policy (numactl --membind or\n' +
      '   set_mempolicy), the kernel can still allocate the process\'s memory on a different node under\n' +
      '   pressure, defeating the point of pinning.\n\n' +
      'Q: When would you choose interleave memory policy over strict node-local binding?\n' +
      'A: For bandwidth-bound workloads that touch a large dataset roughly evenly -- interleaving spreads\n' +
      '   allocations across all memory controllers to maximize aggregate bandwidth, at the cost of not being\n' +
      '   optimal for any single access.\n\n' +
      'Q: Why can AutoNUMA still leave early performance on the table for a short-lived latency-sensitive job?\n' +
      'A: AutoNUMA migrates pages reactively, after observing which node touches them most. A short-lived job\n' +
      '   may finish before migration converges, paying remote-access cost for its entire runtime.\n\n' +
      'Q: What happens if a workload\'s memory footprint is larger than one NUMA node\'s local RAM?\n' +
      'A: Even perfect CPU/memory binding cannot avoid cross-node spillover once the working set exceeds local\n' +
      '   capacity -- at that point the fix is sizing/sharding the workload across nodes, not tighter pinning.</code></pre>',
      try: [
        ['📖 Kernel docs — NUMA memory policy', 'https://docs.kernel.org/admin-guide/mm/numa_memory_policy.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A job runs 30% slower on a NUMA node than an identical node in the same rack, despite normal `numactl --hardware` output. What is the correct next diagnostic?',
      opts: [
        'Reboot the node and hope it resolves itself',
        'Run `numastat -p &lt;pid&gt;` to check whether the job\'s memory accesses are landing local (numa_hit) or remote (numa_foreign/numa_miss)',
        'Increase the CPU frequency governor to performance mode',
        'Reinstall the operating system'],
      ok: 1,
      why: 'Topology being normal does not mean placement is correct. numastat reveals whether a specific process\'s memory accesses are actually local or crossing nodes, which CPU-level metrics cannot show.' },
    { q: 'Why is pinning a process to specific CPUs with `taskset` alone insufficient for NUMA-aware performance tuning?',
      opts: [
        'taskset does not work on multi-socket systems',
        'taskset only controls CPU affinity; without an explicit memory policy (numactl --membind or set_mempolicy), the kernel can still place the process\'s memory on a remote node',
        'taskset requires root and usually fails silently',
        'taskset automatically binds memory too, so this is not actually a problem'],
      ok: 1,
      why: 'CPU affinity and memory policy are independent controls. Pinning CPUs without also pinning memory can leave a process compute-local but memory-remote, which defeats the purpose of pinning.' },
    { q: 'When is NUMA `interleave` memory policy generally the better choice over strict node-local binding?',
      opts: [
        'Always -- interleave is strictly better in every case',
        'For bandwidth-bound workloads that access a large dataset roughly evenly across memory, where spreading allocations across all memory controllers maximizes aggregate bandwidth',
        'Only for single-threaded processes',
        'Never -- interleave is deprecated in modern kernels'],
      ok: 1,
      why: 'Interleaving trades per-access optimality for aggregate bandwidth across all nodes, which suits bandwidth-bound jobs touching memory broadly. A latency-sensitive job with a node-sized working set is usually better off fully node-local.' }
  ]
};
