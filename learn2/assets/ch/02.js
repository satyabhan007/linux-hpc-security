/* linux-hpc-security Learn — Part 2 · Chapter 2: Memory Management Internals: Page Cache, THP & the OOM Killer */
window.CH[2] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p><code>free -h</code> shows 2GB "free" on a box that has been up for months serving a database, and someone panics that the ' +
      'box is "almost out of memory". It is not — most of the used memory is the kernel caching disk pages it has already read, which it ' +
      'will happily hand back the instant something else needs it. Linux memory management spends most of its effort deciding what to ' +
      'cache, when to reclaim, and — in the worst case — who to kill.</p>' +
      '<pre><code>$ free -h\n' +
      '               total        used        free      shared  buff/cache   available\n' +
      'Mem:            62Gi        14Gi       2.1Gi       1.2Gi        46Gi        47Gi\n' +
      '# "free" column looks scary; "available" is the number that actually matters</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A chef who keeps yesterday\'s prepped ingredients on the counter ' +
      'instead of putting them away.</b> It looks like the counter is full, but the chef will clear it instantly the moment fresh counter ' +
      'space is actually needed for a new order. The mess is not waste — it is a cache saving you the trip back to the walk-in fridge (disk).</p></div>',
      try: [
        ['📖 Kernel docs — Page cache & the buffer cache', 'https://docs.kernel.org/admin-guide/mm/concepts.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>The <b>page cache</b> holds recently read/written file-backed pages in RAM so a repeat read is a memory access instead of a ' +
      'disk seek. Reclaim is driven by memory pressure, not a schedule; <b>Transparent Huge Pages (THP)</b> opportunistically back ' +
      'anonymous memory with 2MB pages to cut TLB misses; and the <b>OOM killer</b> is the last-resort mechanism that picks a victim when ' +
      'reclaim genuinely cannot free enough memory.</p>' +
      '<pre><code># memory pressure and cache breakdown\n' +
      '$ cat /proc/meminfo | egrep "MemAvailable|Cached|Dirty|AnonHugePages|SwapTotal"\n' +
      '$ vmstat 1 5                       # si/so columns = actual swapping, not just swap configured\n\n' +
      '# THP status and per-process transparent huge page usage\n' +
      '$ cat /sys/kernel/mm/transparent_hugepage/enabled\n' +
      'always [madvise] never\n' +
      '$ grep AnonHugePages /proc/&lt;pid&gt;/smaps_rollup\n\n' +
      '# tune reclaim aggressiveness and OOM behavior\n' +
      '$ sysctl vm.swappiness=10                       # prefer reclaiming page cache over swapping anon pages\n' +
      '$ echo -1000 > /proc/&lt;pid&gt;/oom_score_adj         # never kill this process (e.g. the database)\n' +
      '$ dmesg -T | grep -i "killed process"            # confirm what the OOM killer actually did</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard toolchain is <b><code>/proc/meminfo</code></b> and ' +
      '<b><code>vmstat</code></b> for pressure, <b><code>sysctl vm.*</code></b> (swappiness, overcommit_memory, min_free_kbytes) for ' +
      'reclaim tuning, and <b><code>oom_score_adj</code></b>/<b><code>earlyoom</code></b>/<b>systemd-oomd</b> for controlling or getting ' +
      'ahead of the OOM killer\'s victim selection.</p></div>',
      try: [
        ['📖 man7.org — proc(5), meminfo section', 'https://man7.org/linux/man-pages/man5/proc.5.html', 'o'],
        ['📖 Kernel docs — Transparent Hugepage Support', 'https://docs.kernel.org/admin-guide/mm/transhuge.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>"The OOM killer took down the wrong process."</b> A multi-tenant ' +
      'node runs a critical database and a batch analytics job. Memory pressure hits during a nightly ETL, and the OOM killer picks the ' +
      'database — because its <code>oom_score</code> (driven by resident memory size) was higher than the batch job\'s, even though the ' +
      'batch job was the actual cause. Fix: set <code>oom_score_adj=-500</code> on the database (or run it in its own cgroup with ' +
      '<code>memory.oom.group</code>, Ch 4) so a large-but-legitimate working set is not the deciding factor, and give the batch job a ' +
      'tighter <code>memory.max</code> so it OOMs itself before it can starve neighbors.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The "compaction stall" latency spike.</b> A latency-sensitive ' +
      'service sees periodic multi-hundred-millisecond stalls that correlate with THP allocation attempts under fragmented memory — the ' +
      'kernel pauses to defragment (compact) memory to assemble a contiguous 2MB page. Fix: set THP to <code>madvise</code> so only ' +
      'applications that explicitly opt in (via <code>madvise(MADV_HUGEPAGE)</code>) pay the compaction cost, or <code>never</code> for ' +
      'strictly latency-sensitive services, and use static hugepages (Ch 7) where the throughput win is worth the setup cost.</p></div>' +
      '<p><b>Reclaim has two flavors:</b> reclaiming clean page-cache pages is nearly free (just drop them, re-read from disk later); ' +
      'reclaiming dirty pages means writing back to disk first, which is why a sudden write-heavy workload can turn "plenty of free memory" ' +
      'into visible latency the moment reclaim needs to flush dirty pages under pressure.</p>',
      try: [
        ['📖 Kernel docs — Memory reclaim', 'https://docs.kernel.org/mm/page_reclaim.html', 'o'],
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Reading "free" memory in `free -h` as        Read the "available" column instead — it already accounts for\n' +
      '  the health signal                           reclaimable cache the kernel will hand back on demand.\n' +
      'Leaving THP on "always" for every            Use "madvise" (or "never" for strict-latency services) so only\n' +
      '  workload including latency-sensitive         opted-in allocators pay the compaction/defrag cost.\n' +
      '  services\n' +
      'Sizing swap to zero "to force OOM            A little swap plus a correctly tuned swappiness lets the kernel\n' +
      '  killer instead of swapping"                  evict genuinely cold pages instead of jumping straight to OOM-kill.\n' +
      'Relying on OOM killer defaults for            Set oom_score_adj (or memory.oom.group in cgroups v2) so the\n' +
      '  which process should survive                 kernel\'s heuristic (mostly RSS size) is not the sole decider.\n' +
      'Diagnosing memory pressure only from         Watch vmstat si/so and pgscan/pgsteal counters — a box can look\n' +
      '  RSS or free -h snapshots                     fine in a snapshot while actively thrashing between samples.\n' +
      'Ignoring dirty-page writeback cost            A sudden write-heavy burst can turn "plenty of free RAM" into\n' +
      '  when memory "looks" free                     real latency once reclaim has to flush dirty pages first.</code></pre>' +
      '<p><b>The real test:</b> when someone says "the box is out of memory," can you show whether it was true memory exhaustion ' +
      '(pgsteal/pgscan climbing, actual OOM kills in <code>dmesg</code>) or just a scary-looking <code>free -h</code> snapshot of a ' +
      'healthy page cache?</p>',
      try: [
        ['📖 man7.org — oom_score & oom_score_adj', 'https://man7.org/linux/man-pages/man5/proc.5.html', 'o'],
        ['🐧 Ch 7 — huge pages & memory-mapped performance', '#ch7', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, memory management is a policy question as much as a mechanism question: the kernel\'s defaults (THP=always ' +
      'on many distros, swappiness=60, heuristic OOM scoring) are tuned for general-purpose desktops, not for a fleet running mixed ' +
      'latency-sensitive and batch workloads. Expert practice is to make memory policy explicit per workload class — cgroup memory limits ' +
      '(Ch 4), THP mode, swappiness, and oom_score_adj — rather than accepting distro defaults everywhere and firefighting the OOM killer\'s ' +
      'choices after the fact.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: `free -h` shows only 2GB "free" on a 64GB box that has been up for months. Is that a problem?\n' +
      'A: Not by itself — check the "available" column, which accounts for reclaimable page cache. High\n' +
      '   buff/cache with high "available" means the kernel is using spare RAM productively, not running out.\n\n' +
      'Q: The OOM killer killed your database instead of the batch job that actually caused the pressure. Why?\n' +
      "A: Default OOM scoring is driven heavily by resident memory size (oom_score), not by \"who caused the\n" +
      "   pressure.\" A large-but-legitimate working set can outscore the actual offender. Fix with\n" +
      '   oom_score_adj or per-workload cgroup memory limits with memory.oom.group.\n\n' +
      'Q: Why would you disable THP for a latency-sensitive service but keep it for a batch analytics job?\n' +
      'A: THP trades occasional compaction-stall latency (assembling a contiguous 2MB page under fragmentation)\n' +
      '   for fewer TLB misses on average. Batch throughput workloads want the average win; latency-sensitive\n' +
      '   services want to avoid the tail-latency cost, so madvise/never suits them better.\n\n' +
      'Q: What is the difference between reclaiming a clean page-cache page and a dirty one?\n' +
      'A: A clean page can just be dropped and re-read from disk later — nearly free. A dirty page must be\n' +
      "   written back first, which is why reclaim under a write-heavy workload can add real latency even\n" +
      '   when "memory looks free."\n\n' +
      'Q: Why keep some swap configured instead of disabling it to "force" the OOM killer to act sooner?\n' +
      'A: A modest swap plus correct swappiness tuning lets the kernel evict genuinely cold anonymous pages\n' +
      '   instead of jumping straight to killing a process — swap is a release valve, not just a last resort.</code></pre>',
      try: [
        ['📖 Kernel docs — Memory management concepts', 'https://docs.kernel.org/admin-guide/mm/concepts.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: '`free -h` on a database server shows only 2.1GB "free" but 47GB "available" out of 62GB total. What does this most likely mean?',
      opts: [
        'The box is nearly out of memory and needs more RAM immediately',
        'Most of the "used" memory is reclaimable page cache the kernel can hand back on demand — the "available" figure is the real health signal',
        'The database has a memory leak',
        'Swap is misconfigured'],
      ok: 1,
      why: 'The page cache holds file-backed pages the kernel can drop instantly under pressure. "available" already accounts for that reclaimable cache, which is why it is the number to watch, not the raw "free" column.' },
    { q: 'Why might the OOM killer kill a legitimate, large-memory database process instead of the batch job that actually triggered the memory pressure?',
      opts: [
        'The OOM killer always kills the oldest process',
        'Default OOM scoring weighs resident memory size heavily, so a large-but-legitimate working set can outscore the actual offender unless oom_score_adj or cgroup limits are set',
        'The OOM killer only targets processes owned by root',
        'The OOM killer cannot distinguish between any processes and picks randomly'],
      ok: 1,
      why: 'oom_score is heavily influenced by RSS. Without explicit oom_score_adj tuning or per-workload cgroup memory limits, the process with the largest legitimate footprint can be selected over the actual cause of the pressure.' },
    { q: 'Why would a latency-sensitive service set Transparent Huge Pages to `madvise` or `never` instead of leaving the distro default of `always`?',
      opts: [
        'THP always reduces available memory, so latency-sensitive services need every megabyte',
        'THP under fragmented memory can trigger compaction stalls (tens to hundreds of milliseconds) while the kernel assembles a contiguous 2MB page, hurting tail latency',
        '`always` mode disables the page cache entirely',
        'THP is deprecated and does nothing on modern kernels'],
      ok: 1,
      why: 'THP trades average-case TLB-miss reduction for occasional compaction-stall latency. Throughput-oriented batch jobs can absorb that; strict-latency services usually cannot, so madvise/never avoids the surprise stalls.' }
  ]
};
