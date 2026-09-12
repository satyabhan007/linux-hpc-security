/* linux-hpc-security Learn — Part 2 · Chapter 6: I/O Schedulers & the Block Layer */
window.CH[6] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>Two servers with identical NVMe drives, identical database, identical query load — one has snappy write latency, the other ' +
      'stutters under the same load. Nobody touched the hardware. The difference turns out to be which <b>I/O scheduler</b> the block ' +
      'layer is using: the algorithm deciding the order in which pending disk requests actually get dispatched to the device.</p>' +
      '<pre><code>100 pending disk requests, 1 device queue  →  someone decides the dispatch order:\n' +
      '                                              by arrival, by fairness, by latency deadline, or by priority</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>An elevator that can either stop at every floor in order, or ' +
      'prioritize whoever has been waiting longest.</b> The "obviously correct" strategy depends entirely on the building: an elevator ' +
      'serving one floor per trip in physical order is efficient for spinning disks (minimize seek distance); an elevator that just ' +
      'answers calls in fairness order works better once "movement" (seek time) is nearly free, as on NVMe.</p></div>',
      try: [
        ['📖 Kernel docs — Block layer I/O schedulers', 'https://docs.kernel.org/block/index.html', 'o'],
        ['🐧 Ch 1 — process scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Modern kernels use <b>blk-mq</b> (multi-queue block layer) with pluggable I/O schedulers: <b>mq-deadline</b> (bounds request ' +
      'latency with per-request deadlines), <b>bfq</b> (Budget Fair Queueing — proportional fairness between processes/cgroups), ' +
      '<b>kyber</b> (target-latency based, tuned for fast NVMe), and <b>none</b> (no reordering — let the device\'s own queueing handle ' +
      'it, common for high-IOPS NVMe).</p>' +
      '<pre><code># check current and available schedulers per device\n' +
      '$ cat /sys/block/nvme0n1/queue/scheduler\n' +
      'mq-deadline [none] kyber bfq\n\n' +
      '# switch scheduler for a device (takes effect immediately, not persistent across reboot)\n' +
      '$ echo bfq > /sys/block/sda/queue/scheduler\n\n' +
      '# inspect and tune blk-mq queue depth\n' +
      '$ cat /sys/block/nvme0n1/queue/nr_requests\n' +
      '$ echo 256 > /sys/block/nvme0n1/queue/nr_requests\n\n' +
      '# live per-device I/O stats: queue depth, await, %util\n' +
      '$ iostat -x 1 5\n' +
      '$ cat /proc/diskstats</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard interface is per-device sysfs files under ' +
      '<b><code>/sys/block/&lt;dev&gt;/queue/</code></b> (<code>scheduler</code>, <code>nr_requests</code>, ' +
      '<code>read_ahead_kb</code>), observed with <b><code>iostat -x</code></b> and <b><code>blktrace</code></b>/<b><code>biotop-bpfcc</code></b> ' +
      'for live per-request tracing.</p></div>',
      try: [
        ['📖 Kernel docs — Multi-Queue Block IO Queueing (blk-mq)', 'https://docs.kernel.org/block/blk-mq.html', 'o'],
        ['📖 Red Hat docs — I/O scheduler tuning', 'https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/monitoring_and_managing_system_status_and_performance/setting-the-disk-scheduler_monitoring-and-managing-system-status-and-performance', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Picking a scheduler for a Lustre OSS.</b> A Lustre Object ' +
      'Storage Server backed by spinning-disk RAID sees poor throughput under <code>none</code> (no reordering), because sequential ' +
      'write requests from many clients arrive interleaved and the drive pays real seek-time cost jumping between them. Fix: switch to ' +
      '<code>mq-deadline</code> (or <code>bfq</code> for stronger fairness across clients), which merges and reorders adjacent requests ' +
      'to reduce head movement — a scheduler choice that matters on spinning media and matters far less on NVMe.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>p99 write latency on an NVMe RAID.</b> A database on NVMe RAID ' +
      'has good average write latency but occasional p99 spikes traced to the <code>bfq</code> scheduler\'s fairness bookkeeping adding ' +
      'CPU overhead per request at very high IOPS — overhead that is negligible on slow spinning disks but measurable when the device ' +
      'itself can service requests in microseconds. Fix: switch to <code>none</code> or <code>kyber</code> for the NVMe device, letting ' +
      'the drive\'s own internal queueing (which is fast enough not to need kernel-side reordering) do the work.</p></div>' +
      '<p><b>blk-mq queue depth (<code>nr_requests</code>)</b> trades latency for throughput: a deeper queue lets more requests be ' +
      'in-flight (better throughput under load) but each individual request can wait longer behind others before dispatch (worse tail ' +
      'latency) — there is no universally correct depth, only one matched to the workload\'s latency budget.</p>',
      try: [
        ['📖 Kernel docs — Block layer I/O schedulers', 'https://docs.kernel.org/block/index.html', 'o'],
        ['🐧 Ch 7 — huge pages & memory-mapped performance', '#ch7', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Using the same I/O scheduler for spinning    Spinning disks benefit from request merging/reordering\n' +
      '  disks and NVMe uniformly                     (mq-deadline/bfq); fast NVMe often does best with none/kyber,\n' +
      '                                                where kernel-side reordering only adds CPU overhead.\n' +
      'Assuming a scheduler change persists          Writing to /sys/block/*/queue/scheduler is not persistent --\n' +
      '  across reboot                                 use udev rules or a tuned profile to make it durable.\n' +
      'Diagnosing I/O latency from %util alone      A device can show high %util while still having spare queue\n' +
      '  in iostat                                     depth -- check avgqu-sz/aqu-sz and await together with %util.\n' +
      'Maximizing nr_requests blindly for            A very deep queue improves throughput but can worsen tail\n' +
      '  "better performance"                          latency, since requests queue longer behind others before dispatch.\n' +
      'Ignoring read_ahead_kb for random-access      Aggressive read-ahead tuned for sequential workloads wastes\n' +
      '  workloads                                     I/O bandwidth (and cache) on data a random-access workload never uses.\n' +
      'Choosing bfq for raw throughput benchmarks    bfq optimizes proportional fairness across processes/cgroups,\n' +
      '                                                not maximum aggregate throughput -- benchmark against the actual goal.</code></pre>' +
      '<p><b>The real test:</b> can you justify a specific scheduler choice by device characteristics (rotational vs NVMe, single-tenant ' +
      'vs multi-tenant fairness needs) rather than "it was the distro default" or "it benchmarked best in an unrelated workload"?</p>',
      try: [
        ['📖 man7.org — iostat(1)', 'https://man7.org/linux/man-pages/man1/iostat.1.html', 'o'],
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, I/O scheduler choice is a function of device latency floor and workload fairness requirements: once a ' +
      'device\'s own service time (NVMe, tens of microseconds) approaches the CPU cost of software reordering, the scheduler\'s job ' +
      'shifts from "hide slow media with clever ordering" to "get out of the way" (<code>none</code>) unless multi-tenant fairness is a ' +
      'hard requirement (<code>bfq</code>). Expert practice benchmarks scheduler choice against the actual device and actual workload, ' +
      'not received wisdom from spinning-disk-era defaults.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why might `none` (no reordering) outperform `bfq` on a high-IOPS NVMe device?\n' +
      "A: NVMe's own hardware queueing services requests in microseconds -- fast enough that bfq's fairness\n" +
      '   bookkeeping overhead per request becomes a measurable fraction of total latency. On slow media,\n' +
      "   that same bookkeeping is negligible next to the device's own seek/service time.\n\n" +
      'Q: A Lustre OSS on spinning-disk RAID gets poor throughput under `none`. Why, and what fixes it?\n' +
      'A: Without reordering, interleaved requests from many clients cause real seek-time cost as the disk\n' +
      '   head jumps between them. mq-deadline or bfq merges/reorders adjacent requests to reduce head\n' +
      '   movement, which matters a great deal on rotational media.\n\n' +
      'Q: Why does increasing nr_requests (queue depth) not universally improve performance?\n' +
      'A: A deeper queue improves throughput by keeping more requests in flight, but each request can wait\n' +
      '   longer behind others before dispatch, which can worsen tail latency for latency-sensitive workloads.\n\n' +
      'Q: What does high %util in iostat actually tell you, and what does it not tell you?\n' +
      'A: %util reflects how much time the device had at least one request outstanding -- it can be high\n' +
      '   even when there is spare queue depth (for devices supporting queuing). Combine it with await and\n' +
      '   avgqu-sz/aqu-sz to know whether the device is actually saturated.\n\n' +
      'Q: Why is a scheduler change written to /sys/block/*/queue/scheduler not durable across reboot?\n' +
      'A: sysfs attributes are runtime-only kernel state -- they reset to the compiled-in/udev-configured\n' +
      '   default on reboot. Persisting the choice requires a udev rule or a tuned profile applied at boot.</code></pre>',
      try: [
        ['📖 Kernel docs — blk-mq', 'https://docs.kernel.org/block/blk-mq.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why might the `none` I/O scheduler outperform `bfq` on a high-IOPS NVMe device, even though bfq provides fairness?',
      opts: [
        '`none` is always faster than bfq regardless of device type',
        'NVMe devices service requests in microseconds via their own hardware queueing, so bfq\'s per-request fairness bookkeeping becomes a measurable overhead relative to the device\'s own speed',
        'bfq only works with spinning disks and refuses to attach to NVMe devices',
        '`none` actually enables the most aggressive request reordering of all schedulers'],
      ok: 1,
      why: 'On fast NVMe, the device\'s own service time is so low that software-side scheduling overhead (bfq\'s fairness accounting) becomes proportionally significant, whereas on slow rotational media that same overhead is negligible next to real seek costs.' },
    { q: 'A change to `/sys/block/nvme0n1/queue/scheduler` works immediately but disappears after a reboot. Why?',
      opts: [
        'The change was applied to the wrong device',
        'sysfs queue attributes are runtime kernel state, not persistent configuration -- durability requires a udev rule or a tuned profile applied at boot',
        'I/O scheduler changes require a kernel recompile to persist',
        'Only root can make persistent changes, and the change was made as a regular user'],
      ok: 1,
      why: 'Files under /sys/block/*/queue/ reflect live, in-memory block-layer state. They reset to defaults on reboot unless something (a udev rule, tuned, or a boot script) reapplies the setting.' },
    { q: 'Why can increasing blk-mq queue depth (`nr_requests`) improve throughput while worsening tail latency?',
      opts: [
        'It cannot -- queue depth only ever improves both throughput and latency',
        'A deeper queue allows more requests in flight (helping throughput) but each individual request may wait longer behind others before being dispatched to the device (hurting tail latency)',
        'nr_requests only affects read operations, never writes',
        'Queue depth has no relationship to latency, only to disk capacity'],
      ok: 1,
      why: 'Queue depth is a throughput-vs-latency knob: more in-flight requests raises aggregate throughput but increases how long a given request may sit queued behind others, which shows up as worse tail latency.' }
  ]
};
