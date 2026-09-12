/* linux-hpc-security Learn — Part 2 · Chapter 1: Process Scheduler Internals: CFS, EEVDF & Runqueues */
window.CH[1] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>You launch two processes on an idle box and both feel instant. You launch two hundred on a loaded 8-core box and some feel ' +
      'sluggish while others race ahead — even though nobody set a priority. The Linux <b>scheduler</b> is the referee deciding, thousands ' +
      'of times per second, which of the runnable processes actually gets a core right now.</p>' +
      '<pre><code>200 runnable processes, 8 cores  →  someone has to pick which 8 run this instant,\n' +
      '                                     and how long each gets before the next pick</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A single till with a long line, and a manager who does not use ' +
      'first-come-first-served.</b> The manager (the scheduler) glances at how long each customer has already waited and how much service ' +
      'they still need, and picks who goes next so nobody waits forever and nobody hogs the till — without anyone explicitly announcing an order.</p></div>',
      try: [
        ['📖 Linux kernel docs — CFS scheduler', 'https://docs.kernel.org/scheduler/sched-design-CFS.html', 'o'],
        ['⚙️ Part 1: processes & the boot path', '../learn/#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The default scheduling class for ordinary processes is the <b>Completely Fair Scheduler (CFS)</b> — replaced by <b>EEVDF</b> ' +
      '(Earliest Eligible Virtual Deadline First) as the default in kernel 6.6+. Both track a per-task <code>vruntime</code> (virtual ' +
      'runtime): a task that has run less gets picked next, so CPU time converges toward equal shares weighted by <code>nice</code>:</p>' +
      '<pre><code># see which scheduling class and priority a process has\n' +
      '$ chrt -p 1234\n' +
      "pid 1234's current scheduling policy: SCHED_OTHER\n" +
      "pid 1234's current scheduling priority: 0\n\n" +
      '# nice adjusts the WEIGHT applied to vruntime accounting, not a fixed time slice\n' +
      '$ nice -n 10 ./batch_job.sh        # lower priority: vruntime accrues faster, so it is picked less often\n' +
      '$ nice -n -5 ./latency_sensitive   # higher priority (needs CAP_SYS_NICE below 0)\n\n' +
      '# runqueue state per CPU\n' +
      '$ cat /proc/schedstat | head -3\n' +
      '$ cat /sys/kernel/debug/sched/debug   # per-CPU runqueue dump (root, debugfs)</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The kernel exposes scheduling policy through <b><code>chrt</code></b> ' +
      '(view/set SCHED_OTHER, SCHED_FIFO, SCHED_RR, SCHED_DEADLINE) and priority through <b><code>nice</code>/<code>renice</code></b>. For ' +
      'real-time or latency-critical workloads, <code>SCHED_FIFO</code>/<code>SCHED_RR</code> bypass fairness entirely — the process runs ' +
      'until it blocks or a higher-priority real-time task preempts it, which is exactly why misusing them can starve the rest of the box.</p></div>',
      try: [
        ['📖 man7.org — sched(7)', 'https://man7.org/linux/man-pages/man7/sched.7.html', 'o'],
        ['📖 LWN — the EEVDF scheduler', 'https://lwn.net/Articles/925371/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The "one core pegged, seven idle" ticket.</b> A latency-sensitive ' +
      'service pins itself to CPU 0 with <code>taskset</code> for "consistency", then a burst of interrupt-heavy traffic arrives — CPU 0 is now ' +
      'saturated with both the service and softirq work while cores 1-7 sit idle, because nothing else is scheduled to run there and the ' +
      'pinned process cannot migrate. Fix: either widen the CPU affinity mask so the scheduler can load-balance across a small set of cores, ' +
      'or move IRQ handling off the pinned core (see Ch 10) so pinning does not fight interrupt load.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The batch job that stalled everything else.</b> A nightly reporting ' +
      'job runs at default niceness alongside a latency-sensitive API on the same box. Under CFS/EEVDF this is technically "fair" — but fair ' +
      'CPU-time-sharing still means the API\'s runs get interleaved with the batch job\'s, adding scheduling latency the API\'s SLO cannot ' +
      'absorb. Fix: <code>nice -n 19</code> the batch job (or move it into a low-priority cgroup, Ch 4) so it only consumes truly idle CPU, ' +
      'and reserve near-zero niceness for the latency-sensitive path.</p></div>' +
      '<p><b>Runqueues are per-CPU, not global:</b> each CPU has its own runqueue, and the scheduler periodically load-balances tasks across ' +
      'them (and across NUMA nodes — see Ch 3). A task can migrate CPUs between runs, which is usually fine but resets cache locality.</p>',
      try: [
        ['📖 Kernel docs — CFS scheduler design', 'https://docs.kernel.org/scheduler/sched-design-CFS.html', 'o'],
        ['🐧 Ch 3 — NUMA topology & NUMA-aware tuning', '#ch3', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                            FIX\n' +
      'Pinning every service to a fixed core     Pin only when you have measured a real cache-locality or jitter\n' +
      '  "for consistency"                        win; otherwise let the scheduler load-balance across a range.\n' +
      'Running batch jobs at default niceness     nice/renice batch work down (or cgroup it, Ch 4) so it only\n' +
      '  next to latency-sensitive services        eats CPU the latency-sensitive path is not using.\n' +
      'Reaching for SCHED_FIFO/SCHED_RR for        Real-time classes bypass fairness — a runaway SCHED_FIFO task\n' +
      '  "important" but not truly real-time work  can starve the entire box, including the kernel\'s own threads.\n' +
      'Diagnosing "slow" purely from CPU%           A core can show 60% busy and still have high scheduling\n' +
      '  without looking at run-queue latency       latency if the runqueue is long — check /proc/schedstat too.\n' +
      'Ignoring CPU migration cost                 Frequent cross-core (and especially cross-NUMA-node) migration\n' +
      '                                             cools caches and adds latency; affinity hints can reduce it.\n' +
      'Treating nice as a hard priority              nice adjusts a WEIGHT in vruntime accounting, not a\n' +
      '                                             guaranteed time slice — under EEVDF/CFS it is still fair-ish.</code></pre>' +
      '<p><b>The real test:</b> can you explain, for a specific slow request, whether the process was ever runnable-but-waiting (a scheduler ' +
      'problem) versus actually running-but-slow (a different problem)? <code>/proc/schedstat</code> and <code>perf sched latency</code> ' +
      'answer that question; CPU utilization alone does not.</p>',
      try: [
        ['📖 man7.org — taskset(1)', 'https://man7.org/linux/man-pages/man1/taskset.1.html', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, scheduler tuning is a <b>latency-vs-throughput tradeoff</b> problem: CFS/EEVDF optimize for fair long-run CPU ' +
      'share, which is the right goal for a shared fleet but not automatically the right goal for one latency-critical request path. Expert ' +
      'practice is to keep the default (fair, self-balancing) scheduler for the fleet, and apply targeted exceptions — niceness, cgroup CPU ' +
      'weight, or (rarely) a real-time class — only where you have measured, not assumed, a scheduling-latency problem.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What does `nice` actually change under CFS/EEVDF?\n' +
      "A: It changes the task's WEIGHT in vruntime accounting — a lower-priority (higher nice value) task's\n" +
      '   vruntime accrues faster per unit of wall-clock CPU time, so it is picked less often relative to\n' +
      '   others. It is not a fixed time-slice guarantee.\n\n' +
      'Q: Two tasks on an 8-core box; CPU utilization shows 60% overall but the API is slow. What do you check?\n' +
      'A: Per-CPU runqueue length and scheduling latency (/proc/schedstat, `perf sched latency`), not just\n' +
      "   aggregate CPU%. A task can be runnable-but-waiting on a hot core while other cores sit idle if\n" +
      '   affinity or load-balancing is preventing migration.\n\n' +
      'Q: Why is SCHED_FIFO dangerous for "important but not truly real-time" work?\n' +
      'A: SCHED_FIFO/SCHED_RR bypass the fairness model entirely — the task runs until it blocks or is\n' +
      '   preempted by an equal-or-higher-priority real-time task. A runaway or buggy SCHED_FIFO task can\n' +
      '   starve everything else on the CPU, including kernel housekeeping threads.\n\n' +
      'Q: Why does frequent cross-core migration hurt performance even though CPUs are otherwise fair?\n' +
      'A: Migration cools per-core caches (L1/L2, and TLB) and, if it crosses a NUMA node, adds real memory-\n' +
      "   access latency — the task keeps its fair CPU share but each run costs more due to cold caches.\n\n" +
      'Q: When would you actually pin a process to a CPU set?\n' +
      'A: After measuring a specific cache-locality or jitter problem the scheduler\'s load-balancer is causing —\n' +
      "   not by default. Pinning trades the scheduler's flexibility for predictability in a narrow case.</code></pre>",
      try: [
        ['📖 LWN — the EEVDF scheduler', 'https://lwn.net/Articles/925371/', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Under CFS/EEVDF, what does raising a process\'s niceness (e.g. `nice -n 19`) actually do?',
      opts: [
        'It guarantees the process a fixed, smaller time slice every scheduling cycle',
        'It increases the weight applied so the process\'s vruntime accrues faster per unit of CPU time, making it picked less often relative to others',
        'It moves the process to a different CPU core permanently',
        'It disables the process from running until the system is idle'],
      ok: 1,
      why: 'nice/renice adjust a weight in the vruntime fairness calculation, not a hard time-slice guarantee — the scheduler remains a fairness-based scheduler either way.' },
    { q: 'A box shows 60% aggregate CPU utilization but a specific service feels slow. What is the correct next diagnostic step?',
      opts: [
        'Assume the service has a code-level bug since CPU is not saturated',
        'Check per-CPU runqueue length and scheduling latency (e.g. /proc/schedstat, `perf sched latency`) — the service may be runnable-but-waiting on a hot core',
        'Immediately switch the service to SCHED_FIFO',
        'Reboot the box'],
      ok: 1,
      why: 'Aggregate CPU utilization hides per-CPU imbalance. A task can be ready to run but stuck waiting on an overloaded runqueue while other cores are idle — schedstat/perf reveal that, utilization alone does not.' },
    { q: 'Why is using SCHED_FIFO for "important but not truly real-time" application work risky?',
      opts: [
        'SCHED_FIFO tasks automatically get killed after 60 seconds',
        'SCHED_FIFO bypasses the fairness model — the task runs until it blocks or a higher/equal-priority real-time task preempts it, so a runaway task can starve the entire CPU including kernel threads',
        'SCHED_FIFO tasks cannot use more than one CPU core',
        'SCHED_FIFO is only available in containers, not on bare metal'],
      ok: 1,
      why: 'Real-time scheduling classes intentionally skip the fair-share model. That is correct for genuinely real-time work, but for ordinary "important" work it removes a safety net and can starve the rest of the system.' }
  ]
};
