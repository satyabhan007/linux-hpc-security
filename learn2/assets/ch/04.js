/* linux-hpc-security Learn — Part 2 · Chapter 4: cgroups v2 & Resource Control at Scale */
window.CH[4] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>You run three containers on one host and tell each "you get 2 CPUs and 4GB RAM." Without something enforcing that promise, ' +
      'it is just a comment in a YAML file — any container can burst past its share and starve its neighbors. <b>cgroups</b> (control ' +
      'groups) are the kernel mechanism that turns "this gets 2 cores and 4GB, no more" into something the kernel actually polices, and ' +
      'they are the plumbing underneath every container runtime (Docker, containerd, Kubernetes).</p>' +
      '<pre><code>Without cgroups: "2 CPUs, 4GB" is a suggestion in a config file\n' +
      'With cgroups:    "2 CPUs, 4GB" is enforced by the kernel scheduler and memory subsystem, per process group</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Apartment sub-metering instead of one shared building bill.</b> ' +
      'Without meters, one tenant\'s space heater running all winter drives everyone\'s costs up. cgroups put a meter (and a hard cap) on ' +
      'each tenant\'s (process group\'s) actual resource use, so one noisy neighbor cannot silently degrade everyone else.</p></div>',
      try: [
        ['📖 Kernel docs — Control Group v2', 'https://docs.kernel.org/admin-guide/cgroup-v2.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>cgroups v2</b> uses a single unified hierarchy (unlike v1\'s per-controller trees) mounted at ' +
      '<code>/sys/fs/cgroup</code>. Each cgroup directory exposes controller files — <code>cpu.max</code>, <code>memory.max</code>, ' +
      '<code>memory.high</code>, <code>io.max</code> — that you write limits into, and the kernel enforces them for every process placed ' +
      'in that cgroup (via <code>cgroup.procs</code>).</p>' +
      '<pre><code># create a cgroup and check which controllers are available/enabled\n' +
      '$ cat /sys/fs/cgroup/cgroup.controllers\n' +
      'cpuset cpu io memory pids\n' +
      '$ mkdir /sys/fs/cgroup/batch-jobs\n' +
      '$ echo "+cpu +memory" > /sys/fs/cgroup/cgroup.subtree_control\n\n' +
      '# limit to 2 CPUs (200ms quota per 100ms period) and 4GB, soft-throttle at 3.5GB\n' +
      '$ echo "200000 100000" > /sys/fs/cgroup/batch-jobs/cpu.max\n' +
      '$ echo "3758096384" > /sys/fs/cgroup/batch-jobs/memory.high\n' +
      '$ echo "4294967296" > /sys/fs/cgroup/batch-jobs/memory.max\n\n' +
      '# add a running process, and inspect current usage/throttling\n' +
      '$ echo &lt;pid&gt; > /sys/fs/cgroup/batch-jobs/cgroup.procs\n' +
      '$ cat /sys/fs/cgroup/batch-jobs/cpu.stat        # nr_throttled, throttled_usec\n' +
      '$ cat /sys/fs/cgroup/batch-jobs/memory.current\n\n' +
      '# or use the higher-level wrapper instead of hand-writing files\n' +
      '$ systemd-run --scope -p CPUQuota=200% -p MemoryMax=4G ./batch_job.sh\n' +
      '$ cgcreate -g cpu,memory:/batch-jobs   # libcgroup equivalent of the mkdir above</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard interface is the raw <b><code>cgroupfs</code></b> ' +
      'controller files, wrapped by higher-level tools: <b><code>systemd-run</code></b>/<code>systemctl set-property</code> for ' +
      'systemd-managed services, and <b><code>libcgroup</code></b>\'s <b><code>cgcreate</code>/<code>cgset</code></b> for standalone use. ' +
      'Container runtimes (runc, containerd) create and manage cgroups the same way under the hood.</p></div>',
      try: [
        ['📖 Kernel docs — Control Group v2', 'https://docs.kernel.org/admin-guide/cgroup-v2.html', 'o'],
        ['📖 man7.org — cgroups(7)', 'https://man7.org/linux/man-pages/man7/cgroups.7.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The cpu.max throttling mystery.</b> A service set to ' +
      '<code>cpu.max = "50000 100000"</code> (0.5 CPU) shows fine average CPU usage but intermittent request-latency spikes. ' +
      '<code>cpu.stat</code> shows a climbing <code>nr_throttled</code> counter: the service bursts to use its full quota in the first ' +
      'few milliseconds of each 100ms period, then gets throttled for the remainder — average usage looks low, but the request that ' +
      'landed during the throttled window pays the full penalty. Fix: raise the quota, widen the period ' +
      '(<code>cpu.max</code> accepts a longer period for less granular throttling), or move to CPU shares/weight if the workload can ' +
      'tolerate softer limits.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>memory.high vs memory.max on a multi-tenant node.</b> A team ' +
      'sets only <code>memory.max</code> ("hard cap, OOM-kill on breach") and is surprised when a memory spike kills their service ' +
      'outright instead of degrading gracefully. Fix: set <code>memory.high</code> below <code>memory.max</code> — crossing ' +
      '<code>memory.high</code> throttles the cgroup and forces aggressive reclaim (slower, but alive), while <code>memory.max</code> ' +
      'remains the last-resort hard kill boundary, giving the workload a chance to shed load before it is terminated.</p></div>' +
      '<p><b>The cgroups v1 → v2 migration</b> is mostly about the hierarchy: v1 let different controllers (cpu, memory, blkio) be ' +
      'mounted in independent trees with independent process groupings, which made cross-controller reasoning ("what is this container\'s ' +
      'total footprint") hard. v2\'s single unified tree makes "one cgroup, all controllers, one process membership" the norm.</p>',
      try: [
        ['📖 Kernel docs — Control Group v2, memory controller', 'https://docs.kernel.org/admin-guide/cgroup-v2.html#memory-interface-files', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Setting only memory.max ("hard cap")         Set memory.high below memory.max so the cgroup is throttled and\n' +
      '  with no memory.high                          forced to reclaim before hitting the hard OOM-kill boundary.\n' +
      'Diagnosing throttling from average CPU%      Check cpu.stat nr_throttled/throttled_usec -- a service can\n' +
      '  alone                                         throttle hard within a period while averaging low overall CPU%.\n' +
      'Setting a very short cpu.max period for      A short period with a proportionally small quota causes frequent\n' +
      '  a bursty workload                             burst-then-throttle cycles; a longer period smooths bursts out.\n' +
      'Mixing v1 and v2 controller mounts           Pick one hierarchy consistently -- mixed mounts make "what limits\n' +
      '  "temporarily" during migration                actually apply to this process" require checking two trees.\n' +
      'Assuming container runtime defaults are      Defaults (e.g. unset memory.high, generous CPU shares) are often\n' +
      '  already tuned for your workload               tuned for compatibility, not for a specific latency/throughput goal.\n' +
      'Granting pids controller limits an           Without pids.max, a fork bomb inside one cgroup can exhaust\n' +
      '  afterthought                                  system-wide PID space and affect unrelated cgroups.</code></pre>' +
      '<p><b>The real test:</b> for a throttled or OOM-killed workload, can you point at the exact controller file ' +
      '(<code>cpu.stat</code>, <code>memory.events</code>) that shows what actually happened, instead of inferring it from application ' +
      'logs alone?</p>',
      try: [
        ['📖 man7.org — cgroups(7)', 'https://man7.org/linux/man-pages/man7/cgroups.7.html', 'o'],
        ['🐧 Ch 2 — memory management internals', '#ch2', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, cgroups v2 is the enforcement layer for a broader resource-governance policy: CPU weight/quota, memory.high ' +
      '(soft) vs memory.max (hard), io.max, and pids.max together define a workload\'s actual contract with the host, independent of ' +
      'what a scheduler manifest claims. Expert practice treats cgroup limits as first-class, tested configuration — verified against ' +
      '<code>cpu.stat</code>/<code>memory.events</code> in staging under realistic load — rather than values copied from a template and ' +
      'never revisited.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A service has low average CPU usage but intermittent latency spikes under a cpu.max quota. Why?\n' +
      'A: The service likely bursts to consume its full quota early in each accounting period, then gets\n' +
      '   throttled for the rest of it -- check cpu.stat nr_throttled/throttled_usec. Average CPU% hides\n' +
      '   this because it is measured over the whole period, not the burst window.\n\n' +
      'Q: What is the difference between memory.high and memory.max?\n' +
      'A: memory.high is a soft limit -- crossing it triggers throttling and aggressive reclaim but does not\n' +
      '   kill the process. memory.max is the hard limit -- crossing it invokes the OOM killer within that\n' +
      '   cgroup. Setting memory.high below memory.max gives a workload a chance to shed load before death.\n\n' +
      'Q: Why did cgroups v2 move to a single unified hierarchy instead of v1\'s per-controller trees?\n' +
      'A: v1 allowed different controllers to have independent process groupings across separate trees, making\n' +
      '   it hard to answer "what is this process\'s total resource footprint." v2\'s single tree ties one\n' +
      '   process membership to all controllers at once.\n\n' +
      'Q: Why is pids.max an important, often-overlooked control?\n' +
      'A: Without it, a fork bomb or runaway thread-spawning bug inside one cgroup can exhaust system-wide PID\n' +
      '   space, affecting unrelated cgroups on the same host -- it is a blast-radius control, not just a limit.\n\n' +
      'Q: How would you verify a cgroup CPU limit is actually appropriate before rolling it out fleet-wide?\n' +
      'A: Load-test the workload under the proposed cpu.max/weight in staging and watch cpu.stat for\n' +
      '   throttling; a limit that looks reasonable on paper can still cause tail-latency throttling under\n' +
      '   real burst patterns.</code></pre>',
      try: [
        ['📖 Kernel docs — Control Group v2', 'https://docs.kernel.org/admin-guide/cgroup-v2.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A service under a `cpu.max` quota shows low average CPU utilization but intermittent latency spikes. What should you check first?',
      opts: [
        'The service\'s application logs only',
        '`cpu.stat` inside the cgroup for nr_throttled/throttled_usec -- the service may be bursting to its full quota early in each period and getting throttled for the rest',
        'Whether the disk is full',
        'The DNS resolution time for the service'],
      ok: 1,
      why: 'Average CPU% is measured over the whole accounting period and hides a burst-then-throttle pattern within it. cpu.stat directly shows throttling events that correlate with the observed latency spikes.' },
    { q: 'What is the key functional difference between `memory.high` and `memory.max` in a cgroups v2 memory controller?',
      opts: [
        'They are aliases for the same limit',
        'memory.high is a soft limit that triggers throttling and reclaim pressure; memory.max is the hard limit that triggers an OOM kill within the cgroup when crossed',
        'memory.high only applies to swap, memory.max only applies to RAM',
        'memory.max is deprecated in favor of memory.high'],
      ok: 1,
      why: 'memory.high lets a cgroup degrade gracefully under pressure (throttle + reclaim) before ever reaching memory.max, which is the hard boundary that invokes the OOM killer.' },
    { q: 'Why does cgroups v2 use a single unified hierarchy instead of v1\'s independent per-controller trees?',
      opts: [
        'To make cgroups v2 backward-incompatible on purpose',
        'So that one process membership applies consistently across all controllers, making it possible to reason about a process group\'s total resource footprint in one place',
        'Because v1 controllers were removed from the kernel entirely',
        'To reduce the number of cgroup controllers available'],
      ok: 1,
      why: 'v1\'s independent trees let a process belong to different groupings per controller, which made total-footprint reasoning hard. v2\'s unified hierarchy ties one process membership to every controller at once.' }
  ]
};
