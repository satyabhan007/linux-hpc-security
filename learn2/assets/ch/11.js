/* linux-hpc-security Learn — Part 2 · Chapter 11: Debugging Production Kernel Panics & Oopses */
window.CH[11] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A production server reboots itself at 3am with no application-level error, no alert from the app, nothing in the usual logs — ' +
      'just a gap in the uptime and a fresh boot. The default reaction is "must have been a power blip," and the same box does it again ' +
      'three weeks later. A <b>kernel panic</b> is the kernel itself crashing; without capturing what it was doing at the moment of ' +
      'failure, every recurrence looks identical and unexplainable.</p>' +
      '<pre><code>Application crash:  the OS survives, logs the crash, can often restart the process\n' +
      'Kernel panic:       the OS itself is what crashed — there is no "application log" for this</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An airplane\'s black box.</b> When a plane crashes, you cannot ask ' +
      'the pilot what happened — the only record is the flight recorder captured in the seconds before impact. <code>kdump</code> is ' +
      'that recorder for the kernel: it captures a memory snapshot (a <code>vmcore</code>) in the moment of failure, before the box ' +
      'reboots and the evidence is gone.</p></div>',
      try: [
        ['📖 Kernel docs — kdump', 'https://docs.kernel.org/admin-guide/kdump/kdump.html', 'o'],
        ['🐧 Ch 9 — syscall tracing & auditing', '#ch9', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p><b>kdump</b> boots a small, pre-reserved "capture kernel" the instant the primary kernel panics, which writes a full memory ' +
      'dump (<b>vmcore</b>) to disk before the system reboots normally. The <b>crash</b> utility then lets you load that vmcore ' +
      '(alongside matching kernel debug symbols) and inspect it almost like a live, paused kernel — reading the call stack, registers, ' +
      'and data structures at the exact moment of failure.</p>' +
      '<pre><code># confirm kdump is configured and its reserved memory\n' +
      '$ systemctl status kdump\n' +
      '$ cat /proc/cmdline | grep -o \'crashkernel=[^ ]*\'\n' +
      'crashkernel=256M\n\n' +
      '# after a panic, find the captured vmcore\n' +
      '$ ls /var/crash/&lt;timestamp&gt;/\n' +
      'vmcore  vmcore-dmesg.txt\n\n' +
      '# open it in the crash utility with matching debug symbols\n' +
      '$ crash /usr/lib/debug/lib/modules/$(uname -r)/vmlinux /var/crash/&lt;timestamp&gt;/vmcore\n' +
      'crash> bt                    # backtrace of the crashing context\n' +
      'crash> log                   # kernel ring buffer at time of panic\n' +
      'crash> ps | grep RU           # what was actually running</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard toolchain is <b><code>kdump</code></b> (capture) ' +
      'paired with the <b><code>crash</code></b> utility (analysis) — both are the standard Red Hat/upstream approach, requiring a ' +
      'reserved memory region (<code>crashkernel=</code> boot parameter) sized to actually hold a full dump.</p></div>',
      try: [
        ['📖 Red Hat docs — Installing kdump', 'https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_monitoring_and_updating_the_kernel/installing-kdump_managing-monitoring-and-updating-the-kernel', 'o'],
        ['📖 man7.org — crash(8)', 'https://man7.org/linux/man-pages/man8/crash.8.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Configuring kdump fleet-wide.</b> A fleet of otherwise ' +
      'identical hosts has an intermittent panic on roughly one host per month, never reproducible on demand. Without kdump enabled ' +
      'before the first occurrence, each incident is a dead end — a reboot and a shrug. Fix: bake <code>crashkernel=</code> sizing and ' +
      '<code>kdump</code> enablement into the base image/config-management role fleet-wide, so the very next panic — on any host — ' +
      'produces a vmcore automatically, without needing to have predicted which box would fail.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Reading a kernel oops backtrace.</b> A non-fatal ' +
      '<b>oops</b> (the kernel recovers, unlike a full panic) appears in <code>dmesg</code> pointing at a NULL pointer dereference in a ' +
      'specific kernel module\'s function. Cross-referencing the backtrace addresses against ' +
      '<code>/proc/kallsyms</code> and the module\'s known source identifies a third-party out-of-tree driver as the culprit — evidence ' +
      'strong enough to justify pinning that driver\'s version or replacing it, instead of continuing to absorb sporadic oopses as ' +
      '"normal."</p></div>' +
      '<p><b>A crash-utility session on a captured vmcore</b> can answer questions no amount of application-level monitoring can: which ' +
      'kernel thread was running on which CPU, what locks were held, and what the exact instruction pointer was at the moment things ' +
      'went wrong.</p>',
      try: [
        ['📖 Kernel docs — Reporting a kernel oops', 'https://docs.kernel.org/admin-guide/reporting-issues.html', 'o'],
        ['🐧 Ch 12 — live kernel patching', '#ch12', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Waiting until after a first panic to        Enable kdump fleet-wide proactively -- by the time a panic\n' +
      '  enable kdump                                  happens you cannot retroactively capture the vmcore you needed.\n' +
      'Sizing crashkernel= memory too small          A dump that gets truncated because reserved memory was too\n' +
      '  "to save RAM"                                 small is often as useless as having no dump at all.\n' +
      'Treating a recovered oops as "nothing        An oops means the kernel hit a real bug and continued in a\n' +
      '  happened, the system is still up"             degraded/unknown state -- investigate it like a near-miss,\n' +
      '                                                not a non-event.\n' +
      'Analyzing a vmcore without matching           Mismatched debug symbols make backtraces unreliable or\n' +
      '  kernel debug symbols (vmlinux + debuginfo)    unreadable -- always pair the exact kernel build\'s symbols.\n' +
      'Assuming a panic is hardware failure           Check the vmcore/backtrace first -- many "hardware" panics\n' +
      '  without checking the backtrace                are software bugs (driver, memory corruption) that will\n' +
      '                                                recur on replacement hardware too.\n' +
      'Discarding vmcores after a quick glance       Retain vmcores (and their exact kernel version/symbols) until\n' +
      '  at dmesg                                       root cause is confirmed -- dmesg alone often lacks the\n' +
      '                                                full call stack and register state a real fix needs.</code></pre>' +
      '<p><b>The real test:</b> for a recurring, hard-to-reproduce panic, can you show a specific backtrace frame and root cause from an ' +
      'actual captured vmcore — rather than a plausible-sounding guess based on symptoms and timing alone?</p>',
      try: [
        ['📖 Kernel docs — kdump', 'https://docs.kernel.org/admin-guide/kdump/kdump.html', 'o'],
        ['🐧 Ch 13 — sysctl tuning at fleet scale', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, kernel-panic response is a prepared capability, not an improvised reaction: fleet-wide kdump with correctly ' +
      'sized <code>crashkernel=</code>, automated vmcore collection to a central store, matching debug symbols pre-staged for every ' +
      'deployed kernel version, and a documented <code>crash</code>-utility runbook. The goal is that the second occurrence of any ' +
      'panic — even on a host nobody predicted — produces a root cause, not just another mystery reboot to shrug off.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: A box reboots unexpectedly with nothing unusual in application logs. What is the very first thing to check?\n' +
      'A: Whether kdump was enabled and captured a vmcore for that event. If not, the very next step is to\n' +
      '   enable kdump with correctly sized crashkernel= memory before the next occurrence, since a panic\n' +
      "   leaves no application-level evidence -- the kernel itself is what crashed.\n\n" +
      'Q: Why is it critical to have kdump enabled BEFORE a panic occurs, rather than reactively after the first one?\n' +
      'A: A panic destroys the exact in-memory evidence needed to diagnose it the moment the box reboots.\n' +
      '   kdump must already be configured (crashkernel reserved, kdump service running) at the moment of\n' +
      '   failure to capture anything at all -- there is no way to retroactively recover a vmcore.\n\n' +
      'Q: What is the difference between a kernel oops and a kernel panic, and why does an oops still deserve investigation?\n' +
      'A: An oops is a recoverable kernel-level error (e.g. NULL pointer dereference) where the kernel kills\n' +
      '   the offending context and continues; a panic is unrecoverable and halts/reboots the system. An oops\n' +
      '   still indicates a real bug and the system continues in a potentially degraded or inconsistent state.\n\n' +
      'Q: Why must vmcore analysis use debug symbols matching the exact kernel build that panicked?\n' +
      'A: Symbol addresses and structure layouts are specific to a kernel build. Mismatched debug symbols\n' +
      '   produce misleading or unreadable backtraces in the crash utility, potentially pointing at the wrong\n' +
      '   function entirely.\n\n' +
      'Q: A panic is initially blamed on "hardware failure." How would you confirm or refute that from a vmcore?\n' +
      'A: Inspect the backtrace and panic message in the crash utility -- many panics attributed to hardware\n' +
      '   are actually software bugs (driver defects, memory corruption from a bad write) that will recur on\n' +
      '   replacement hardware unless the actual root cause is fixed.</code></pre>',
      try: [
        ['📖 Kernel docs — kdump', 'https://docs.kernel.org/admin-guide/kdump/kdump.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why must `kdump` be enabled and configured BEFORE a kernel panic occurs, rather than set up reactively afterward?',
      opts: [
        'kdump can be enabled retroactively and will still capture the previous panic',
        'A panic destroys the exact in-memory evidence at the moment the box reboots -- kdump must already be running (with crashkernel memory reserved) at the moment of failure to capture a vmcore at all',
        'kdump only works if enabled by the hardware vendor at the factory',
        'kdump requires a full day to initialize before it becomes active'],
      ok: 1,
      why: 'There is no way to recover memory state after the fact -- kdump\'s capture kernel must already be staged and crashkernel memory reserved so it can boot immediately and dump memory the instant a panic happens.' },
    { q: 'What is the key difference between a kernel oops and a kernel panic?',
      opts: [
        'They are the same event described with different terminology',
        'An oops is a recoverable kernel error where the offending context is killed and the kernel continues (in a potentially degraded state); a panic is unrecoverable and halts or reboots the system',
        'An oops only happens in userspace processes, never in the kernel',
        'A panic is always caused by hardware, while an oops is always caused by software'],
      ok: 1,
      why: 'An oops lets the kernel survive by terminating the specific faulting context, while a panic is a full, unrecoverable kernel crash. An oops still signals a real bug and deserves investigation even though the system stayed up.' },
    { q: 'Why is it essential to analyze a captured vmcore with debug symbols that exactly match the panicking kernel build?',
      opts: [
        'It is not essential -- any recent kernel\'s symbols will work fine',
        'Symbol addresses and data structure layouts are specific to a particular kernel build; mismatched symbols can produce misleading or unreadable backtraces in the crash utility',
        'Debug symbols are only needed for panics caused by third-party drivers',
        'The crash utility automatically downloads the correct symbols regardless of what is provided'],
      ok: 1,
      why: 'A kernel build\'s memory layout and symbol table are specific to that exact build. Using symbols from a different version can misattribute addresses to the wrong functions, making the backtrace unreliable or actively misleading.' }
  ]
};
