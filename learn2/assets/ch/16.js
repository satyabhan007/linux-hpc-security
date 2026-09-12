/* linux-hpc-security Learn — Part 2 · Chapter 16: Reference Architecture — The Kernel Performance Platform */
window.CH[16] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Fifteen chapters covered fifteen separate mechanisms: the scheduler, memory management, NUMA, cgroups, perf/eBPF, the block ' +
      'layer, huge pages, kernel bypass, syscall tracing, IRQ tuning, kernel panics, live patching, sysctl, and container isolation. A ' +
      'platform team does not get to reach for one at a time — every production host runs all of them simultaneously, all the time. This ' +
      'chapter is the one diagram: how they fit together as a single, coherent kernel-tuning platform.</p>' +
      '<pre><code>Fifteen chapters of individual mechanisms  →  one platform: consistent, versioned, observable,\n' +
      '                                               applied by workload class, fleet-wide</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Learning individual instruments versus conducting an ' +
      'orchestra.</b> Knowing how a violin, a trumpet, and a drum each work is necessary but not sufficient to produce a symphony. The ' +
      'reference architecture is the score that says which instruments play when, together, so the whole system performs as one thing ' +
      'instead of fifteen isolated demos.</p></div>',
      try: [
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o'],
        ['🐧 Ch 13 — sysctl tuning at fleet scale', '#ch13', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The platform has four layers, each built in earlier chapters: <b>1) Workload classification</b> (latency-sensitive vs ' +
      'batch/throughput vs untrusted — decides which knobs apply); <b>2) Enforcement</b> (cgroups v2, CPU/memory/IO limits, NUMA ' +
      'binding, IRQ affinity, container isolation level); <b>3) Observability</b> (continuous perf/eBPF profiling, ' +
      '<code>/proc/schedstat</code>, <code>numastat</code>, <code>cpu.stat</code>, kdump); <b>4) Configuration-as-code</b> (versioned ' +
      'sysctl baselines, cgroup templates, kpatch/upgrade rollout process with canary gates).</p>' +
      '<pre><code># the platform expressed as a per-workload-class checklist, applied via config management\n' +
      'latency-sensitive class:   cpu.weight high, memory.high set, THP=madvise, NUMA membind,\n' +
      '                           IRQs kept off pinned cores, real-time class NOT used by default\n' +
      'batch/throughput class:    cpu.max quota, nice 19 or low cpu.weight, THP=always OK,\n' +
      '                           NUMA interleave for bandwidth-bound jobs\n' +
      'untrusted class:           gVisor/Kata runtime, tight cgroup limits, pids.max set, seccomp profile\n\n' +
      '# every class shares: continuous perf profiling, kdump enabled, sysctl baseline from version control\n' +
      '$ sysctl --system && kpatch list && systemctl status kdump perf-continuous.service</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern is treating every mechanism from Ch 1-14 as ' +
      '<b>config, not tribal knowledge</b> — expressed once per workload class, applied via the same config-management pipeline ' +
      '(<b>Ansible/Puppet/Salt</b>) that deploys the applications themselves, with the same code review, canary, and rollback ' +
      'discipline.</p></div>',
      try: [
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o'],
        ['🐧 Ch 3 — NUMA topology & NUMA-aware tuning', '#ch3', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Designing your org\'s kernel-tuning platform.</b> A platform ' +
      'team inherits a fleet where every host has slightly different, undocumented tuning accumulated over years — some hosts have THP ' +
      'disabled for reasons nobody remembers, some have cgroup limits copy-pasted from an old template, some have neither. Fix: classify ' +
      'every workload into the small number of classes that actually matter (latency-sensitive, batch, untrusted — Ch 4, 7, 14), define ' +
      'one versioned config per class (Ch 13), and migrate hosts onto the matching class\'s config via canaried rollout — replacing ' +
      '"undocumented snowflakes" with "one of three known-good, tested profiles."</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The "walk me through your kernel tuning" interview question.</b> ' +
      'The strong answer is not a list of sysctls memorized from a blog post — it is the shape from this chapter: how workloads get ' +
      'classified, what enforces the classification (cgroups, NUMA, IRQ affinity), how you would know if it stopped working ' +
      '(observability — Ch 5, 9, 11), and how a change gets from "idea" to "fleet-wide" safely (Ch 13\'s canary-and-baseline discipline, ' +
      'Ch 15\'s incident-response shape).</p></div>' +
      '<p><b>An RFC for a performance-engineering platform</b> should explicitly name which of the fifteen mechanisms apply to which ' +
      'workload class, why, and what the fallback is when a mechanism (e.g. live patching, Ch 12) does not apply to a given fix — the ' +
      'RFC is the score; the individual chapters are the instruments.</p>',
      try: [
        ['🐧 Ch 14 — container vs VM kernel isolation tradeoffs', '#ch14', 'o'],
        ['🐧 Ch 15 — case study: diagnosing a fleet-wide latency regression', '#ch15', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Applying kernel tuning mechanisms            Classify workloads first (latency/batch/untrusted), then apply\n' +
      '  one-off, per-incident, per-host              the matching versioned profile fleet-wide -- not per-incident.\n' +
      'Treating observability (Ch 5, 9, 11) as       Continuous profiling and kdump must be ALWAYS ON before an\n' +
      '  something to add only after an incident       incident, or the next regression has no baseline to diff against.\n' +
      'Rolling out kernel upgrades and cgroup        Both need the same canary + automated comparison discipline\n' +
      '  changes with less rigor than app deploys       (Ch 13, Ch 15) -- a kernel-level regression is just as costly.\n' +
      'Building fifteen separate one-off scripts     Express workload-class configs as one set of versioned templates\n' +
      '  for scheduler/cgroup/NUMA/sysctl tuning        consumed by config management, not fifteen disconnected tools.\n' +
      'Assuming one isolation/tuning profile fits    Untrusted, latency-sensitive, and batch workloads have\n' +
      '  every workload on the fleet                    genuinely different correct answers (Ch 3, 4, 7, 14) --\n' +
      '                                                a single fleet-wide default under-serves at least one of them.\n' +
      'Treating this platform as "done" once          Kernel defaults, distro recommendations, and workload profiles\n' +
      '  built, with no periodic re-validation           change over time -- re-validate the platform against reality.</code></pre>' +
      '<p><b>The real test:</b> handed a new workload tomorrow, can your platform answer "which class does this belong to, and what ' +
      'configuration does it get" in minutes from existing, versioned templates — or does it require a bespoke tuning investigation from ' +
      'scratch, repeating work Ch 1-14 already solved?</p>',
      try: [
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o'],
        ['🐧 Ch 11 — debugging production kernel panics & oopses', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, the reference architecture\'s real deliverable is not any single mechanism — it is the organizational habit ' +
      'of treating kernel-level behavior with the same engineering rigor as application code: versioned, tested, observable, ' +
      'canary-rolled, and continuously re-validated. Every chapter in this part is a tool; this chapter is the argument for why those ' +
      'tools must be assembled into one governed system rather than deployed ad hoc by whoever is on call when a problem appears.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Design a kernel-tuning platform for a fleet running latency-sensitive, batch, and untrusted workloads. Where do you start?\n' +
      'A: Start with workload classification -- it determines everything downstream: which cgroup/NUMA/IRQ profile\n' +
      '   applies (Ch 3, 4, 10), which isolation level is needed (Ch 14), and which sysctl baseline (Ch 13) to use.\n' +
      '   Enforcement and observability are built per class, not per host.\n\n' +
      'Q: Why must observability (continuous profiling, kdump) be always-on rather than added reactively after an incident?\n' +
      "A: Diagnosing a regression requires a \"before\" baseline (Ch 15's case study) -- without continuous\n" +
      '   profiling and always-enabled kdump, the next incident starts from zero instead of from a comparison.\n\n' +
      'Q: Why should kernel/cgroup/sysctl changes go through the same rigor (canary, version control, rollback) as application deploys?\n' +
      'A: A bad kernel-level change (a scheduler regression, a wrong cgroup limit, a bad sysctl) can cause an\n' +
      '   outage exactly as costly as a bad application deploy, and often affects every workload on a host at once --\n' +
      '   it deserves at least the same process discipline.\n\n' +
      'Q: Why is "one tuning profile for the whole fleet" usually wrong?\n' +
      'A: Latency-sensitive, batch, and untrusted workloads have genuinely different correct answers for THP,\n' +
      '   NUMA policy, cgroup limits, and isolation level (Ch 3, 4, 7, 14) -- a single default necessarily\n' +
      '   under-serves at least one class.\n\n' +
      'Q: How do you know this platform is still correct six months from now?\n' +
      'A: Periodic re-validation: kernel defaults change across upgrades, workload profiles drift, and distro\n' +
      '   recommendations evolve -- treat the platform\'s configuration and assumptions as living, re-tested\n' +
      '   artifacts, not a one-time setup.</code></pre>',
      try: [
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o'],
        ['⚙️ Part 3 — HPC cluster orchestration at scale', '../learn3/', 'o']
      ] }
  ],

  quiz: [
    { q: 'When designing a kernel-tuning platform for a fleet with multiple workload types, what should the design process start with?',
      opts: [
        'Picking the single sysctl baseline that will apply uniformly to every host',
        'Classifying workloads (e.g. latency-sensitive, batch/throughput, untrusted) first, since that classification determines which cgroup, NUMA, IRQ-affinity, and isolation profile actually applies',
        'Disabling all kernel tuning to avoid the risk of misconfiguration',
        'Choosing the fastest available hardware and skipping software-level tuning entirely'],
      ok: 1,
      why: 'Workload classification is the foundation the rest of the platform depends on -- each class has a genuinely different correct answer for isolation, resource limits, and memory/NUMA policy, so enforcement and observability should be built per class.' },
    { q: 'Why must continuous profiling and always-on kdump be part of the platform BEFORE an incident occurs, not added reactively afterward?',
      opts: [
        'They are optional nice-to-haves with no real diagnostic value',
        'Diagnosing a regression or panic requires a pre-existing "before" baseline or captured crash state -- without it already running, the next incident has no comparison point and starts the investigation from zero',
        'Continuous profiling automatically fixes any regression it detects',
        'kdump and profiling are required only for regulatory compliance, not diagnosis'],
      ok: 1,
      why: 'As the fleet-wide latency regression case study showed, a diff against a pre-existing baseline is what makes root-causing fast. Enabling observability only after a problem appears means there is nothing to compare against.' },
    { q: 'Why should kernel-level changes (scheduler tuning, cgroup limits, sysctl values) go through the same canary and version-control discipline as application code deploys?',
      opts: [
        'Kernel-level changes are inherently safer than application changes and need less scrutiny',
        'A bad kernel-level change can cause an outage as costly as a bad application deploy, and because it often affects the shared kernel it can impact every workload on a host simultaneously',
        'Kernel changes cannot be version controlled due to technical limitations',
        'This discipline is only needed for containers, not for kernel-level configuration'],
      ok: 1,
      why: 'Kernel/cgroup/sysctl misconfigurations affect the shared substrate every workload on a host depends on, making their blast radius at least as large as an application bug -- they warrant the same rigor: versioning, canarying, and rollback capability.' }
  ]
};
