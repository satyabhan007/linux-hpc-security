/* linux-hpc-security Learn — Part 2 · Chapter 7: Huge Pages & Memory-Mapped Performance */
window.CH[7] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A database process addresses gigabytes of memory, but the CPU\'s hardware memory-translation cache (the <b>TLB</b>) can only ' +
      'hold a few thousand entries at a time, each normally covering just 4KB. Every time the CPU touches an address whose translation ' +
      'is not cached, it pays extra cycles walking page tables to find it. <b>Huge pages</b> make each cached entry cover 2MB (or 1GB) ' +
      'instead of 4KB, so the same handful of TLB entries cover vastly more memory.</p>' +
      '<pre><code>4KB pages:  1GB of memory needs ~262,144 page-table entries to map\n' +
      '2MB pages:  the same 1GB needs only ~512 entries — far more of it fits in a small, fast TLB</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A phrasebook with one entry per word versus one entry per common ' +
      'phrase.</b> Looking up "please pass the salt" word-by-word takes four lookups; a phrasebook with the whole sentence as one entry ' +
      'takes one. Huge pages are the phrasebook: fewer, bigger translation entries for the same amount of memory.</p></div>',
      try: [
        ['📖 Kernel docs — Transparent Hugepage Support', 'https://docs.kernel.org/admin-guide/mm/transhuge.html', 'o'],
        ['🐧 Ch 2 — memory management internals', '#ch2', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Linux offers huge pages two ways: <b>Transparent Huge Pages (THP)</b> — the kernel opportunistically and automatically backs ' +
      'anonymous memory with 2MB pages — and <b>static hugepages (HugeTLB)</b> — a pre-reserved, fixed pool of huge pages an application ' +
      'explicitly requests via <code>mmap</code> or <code>shmget</code> with <code>MAP_HUGETLB</code>. Static hugepages are pinned, ' +
      'never swapped, and never subject to THP\'s compaction stalls.</p>' +
      '<pre><code># check current static hugepage pool and usage\n' +
      '$ cat /proc/meminfo | egrep "HugePages_Total|HugePages_Free|Hugepagesize"\n' +
      'HugePages_Total:    1024\n' +
      'HugePages_Free:      512\n' +
      'Hugepagesize:       2048 kB\n\n' +
      '# reserve 1024 static 2MB hugepages (2GB total) at runtime\n' +
      '$ sysctl vm.nr_hugepages=1024\n\n' +
      '# reserve 1GB hugepages instead, via kernel boot parameter (persists across boots, needs early reservation)\n' +
      '# GRUB: default_hugepagesz=1G hugepagesz=1G hugepages=8\n\n' +
      '# check THP status and how much a specific process is actually using\n' +
      '$ cat /sys/kernel/mm/transparent_hugepage/enabled\n' +
      '$ grep AnonHugePages /proc/&lt;pid&gt;/smaps_rollup</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard controls are <b><code>/sys/kernel/mm/transparent_hugepage/</code></b> ' +
      'for THP mode, <b><code>vm.nr_hugepages</code></b> sysctl (or GRUB <code>hugepages=</code> boot parameters for guaranteed early ' +
      'reservation) for the static HugeTLB pool, and <b><code>hugeadm</code></b>/<b><code>libhugetlbfs</code></b> for managing and ' +
      'mounting <code>hugetlbfs</code> for applications that request it explicitly (databases, DPDK).</p></div>',
      try: [
        ['📖 Kernel docs — HugeTLB Pages', 'https://docs.kernel.org/admin-guide/mm/hugetlbpage.html', 'o'],
        ['📖 man7.org — mmap(2), MAP_HUGETLB', 'https://man7.org/linux/man-pages/man2/mmap.2.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Sizing hugepages for a database.</b> A large in-memory ' +
      'database (e.g. PostgreSQL shared_buffers, or an in-memory analytics engine) shows measurable throughput gains when its shared ' +
      'memory segment is backed by static hugepages instead of THP, because the segment is large, long-lived, and known ahead of time — ' +
      'exactly the profile where reserving a fixed pool at boot (avoiding THP\'s runtime compaction entirely) pays off. Fix: size ' +
      '<code>vm.nr_hugepages</code> to cover the database\'s shared memory segment, reserved via a boot parameter so the pool is not ' +
      'fragmented away by the time the database starts.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Disabling THP on a latency-sensitive service.</b> A Redis-like ' +
      'in-memory cache sees periodic multi-hundred-millisecond p99 latency spikes traced to THP compaction attempting to assemble ' +
      'contiguous 2MB regions under memory fragmentation from other processes on the same host. Fix: set THP to ' +
      '<code>madvise</code> or <code>never</code> for this workload — the redis project itself has historically recommended disabling ' +
      'THP for exactly this reason, trading a small average-case TLB benefit for eliminating the tail-latency risk.</p></div>' +
      '<p><b>A TLB-miss-driven regression</b> often shows up as elevated CPU time in <code>perf stat</code>\'s ' +
      '<code>dTLB-load-misses</code> counter without any obvious change in application logic — the workload\'s memory footprint simply ' +
      'grew past what 4KB pages\' TLB coverage handles gracefully.</p>',
      try: [
        ['📖 Kernel docs — HugeTLB Pages', 'https://docs.kernel.org/admin-guide/mm/hugetlbpage.html', 'o'],
        ['🐧 Ch 5 — perf & eBPF profiling in production', '#ch5', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Leaving THP on "always" for every            Use madvise/never for latency-sensitive services (databases,\n' +
      '  workload without measuring impact             caches) that have reported compaction-stall sensitivity.\n' +
      'Reserving a static hugepage pool after       Reserve at boot (kernel command line) when possible -- late\n' +
      '  the system has been running and memory       runtime reservation via sysctl can fail or fragment badly once\n' +
      '  is fragmented                                 memory has been in use for a while.\n' +
      'Sizing the hugepage pool larger than the     Unused reserved hugepages are unavailable to the rest of the\n' +
      '  actual application need "to be safe"          system (they are pinned out of the general allocator) --\n' +
      '                                                oversizing wastes real RAM other workloads could have used.\n' +
      'Assuming huge pages always help              Small, short-lived allocations (a typical web request handler)\n' +
      '  every memory-mapped workload                  rarely benefit — the TLB-miss cost the workload pays is small\n' +
      '                                                 to begin with, so huge pages add complexity for no gain.\n' +
      'Ignoring 1GB hugepages for very large        For multi-GB-plus mappings (e.g. DPDK hugepage-backed buffers),\n' +
      '  mappings                                      1GB pages reduce TLB entry count even further than 2MB pages.\n' +
      'Diagnosing a regression without checking     `perf stat -e dTLB-load-misses,dTLB-store-misses` directly shows\n' +
      '  TLB-miss counters                             whether TLB pressure, not something else, is the actual cause.</code></pre>' +
      '<p><b>The real test:</b> can you show, with <code>perf stat</code> TLB-miss counters before and after enabling huge pages for a ' +
      'specific workload, that the change actually reduced TLB pressure — rather than assuming it helped because it "should" in ' +
      'theory?</p>',
      try: [
        ['📖 man7.org — perf-stat(1)', 'https://man7.org/linux/man-pages/man1/perf-stat.1.html', 'o'],
        ['🐧 Ch 8 — kernel bypass & userspace networking', '#ch8', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, huge pages are a targeted optimization, not a fleet-wide default: THP\'s "always" mode helps the average ' +
      'memory-hungry workload but introduces tail-latency risk via compaction stalls, while static hugepages give a workload guaranteed, ' +
      'stall-free huge-page backing at the cost of pinned, non-reclaimable memory reserved ahead of time. Expert practice matches the ' +
      'mechanism to the workload: THP=madvise as a sane default, static hugepages explicitly sized for the specific large, long-lived, ' +
      'latency-sensitive allocations that need them (databases, DPDK, some JVM heaps).</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why do huge pages reduce TLB misses?\n' +
      'A: Each TLB entry maps a fixed-size page. A 2MB huge page lets one entry cover 512x more memory than a\n' +
      '   4KB page, so a small, fixed-size TLB can cover far more of a large working set without a miss.\n\n' +
      'Q: Why would a latency-sensitive in-memory cache disable THP entirely instead of relying on the default?\n' +
      'A: THP can trigger synchronous compaction to assemble a contiguous 2MB region under memory fragmentation,\n' +
      '   which shows up as a multi-hundred-millisecond stall -- unacceptable for a service with a tight p99\n' +
      '   latency budget, even though THP helps average-case throughput.\n\n' +
      'Q: Why reserve static hugepages at boot time rather than via sysctl once the system has been running?\n' +
      'A: Physical memory fragments over uptime. Reserving hugepages requires finding contiguous physical\n' +
      '   regions, which is far more likely to succeed cleanly before other allocations have fragmented memory.\n\n' +
      'Q: What is the downside of oversizing a static hugepage pool "to be safe"?\n' +
      'A: Reserved hugepages are pinned out of the general page allocator whether used or not -- unused\n' +
      '   reservation is memory unavailable to every other process on the host, not a free safety margin.\n\n' +
      'Q: How would you prove a performance regression is actually TLB-miss driven before reaching for huge pages?\n' +
      'A: Use `perf stat -e dTLB-load-misses,dTLB-store-misses` (and iTLB equivalents) to directly measure TLB\n' +
      '   pressure before and after a proposed change, rather than assuming huge pages will help by theory alone.</code></pre>',
      try: [
        ['📖 Kernel docs — Transparent Hugepage Support', 'https://docs.kernel.org/admin-guide/mm/transhuge.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why can enabling Transparent Huge Pages ("always" mode) introduce tail-latency risk for a latency-sensitive service?',
      opts: [
        'THP permanently disables the page cache',
        'Under memory fragmentation, THP can trigger synchronous compaction to assemble a contiguous 2MB region, which can stall the allocating process for a noticeable amount of time',
        'THP causes the service to leak memory',
        'THP only works with disk-backed memory, not RAM'],
      ok: 1,
      why: 'THP\'s "always" mode opportunistically backs anonymous memory with 2MB pages, but doing so under fragmentation may require synchronous compaction, which can add real (if occasional) latency -- a classic throughput-vs-tail-latency tradeoff.' },
    { q: 'Why should static (HugeTLB) hugepages generally be reserved via a kernel boot parameter rather than via sysctl after the system has been running for a while?',
      opts: [
        'sysctl cannot set vm.nr_hugepages at all',
        'Physical memory fragments over uptime, making it much harder to find enough contiguous physical regions for the reservation to succeed cleanly once the system has been running',
        'Boot-time reservation is required by a hard kernel restriction with no runtime alternative',
        'Static hugepages can only be used by the kernel itself, never by applications'],
      ok: 1,
      why: 'Reserving hugepages requires contiguous physical memory. That is easiest immediately at boot before fragmentation sets in; late runtime reservation via sysctl can fail or only partially succeed on a fragmented, long-running system.' },
    { q: 'What is the real cost of oversizing a static hugepage pool "just to be safe"?',
      opts: [
        'There is no cost -- unused hugepages are automatically returned to the general allocator',
        'Reserved hugepages are pinned out of the general page allocator regardless of whether they are used, making that memory unavailable to every other process on the host',
        'Oversizing the pool slows down the CPU clock speed',
        'Oversizing only affects swap space, not RAM'],
      ok: 1,
      why: 'A static hugepage reservation removes that memory from the general-purpose allocator whether it is actually used or not -- oversizing wastes real RAM that other workloads on the same host could otherwise have used.' }
  ]
};
