/* linux-hpc-security Learn — Part 2 · Chapter 5: perf & eBPF Profiling in Production */
window.CH[5] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A production API server is slow, and nobody can reproduce it locally. Restarting it "fixes" it for a while, redeploying does ' +
      'not help, and the logs show nothing unusual. The answer is not in the logs — it is in what the CPU is actually doing, moment to ' +
      'moment, which you cannot see without a profiler. <b>perf</b> and <b>eBPF</b> let you look inside a live, unmodified production ' +
      'process without a reboot or a redeploy.</p>' +
      '<pre><code>Logs tell you WHAT the app reported.  A profiler tells you WHERE the CPU actually spent its time —\n' +
      'often two very different answers.</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A flight data recorder versus the pilot\'s post-flight report.</b> ' +
      'The pilot\'s report (application logs) tells you what they meant to do. The flight recorder (a profiler) shows exactly what the ' +
      'aircraft (the CPU) was doing at every second — including the parts nobody thought to mention.</p></div>',
      try: [
        ['📖 Brendan Gregg — Linux perf Examples', 'https://www.brendangregg.com/perf.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>perf</b> is the Linux kernel\'s built-in sampling profiler, using hardware performance counters and tracepoints. ' +
      '<b>eBPF</b> (via <code>bpftrace</code> or BCC) lets you attach small, safe programs directly to kernel or userspace events for ' +
      'targeted, low-overhead tracing beyond what sampling alone shows.</p>' +
      '<pre><code># sample CPU stacks system-wide for 30s at 99Hz, then render a flamegraph\n' +
      '$ perf record -F 99 -a -g -- sleep 30\n' +
      '$ perf script | stackcollapse-perf.pl | flamegraph.pl > out.svg\n\n' +
      '# quick top-down view without a full recording\n' +
      '$ perf top\n\n' +
      '# one-liner: histogram of syscall latency by syscall name, system-wide\n' +
      '$ sudo bpftrace -e \'tracepoint:raw_syscalls:sys_enter { @start[tid] = nsecs; }\n' +
      '  tracepoint:raw_syscalls:sys_exit /@start[tid]/ { @ns = hist(nsecs - @start[tid]); delete(@start[tid]); }\'\n\n' +
      '# BCC equivalent for a specific, common question: file opens by process\n' +
      '$ sudo opensnoop-bpfcc -n nginx</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard toolchain is <b><code>perf</code></b> (kernel-native, ' +
      'in <code>linux-tools</code>) for CPU/hardware-counter profiling and flamegraphs, and <b><code>bpftrace</code></b>/<b>BCC</b> ' +
      '(both eBPF frontends) for targeted, programmable tracing of syscalls, function entry/exit, and scheduler events with minimal ' +
      'overhead.</p></div>',
      try: [
        ['📖 man7.org — perf(1)', 'https://man7.org/linux/man-pages/man1/perf.1.html', 'o'],
        ['📖 bpftrace reference guide (GitHub)', 'https://github.com/bpftrace/bpftrace/blob/master/docs/reference_guide.md', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A live prod node, no redeploy allowed.</b> A checkout ' +
      'service\'s p99 latency doubled after a routine deploy, but the team cannot attach a debugger or restart it during business hours. ' +
      'Fix: <code>perf record -F 99 -p &lt;pid&gt; -g -- sleep 60</code> attaches non-invasively, sampling stacks without stopping the process; ' +
      'the resulting flamegraph shows a new, wide frame in a JSON-serialization library that was upgraded in the same deploy — a ' +
      'regression invisible in logs but obvious as extra width in the flamegraph.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Profiling a CPU regression after a kernel upgrade.</b> A batch ' +
      'pipeline runs 15% slower after a kernel minor-version bump, with no application code changes. ' +
      '<code>perf record -a -g</code> before/after the upgrade, diffed with <code>perf diff</code>, shows increased time in a spinlock ' +
      'path inside the scheduler that changed between versions — pointing the investigation at a kernel-side regression instead of ' +
      'wasting time bisecting application commits.</p></div>' +
      '<p><b>A bpftrace one-liner for syscall latency</b> answers a narrower, faster question than a full <code>perf record</code>: ' +
      '"which specific syscall is slow, and by how much" — useful when you already suspect I/O or syscall overhead and do not need a ' +
      'full stack-sampling pass.</p>',
      try: [
        ['📖 Brendan Gregg — Flame Graphs', 'https://www.brendangregg.com/flamegraphs.html', 'o'],
        ['🐧 Ch 9 — syscall tracing & auditing', '#ch9', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Redeploying or restarting a slow service     Profile the live process in place first (perf record -p &lt;pid&gt;)\n' +
      '  "to see if it fixes itself"                   -- restarting destroys the exact state you need to diagnose.\n' +
      'Reading a flamegraph\'s x-axis as time         The x-axis is alphabetically sorted stack samples, not a\n' +
      '  order                                          timeline -- width means "frequency in samples," not "when."\n' +
      'Sampling at very high frequency (e.g.        High-frequency sampling itself adds measurable overhead in\n' +
      '  10000Hz) on a production node casually        production; 99Hz (chosen to avoid aliasing with 100Hz timers)\n' +
      '                                                is a common safe default.\n' +
      'Using perf/bpftrace without symbol            Missing debug symbols or frame pointers render flamegraphs as\n' +
      '  information or frame pointers available       unreadable "[unknown]" stacks -- build with -fno-omit-frame-pointer\n' +
      '                                                or use DWARF-based unwinding.\n' +
      'Treating one flamegraph as proof of a        Compare before/after (perf diff) or against a known-good baseline\n' +
      '  regression without a baseline                 -- a wide frame alone does not prove it grew, without comparison.\n' +
      'Writing an eBPF one-liner in production      Always bound bpftrace maps and test one-liners against expected\n' +
      '  without bounding map size / rate               event rates first -- an unbounded map can itself consume memory.</code></pre>' +
      '<p><b>The real test:</b> given a flamegraph, can you distinguish "this frame is wide because it is genuinely slow per call" from ' +
      '"this frame is wide because it is called very frequently" — they look identical in a single flamegraph and require checking call ' +
      'counts separately.</p>',
      try: [
        ['📖 man7.org — perf-record(1)', 'https://man7.org/linux/man-pages/man1/perf-record.1.html', 'o'],
        ['🐧 Ch 11 — debugging production kernel panics & oopses', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, production profiling is a workflow, not a one-off command: continuous low-overhead sampling (e.g. always-on ' +
      '99Hz <code>perf</code> capture rotated to disk, or eBPF-based continuous profilers) means a regression already has a "before" ' +
      'baseline the moment someone asks "did this get slower," instead of scrambling to reproduce a transient issue after the fact. eBPF\'s ' +
      'safety verifier (bounded loops, no arbitrary memory access) is what makes it acceptable to run this kind of instrumentation on ' +
      'production kernels at all.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What does the x-axis of a flamegraph actually represent?\n' +
      'A: Alphabetically sorted stack samples aggregated by frequency, not a timeline. Frame width means "how\n' +
      '   often this stack appeared in samples," not "when it ran" or "how long a single call took."\n\n' +
      'Q: Why is perf preferred for a broad "why is this box slow" question but bpftrace preferred for a narrow one?\n' +
      'A: perf\'s statistical sampling gives a broad, unbiased view of where CPU time goes across the whole\n' +
      "   system. bpftrace's targeted event hooks answer a specific pre-formed question (e.g. \"which syscall\n" +
      '   is slow") with less overhead and more precision, but requires knowing what to ask.\n\n' +
      'Q: Why is eBPF considered safe to run on a production kernel, unlike an arbitrary kernel module?\n' +
      'A: eBPF programs pass through an in-kernel verifier that rejects unbounded loops and unchecked memory\n' +
      '   access before the program is allowed to load, bounding the worst case a buggy or malicious eBPF\n' +
      '   program can do -- a kernel module has no such gate.\n\n' +
      'Q: A flamegraph shows a wide frame in a JSON library after a deploy. How do you confirm it is a real regression?\n' +
      'A: Compare against a pre-deploy baseline (perf diff, or a saved prior flamegraph) -- a wide frame alone\n' +
      "   could mean the function is simply called more often now, not that it got slower per call.\n\n" +
      'Q: Why choose 99Hz rather than 100Hz for perf record sampling frequency?\n' +
      'A: 100Hz can alias with common 100Hz kernel timer/tick frequencies, causing systematically biased\n' +
      '   samples. An odd frequency like 99Hz avoids that lock-step aliasing.</code></pre>',
      try: [
        ['📖 Brendan Gregg — perf Examples', 'https://www.brendangregg.com/perf.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'What does the width of a frame in a CPU flamegraph actually represent?',
      opts: [
        'The wall-clock time between when that function started and ended',
        'How frequently that stack frame appeared across the aggregated, alphabetically-sorted samples -- not a timeline position',
        'The exact number of CPU cycles consumed by that single function call',
        'The order in which functions were called during the profiling window'],
      ok: 1,
      why: 'A flamegraph\'s x-axis is not time -- it is alphabetically sorted, sample-aggregated stacks. Width reflects sampling frequency (how often that stack showed up), which can mean "called often" as easily as "slow per call."' },
    { q: 'Why is eBPF considered safe to load and run on a production kernel for live tracing?',
      opts: [
        'eBPF programs run in userspace only and never touch the kernel',
        'eBPF programs are checked by an in-kernel verifier that rejects unbounded loops and unsafe memory access before the program is allowed to load',
        'eBPF programs require a full kernel recompile, which acts as a safety check',
        'eBPF has no access to kernel data structures, so it cannot cause harm'],
      ok: 1,
      why: 'The eBPF verifier statically analyzes a program before load, rejecting constructs that could hang or crash the kernel (unbounded loops, unchecked pointer arithmetic), which is what makes it acceptable for production tracing.' },
    { q: 'A flamegraph taken right after a deploy shows a wide new frame in a JSON-serialization library. What is needed to confirm this is a genuine performance regression?',
      opts: [
        'Nothing further -- a wide frame on its own always proves a regression',
        'A comparison against a pre-deploy baseline (e.g. `perf diff` or a saved earlier flamegraph), since a wide frame can also mean the function is simply called more often, not slower per call',
        'Restarting the service to see if the frame disappears',
        'Increasing the sampling frequency to 10000Hz to get more detail'],
      ok: 1,
      why: 'Flamegraph width reflects sample frequency, which conflates "slower per call" with "called more often." Only a before/after comparison can distinguish an actual regression from a legitimate increase in call volume.' }
  ]
};
