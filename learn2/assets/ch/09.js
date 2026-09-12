/* linux-hpc-security Learn — Part 2 · Chapter 9: Syscall Tracing & Auditing */
window.CH[9] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A production process hangs — not crashed, not exited, just stuck. Its logs stopped mid-request with no error. Before ' +
      'assuming a code bug, the fastest question to answer is: what is it actually asking the kernel to do right now, and is the kernel ' +
      'answering? Every file read, network call, lock, and sleep a process performs goes through a <b>syscall</b> — and you can watch ' +
      'that boundary directly, without touching the application\'s code.</p>' +
      '<pre><code>Your app calls read()  →  crosses into the kernel  →  kernel does the work  →  returns a result\n' +
      '                         ^^^ this exact boundary is where strace/ftrace/eBPF can watch, unmodified</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A security camera at a building\'s front desk, not inside every ' +
      'office.</b> You cannot see everything an employee (your process) does at their desk, but you can see every time they walk up to ' +
      'the front desk (a syscall) and ask reception (the kernel) for something — which is often exactly the information you need to see ' +
      'where they got stuck.</p></div>',
      try: [
        ['📖 man7.org — strace(1)', 'https://man7.org/linux/man-pages/man1/strace.1.html', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Three layers, in order of overhead and detail: <b>strace</b> intercepts every syscall a process makes via ' +
      '<code>ptrace(2)</code> (comprehensive but high overhead — can slow a process 2-10x); <b>ftrace</b> is the kernel\'s built-in ' +
      'tracer, cheaper and always compiled in, exposing tracepoints via <code>/sys/kernel/debug/tracing</code>; and ' +
      '<b>eBPF tracepoints</b> give near-zero-overhead, programmable hooks for production use at scale.</p>' +
      '<pre><code># strace a hung process, with timestamps, without stopping to attach interactively\n' +
      '$ strace -tt -T -p 12345\n' +
      '14:22:01.120931 read(7, ...)            = -1 EAGAIN (Resource temporarily unavailable) <0.000041>\n' +
      '14:22:01.121088 futex(0x7f..., FUTEX_WAIT, ...) = ? &lt;unfinished ...&gt;   # stuck here\n\n' +
      '# ftrace: list available tracepoints, then trace one cheaply\n' +
      '$ cat /sys/kernel/debug/tracing/available_events | grep syscalls | head\n' +
      '$ echo 1 > /sys/kernel/debug/tracing/events/syscalls/sys_enter_openat/enable\n' +
      '$ cat /sys/kernel/debug/tracing/trace_pipe\n\n' +
      '# eBPF: count syscalls per process, system-wide, cheaply\n' +
      '$ sudo bpftrace -e \'tracepoint:raw_syscalls:sys_enter { @[comm] = count(); }\'</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tool for "what is this one process doing right now" ' +
      'is <b><code>strace</code></b>; for "what is the kernel doing across the whole system, cheaply" it is <b><code>ftrace</code></b> ' +
      'and <b><code>bpftrace</code>/BCC</b>. <b><code>auditd</code></b> is the standard for security-relevant syscall auditing (file ' +
      'access, execve, privilege changes) with persistent, queryable logs.</p></div>',
      try: [
        ['📖 Kernel docs — ftrace', 'https://docs.kernel.org/trace/ftrace.html', 'o'],
        ['📖 man7.org — auditd(8)', 'https://man7.org/linux/man-pages/man8/auditd.8.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>strace on a hung production process.</b> A worker process ' +
      'stopped processing its queue with no error logged. <code>strace -tt -T -p &lt;pid&gt;</code> shows the last syscall is a ' +
      '<code>futex(FUTEX_WAIT)</code> that never returns — the process is blocked on a lock, not crashed, not looping. Cross-referencing ' +
      'the lock address against the application\'s known lock usage (or attaching <code>gdb</code> for a stack trace) identifies a ' +
      'deadlock between two worker threads, something the application logs never surfaced because the threads were, from the ' +
      'application\'s point of view, simply "waiting."</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>An eBPF tracepoint counting a hot syscall.</b> A service\'s ' +
      'CPU usage climbed after a dependency upgrade with no code change on the service\'s own side. A bpftrace one-liner counting ' +
      'syscalls by name shows <code>futex</code> calls increased 50x — the new dependency version switched a lock-free data structure ' +
      'to a mutex-based one, adding massive syscall overhead invisible in application-level profiling that only samples user-space ' +
      'stacks.</p></div>' +
      '<p><b>Measuring seccomp filter overhead:</b> a seccomp-bpf filter adds a small per-syscall check cost; for a syscall-heavy ' +
      'workload, <code>perf stat</code> comparing syscall-heavy benchmark runs with and without the filter attached quantifies whether ' +
      'that overhead is negligible or actually significant for a specific hot path.</p>',
      try: [
        ['📖 man7.org — ptrace(2)', 'https://man7.org/linux/man-pages/man2/ptrace.2.html', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Using strace on a hot-path production        strace via ptrace can slow a process 2-10x -- for latency-\n' +
      '  service under real load                      sensitive services, use ftrace or bpftrace instead, or\n' +
      '                                                strace only briefly / on a canary instance.\n' +
      'Assuming a stuck process is "hung"           Check its last syscall first -- a process blocked in\n' +
      '  and restarting it immediately                 futex/read/accept is waiting, not broken, and restarting\n' +
      '                                                loses the exact evidence needed to find the root cause.\n' +
      'Treating auditd logs and strace as           auditd is for persistent, queryable security-relevant events\n' +
      '  interchangeable                               (execve, file access); strace is for interactive, ad-hoc,\n' +
      '                                                one-process debugging -- they solve different problems.\n' +
      'Tracing every syscall when only one           Filter to specific syscalls (strace -e trace=, or a targeted\n' +
      '  category is suspected                         bpftrace probe) to cut both overhead and noise dramatically.\n' +
      'Ignoring seccomp filter overhead for          For syscall-heavy hot paths, measure filter overhead with\n' +
      '  syscall-heavy hot paths                       perf stat rather than assuming seccomp is "free."\n' +
      'Debugging a container\'s hung process         ptrace-based tracing may need CAP_SYS_PTRACE / a shared PID\n' +
      '  from outside without matching namespaces     namespace to attach from outside the container at all.</code></pre>' +
      '<p><b>The real test:</b> for a "hung" process, can you show its exact last syscall and whether it returned, rather than assuming ' +
      'from symptoms alone whether it is deadlocked, blocked on I/O, or actually still making progress slowly?</p>',
      try: [
        ['📖 man7.org — seccomp(2)', 'https://man7.org/linux/man-pages/man2/seccomp.2.html', 'o'],
        ['🐧 Ch 14 — container vs VM kernel isolation tradeoffs', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, syscall visibility is layered by cost and audience: <code>strace</code> for rare, deep, one-process ' +
      'interactive debugging where overhead is acceptable; <code>ftrace</code>/eBPF for always-on or high-frequency observability in ' +
      'production where overhead must stay near zero; and <code>auditd</code> for compliance-grade, persistent security logging that ' +
      'must survive a reboot and answer "who did what" months later. Conflating these — running strace continuously in production, or ' +
      'relying on transient bpftrace one-liners for compliance evidence — misapplies the tool to the wrong layer.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why does strace slow a process down so much more than ftrace or eBPF-based tracing?\n' +
      "A: strace uses ptrace(2), which stops the traced process at every syscall entry/exit and requires a\n" +
      '   context switch to the tracer process to inspect and resume it. ftrace and eBPF run in-kernel with\n' +
      '   minimal per-event cost, without that stop-and-context-switch cycle.\n\n' +
      'Q: A process appears "hung." What is the first thing to check before restarting it?\n' +
      'A: Its last syscall via strace or an ftrace/eBPF probe. A process blocked in futex/read/accept is\n' +
      "   legitimately waiting, not broken -- restarting it destroys the exact evidence (what it was waiting\n" +
      '   on, and why) needed to find the actual root cause.\n\n' +
      'Q: What is the functional difference between auditd and strace for security-relevant syscall visibility?\n' +
      'A: auditd provides persistent, queryable, always-on logging of security-relevant events (execve, file\n' +
      "   access, privilege changes) suitable for compliance. strace is an interactive, ad-hoc tool for\n" +
      '   debugging one process at a time, with real overhead, not meant to run continuously.\n\n' +
      'Q: A service\'s CPU usage jumped after a dependency upgrade with no code change on its own side. How would eBPF help?\n' +
      'A: A cheap tracepoint-based syscall counter (e.g. bpftrace counting sys_enter by comm) can reveal a\n' +
      '   spike in a specific syscall (e.g. futex) that user-space-only profiling would miss, pointing at a\n' +
      '   dependency-level change in locking/concurrency strategy.\n\n' +
      'Q: Why might ptrace-based tracing fail to attach to a process running inside a container from the host?\n' +
      'A: It typically requires CAP_SYS_PTRACE and, depending on configuration, a shared PID namespace between\n' +
      '   the tracer and the target -- container isolation can block attachment unless explicitly permitted.</code></pre>',
      try: [
        ['📖 man7.org — strace(1)', 'https://man7.org/linux/man-pages/man1/strace.1.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why does `strace` impose significantly more overhead on a traced process than `ftrace` or eBPF-based tracing?',
      opts: [
        'strace requires recompiling the kernel',
        'strace uses ptrace(2), which stops the process at every syscall entry/exit and requires a context switch to the tracer to inspect and resume it, unlike in-kernel ftrace/eBPF tracing',
        'strace only works on single-threaded processes, adding lock contention',
        'strace and ftrace have identical overhead; the difference is only in output format'],
      ok: 1,
      why: 'ptrace-based tracing stops the traced process and hands control to the tracer at every syscall boundary -- a real per-syscall context-switch cost that in-kernel ftrace/eBPF tracing avoids.' },
    { q: 'A production process appears "hung." What should you check before restarting it?',
      opts: [
        'Nothing -- restart it immediately to restore service',
        'Its last syscall (via strace or an ftrace/eBPF probe) -- it may be legitimately blocked (e.g. on futex or read), and restarting destroys the evidence needed to find the root cause',
        'Only its CPU usage graph over the last hour',
        'Whether its systemd unit file has the correct Restart= policy'],
      ok: 1,
      why: 'A process blocked in a syscall like futex or read is waiting, not necessarily broken. Checking its last syscall before restarting preserves the one piece of evidence that usually explains what actually happened.' },
    { q: 'What distinguishes `auditd` from `strace` for syscall-level visibility?',
      opts: [
        'They are functionally identical tools with different names',
        'auditd provides persistent, queryable, always-on logging of security-relevant events suited for compliance; strace is an interactive, higher-overhead tool for ad-hoc debugging of one process at a time',
        'auditd can only trace network syscalls, while strace traces everything else',
        'strace is a Windows-only tool ported to Linux; auditd is Linux-native'],
      ok: 1,
      why: 'auditd is designed to run continuously and produce durable, queryable audit trails for compliance and security review. strace is designed for interactive, one-off debugging and is generally too high-overhead to run continuously in production.' }
  ]
};
