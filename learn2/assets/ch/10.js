/* linux-hpc-security Learn — Part 2 · Chapter 10: Interrupt Handling, IRQ Affinity & softirq Tuning */
window.CH[10] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A 64-core box has one core pinned at 100% while the other 63 sit mostly idle, and it is not running any application at all on ' +
      'that core — <code>top</code> shows it consumed almost entirely by <code>%si</code> (softirq) time. Every packet a 100GbE NIC ' +
      'receives has to interrupt some CPU to say "data is ready" — and by default, every one of those interrupts can land on the same ' +
      'core, no matter how many cores are sitting idle.</p>' +
      '<pre><code>NIC receives a packet  →  fires a hardware interrupt (IRQ)  →  CPU stops what it is doing to service it\n' +
      '                                                            →  softirq does the heavier follow-up work</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>One employee designated to answer every phone call in an office of ' +
      'sixty-four desks.</b> Even if fifty-nine phones are silent, that one employee (one CPU core) is constantly interrupted, while the ' +
      'other fifty-nine employees sit idle and available. Spreading incoming calls across multiple people (IRQ affinity / RSS) is the ' +
      'obvious fix once you notice the imbalance.</p></div>',
      try: [
        ['📖 Kernel docs — SMP IRQ affinity', 'https://docs.kernel.org/core-api/irq/irq-affinity.html', 'o'],
        ['🐧 Ch 8 — kernel bypass & userspace networking', '#ch8', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A hardware <b>IRQ</b> handler does the minimum necessary immediately (top half); the rest of the work — protocol processing, ' +
      'copying data, waking up the waiting process — runs in a deferred <b>softirq</b> context, which is what usually shows up as ' +
      '<code>%si</code> in <code>top</code>/<code>mpstat</code>. <b>RSS</b> (Receive Side Scaling) lets a multi-queue NIC distribute ' +
      'incoming packets across several hardware queues, each with its own IRQ, which can then be bound to different CPUs.</p>' +
      '<pre><code># see per-CPU interrupt counts by device -- a lopsided row means one core is doing all the work\n' +
      '$ cat /proc/interrupts | grep eth0\n\n' +
      '# check and set the CPU affinity mask for a specific IRQ (hex bitmask of allowed CPUs)\n' +
      '$ cat /proc/irq/128/smp_affinity\n' +
      '$ echo f0 > /proc/irq/128/smp_affinity        # allow CPUs 4-7 only\n\n' +
      '# spread NIC interrupts across cores automatically (distro helper, or hand-rolled)\n' +
      '$ sudo set_irq_affinity.sh eth0                 # ships with many NIC vendor driver packages\n' +
      '$ sudo systemctl status irqbalance               # daemon that does this dynamically system-wide\n\n' +
      '# per-CPU softirq breakdown (NET_RX, NET_TX, etc.)\n' +
      '$ mpstat -P ALL 1\n' +
      '$ cat /proc/softirqs</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard interface is <b><code>/proc/irq/&lt;n&gt;/smp_affinity</code></b> ' +
      '(and <code>smp_affinity_list</code> for a human-readable CPU list), managed dynamically by ' +
      '<b><code>irqbalance</code></b> or statically pinned by hand for latency-critical setups, with ' +
      '<b><code>RPS</code>/<code>RFS</code></b> (<code>/sys/class/net/*/queues/rx-*/rps_cpus</code>) as the software equivalent for ' +
      'NICs without enough hardware queues.</p></div>',
      try: [
        ['📖 Kernel docs — Scaling in the Linux Networking Stack (RSS/RPS/RFS)', 'https://docs.kernel.org/networking/scaling.html', 'o'],
        ['📖 man7.org — proc(5), /proc/interrupts', 'https://man7.org/linux/man-pages/man5/proc.5.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Pinning NIC interrupts away from a hot core.</b> A ' +
      'latency-sensitive trading or matching-engine service is pinned to CPU 0 for cache locality, but the NIC\'s default IRQ affinity ' +
      'also lands on CPU 0 — every incoming packet interrupt now competes directly with the latency-sensitive process for the same ' +
      'core. Fix: explicitly set the NIC\'s IRQ <code>smp_affinity</code> to a different CPU set than the pinned application (and ' +
      'disable <code>irqbalance</code> for that IRQ so it does not get reassigned), so interrupt handling and the latency-critical ' +
      'workload never fight over the same core.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Softirq starvation under a packet storm.</b> During a traffic ' +
      'spike, a service on the same box as a busy NIC sees dropped packets and RX-ring overruns even though CPU usage overall looks ' +
      'fine — the softirq processing for that NIC is only enabled on one or two cores, which are themselves saturated by ' +
      '<code>NET_RX</code> softirq work faster than they can drain the queue. Fix: enable <b>RSS</b> with more hardware queues (if the ' +
      'NIC supports it) or configure <b>RPS</b> to spread software-side receive processing across more cores.</p></div>' +
      '<p><b>RPS/RFS tuning on a 100GbE box</b> matters most when the NIC has fewer hardware queues than CPU cores, or when flow ' +
      'affinity to the CPU already running the consuming application (RFS) meaningfully improves cache locality for that application\'s ' +
      'socket buffers.</p>',
      try: [
        ['📖 Kernel docs — Scaling in the Linux Networking Stack', 'https://docs.kernel.org/networking/scaling.html', 'o'],
        ['🐧 Ch 3 — NUMA topology & NUMA-aware tuning', '#ch3', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Leaving irqbalance enabled fleet-wide         For latency-critical hosts, disable irqbalance (or exclude\n' +
      '  on latency-critical, pinned-CPU hosts         specific IRQs) and set smp_affinity explicitly and statically.\n' +
      'Pinning a latency-sensitive process to a      Check /proc/interrupts for that core first -- a busy NIC IRQ\n' +
      '  core without checking what else lands there   on the same core will contend directly with the pinned process.\n' +
      'Diagnosing "high CPU" without separating      %si (softirq) time is a distinct, often-overlooked category from\n' +
      '  %si from %us in top/mpstat                    %us (user) and %sy (system) -- a saturated NET_RX softirq looks\n' +
      '                                                different from an application CPU-bound problem.\n' +
      'Assuming more RX queues always helps          Beyond the number of cores actually available to service them,\n' +
      '  regardless of core count                      extra queues add cache/coordination overhead without benefit.\n' +
      'Ignoring cross-NUMA-node IRQ affinity         Binding an IRQ to a CPU on the wrong NUMA node relative to the\n' +
      '                                                NIC\'s PCIe attachment adds real cross-node memory-access cost.\n' +
      'Treating dropped packets as purely a          Check /proc/net/softnet_stat for softirq-level drops\n' +
      '  network/driver problem                         (budget exceeded, backlog full) before assuming it is a wire\n' +
      '                                                or switch issue.</code></pre>' +
      '<p><b>The real test:</b> when a box shows one hot core and dropped packets under load, can you show — via ' +
      '<code>/proc/interrupts</code>, <code>/proc/softirqs</code>, and <code>/proc/net/softnet_stat</code> — exactly which IRQ and which ' +
      'softirq category is saturating that core, rather than guessing "the network stack is slow"?</p>',
      try: [
        ['📖 man7.org — mpstat(1)', 'https://man7.org/linux/man-pages/man1/mpstat.1.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, interrupt and softirq tuning is about deliberately partitioning a box\'s cores into roles: some cores ' +
      'dedicated to interrupt/softirq handling (close to the NIC\'s NUMA node), some cores isolated for latency-sensitive application ' +
      'work that must never be interrupted by unrelated IRQs, and the rest left to <code>irqbalance</code>\'s dynamic defaults for ' +
      'general-purpose traffic. This is the same instinct as CPU isolation for real-time workloads (<code>isolcpus</code>, ' +
      '<code>nohz_full</code>) applied specifically to the interrupt path.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A 64-core box shows one core pinned at 100% %si with 63 idle cores. What is happening and how do you confirm it?\n' +
      'A: Likely all (or most) interrupts for a busy device -- typically a NIC -- are affined to that one core.\n' +
      '   Confirm with /proc/interrupts (lopsided per-CPU counts for that IRQ) and /proc/softirqs (NET_RX\n' +
      '   concentrated on the same core).\n\n' +
      'Q: Why can pinning a latency-sensitive process to a specific CPU make its latency worse, not better?\n' +
      'A: If a busy device\'s IRQ (e.g. the NIC) also lands on that same CPU, the pinned process now directly\n' +
      "   competes with interrupt/softirq handling for the core it can no longer migrate away from.\n\n" +
      'Q: Why is %si in top/mpstat a distinct category worth watching separately from %us and %sy?\n' +
      'A: %si specifically reflects softirq (deferred interrupt) processing -- high %si with low %us/%sy points\n' +
      '   at network/device-driven load, not application compute, which needs a different fix (IRQ affinity/RSS,\n' +
      '   not application profiling).\n\n' +
      'Q: When would RPS/RFS matter even on a NIC that already supports RSS with many hardware queues?\n' +
      'A: RFS specifically improves cache locality by steering a flow\'s software-side processing to the CPU\n' +
      '   already running the consuming application thread, which RSS (hardware queue assignment alone) does\n' +
      '   not guarantee.\n\n' +
      'Q: Why should IRQ affinity account for NUMA topology, not just "which CPU is idle"?\n' +
      "A: Binding a device's IRQ to a CPU on a different NUMA node than the device's PCIe attachment adds real\n" +
      '   cross-node memory-access latency for every interrupt serviced there, even if that CPU is otherwise idle.</code></pre>',
      try: [
        ['📖 Kernel docs — SMP IRQ affinity', 'https://docs.kernel.org/core-api/irq/irq-affinity.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A 64-core box shows one core pinned near 100% `%si` (softirq) time while 63 cores sit idle. What is the most likely cause?',
      opts: [
        'A memory leak in the kernel',
        'A busy device (commonly a NIC) has its interrupts affined to that single core by default, concentrating all softirq processing for it there',
        'The CPU frequency governor is set incorrectly',
        'The disk is nearly full'],
      ok: 1,
      why: 'By default, a device\'s interrupts can all land on one CPU. High, concentrated %si time on a single core with everything else idle is the classic signature of IRQ affinity not being spread across available cores.' },
    { q: 'Why can pinning a latency-sensitive process to a specific CPU sometimes make its latency worse rather than better?',
      opts: [
        'CPU pinning always disables the process\'s ability to use the network',
        'If a busy device\'s interrupt handling (e.g. a NIC\'s IRQ) is also affined to that same CPU, the pinned process now directly competes with interrupt/softirq work on a core it can no longer migrate away from',
        'Pinning automatically raises the process\'s niceness value',
        'Pinning disables the page cache for that process'],
      ok: 1,
      why: 'CPU pinning removes the scheduler\'s ability to move the process away from contention. If an unrelated device\'s interrupts land on the same pinned core, the process now competes with that IRQ/softirq load with no escape route.' },
    { q: 'Why does IRQ affinity need to account for NUMA topology rather than simply picking any idle CPU?',
      opts: [
        'NUMA topology has no effect on interrupt handling',
        'Binding a device\'s IRQ to a CPU on a different NUMA node than the device\'s PCIe attachment adds real cross-node memory-access latency for every interrupt serviced there',
        'Interrupts can only be handled by CPU 0 regardless of NUMA node',
        'NUMA-aware IRQ affinity is only relevant for storage devices, never for NICs'],
      ok: 1,
      why: 'A device is physically attached via PCIe to a specific NUMA node. Servicing its interrupts on a CPU from a different node means every interrupt-related memory access crosses the inter-node link, adding avoidable latency.' }
  ]
};
