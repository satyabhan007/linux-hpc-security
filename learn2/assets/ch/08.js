/* linux-hpc-security Learn — Part 2 · Chapter 8: Kernel Bypass & Userspace Networking */
window.CH[8] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A packet arriving on a 100GbE NIC destined for your application has to travel through the NIC driver, the kernel\'s network ' +
      'stack (interrupts, softirqs, routing, netfilter, socket buffers), and finally a copy into your process\'s memory — all before ' +
      'your code sees a single byte. At extreme packet rates, that per-packet kernel overhead itself becomes the bottleneck, not the ' +
      'network or the CPU doing real work. <b>Kernel bypass</b> techniques let specific packets skip most or all of that path.</p>' +
      '<pre><code>Normal path:  NIC -> driver -> kernel network stack -> socket buffer -> copy -> your app\n' +
      'Bypass path:  NIC -> your app\'s memory directly (or a minimal in-kernel fast path)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A VIP lane at customs versus the regular line.</b> Every regular ' +
      'traveler (packet) goes through full processing — passport check, bag scan, declarations (routing, netfilter, socket buffering). ' +
      'A pre-cleared VIP lane (kernel bypass) skips straight through for travelers who have already been vetted for a specific, ' +
      'well-understood purpose.</p></div>',
      try: [
        ['📖 Kernel docs — XDP', 'https://docs.kernel.org/networking/af_xdp.html', 'o'],
        ['🐧 Ch 10 — interrupt handling & softirq tuning', '#ch10', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Three complementary techniques: <b>XDP</b> (eXpress Data Path) runs an eBPF program at the NIC driver level, before the ' +
      'kernel network stack, for extremely fast filter/drop/redirect decisions; <b>AF_XDP</b> is a socket type that hands raw frames ' +
      'directly to a userspace ring buffer, skipping most stack processing while staying inside the kernel\'s driver model (unlike full ' +
      'DPDK, which takes the NIC over entirely); and <b>io_uring</b> is a general async I/O interface that cuts syscall overhead for ' +
      'high-throughput I/O, network included.</p>' +
      '<pre><code># attach an XDP program to drop packets matching a filter, in-driver, before the stack sees them\n' +
      '$ ip link set dev eth0 xdp obj xdp_drop.o sec xdp\n' +
      '$ ip link show dev eth0 | grep xdp        # confirm attach mode: xdp (native) or xdpgeneric (SKB, fallback)\n\n' +
      '# check current XDP program stats via bpftool\n' +
      '$ bpftool prog show\n' +
      '$ bpftool net show\n\n' +
      '# an AF_XDP socket needs a dedicated queue and a userspace poller (application-linked, not a CLI flag)\n' +
      '# ethtool -L eth0 combined 1   # isolate one RX queue for AF_XDP, leaving others for the kernel stack\n\n' +
      '# io_uring is used via liburing from application code, not a shell command --\n' +
      '# strace can confirm a process using it: strace -e trace=io_uring_setup,io_uring_enter -p &lt;pid&gt;</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tooling is <b><code>ip link ... xdp</code></b> and ' +
      '<b><code>bpftool</code></b> for loading and inspecting XDP programs, <b><code>libxdp</code>/<code>libbpf</code></b> for building ' +
      'AF_XDP applications, and <b><code>liburing</code></b> for io_uring — all lower-level than DPDK, which instead takes exclusive ' +
      'ownership of the NIC away from the kernel entirely via <code>uio</code>/<code>vfio-pci</code>.</p></div>',
      try: [
        ['📖 Kernel docs — AF_XDP', 'https://docs.kernel.org/networking/af_xdp.html', 'o'],
        ['📖 Kernel docs — io_uring', 'https://kernel.dk/io_uring.pdf', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>An XDP drop program for DDoS mitigation.</b> A public-facing ' +
      'edge node is being flooded with a volumetric UDP attack that saturates CPU in the normal network stack path before iptables ever ' +
      'gets a chance to drop the traffic — by the time a packet reaches netfilter, the cost of getting it there is already paid. Fix: an ' +
      'XDP program attached in native (driver) mode inspects and drops matching packets before they are even allocated an ' +
      '<code>sk_buff</code>, at a small fraction of the per-packet cost of the full stack, buying real headroom during the attack.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>AF_XDP vs DPDK for a packet-processing pipeline.</b> A team ' +
      'building a custom packet pipeline wants kernel-bypass speed but also needs to share the NIC with normal kernel-managed traffic on ' +
      'other queues, and wants to keep using standard Linux tooling for the rest of the box. Fix: AF_XDP fits this better than DPDK — ' +
      'AF_XDP coexists with the kernel driver model (only specific queues are diverted to userspace), whereas DPDK takes the whole NIC ' +
      'away from the kernel, which is right for a dedicated packet-processing appliance but wrong when the NIC needs to serve mixed ' +
      'traffic.</p></div>' +
      '<p><b>io_uring for a high-throughput storage service</b> is a related but distinct win: it is not about bypassing the kernel, but ' +
      'about eliminating the per-operation syscall overhead of traditional blocking or even <code>epoll</code>-based I/O by batching ' +
      'submissions and completions through shared ring buffers.</p>',
      try: [
        ['📖 Kernel docs — XDP', 'https://docs.kernel.org/networking/af_xdp.html', 'o'],
        ['🐧 Ch 10 — interrupt handling & softirq tuning', '#ch10', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Reaching for full DPDK when only a           AF_XDP or plain XDP often gets most of the win while staying\n' +
      '  packet filter/drop decision is needed        inside the kernel driver model and standard tooling.\n' +
      'Attaching XDP in generic (SKB) mode           Generic mode still allocates an sk_buff before running the XDP\n' +
      '  and expecting native-mode performance         program -- confirm native/driver mode support for real gains.\n' +
      'Diverting all NIC queues to AF_XDP/DPDK       Isolate specific RX/TX queues (ethtool -L, RSS/flow steering) so\n' +
      '  and losing normal kernel networking            unrelated kernel-managed traffic on the same NIC keeps working.\n' +
      'Assuming kernel bypass always wins            At moderate packet rates, the normal stack\'s features (routing,\n' +
      '  regardless of packet rate                     netfilter, TCP) are usually not the bottleneck -- bypass adds\n' +
      '                                                real complexity that only pays off at genuinely high PPS.\n' +
      'Ignoring polling CPU cost of a busy-poll       AF_XDP/DPDK userspace polling loops consume a full CPU core\n' +
      '  userspace network stack                        continuously, whether or not packets are arriving.\n' +
      'Deploying an XDP drop program without         An XDP program that blocks legitimate traffic during a\n' +
      '  a tested rollback path                        misconfiguration is much harder to reason about mid-incident\n' +
      '                                                than an iptables rule -- test the detach path in advance.</code></pre>' +
      '<p><b>The real test:</b> before reaching for kernel bypass, can you show with actual packet-rate and latency measurements that ' +
      'the standard network stack — not application logic, not the NIC itself — is the bottleneck?</p>',
      try: [
        ['📖 man7.org — io_uring(7)', 'https://man7.org/linux/man-pages/man7/io_uring.7.html', 'o'],
        ['🐧 Ch 9 — syscall tracing & auditing', '#ch9', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, kernel bypass is a spectrum, not a binary choice: XDP for cheap in-driver filter/drop/redirect decisions ' +
      'while keeping the full kernel stack for everything else; AF_XDP when userspace needs raw frames on specific queues but the box ' +
      'still needs to behave like a normal Linux host; and full DPDK/vfio-pci only when the NIC can be dedicated entirely to one ' +
      'userspace application. io_uring solves an adjacent but different problem — syscall-overhead reduction for any high-throughput ' +
      'I/O, not just networking. Expert practice picks the least invasive technique that actually removes the measured bottleneck.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is an XDP-based drop decision so much cheaper than an equivalent iptables rule under a packet flood?\n' +
      'A: XDP runs at the NIC driver level, before an sk_buff is even allocated for the packet. An iptables\n' +
      "   rule only sees the packet after it has already traveled most of the kernel's normal network stack path,\n" +
      '   so by the time it is dropped, most of the per-packet cost is already paid.\n\n' +
      'Q: When would you choose AF_XDP over full DPDK for a custom packet pipeline?\n' +
      'A: When the NIC needs to keep serving normal kernel-managed traffic on other queues, or when you want\n' +
      "   to stay within the kernel's driver model and standard tooling -- AF_XDP diverts specific queues to\n" +
      '   userspace while DPDK takes the entire NIC away from the kernel.\n\n' +
      'Q: What problem does io_uring solve that is distinct from kernel-bypass networking?\n' +
      'A: io_uring reduces per-operation syscall overhead for any high-throughput I/O (disk or network) via\n' +
      '   shared submission/completion ring buffers -- it stays fully in the kernel\'s normal I/O path, it just\n' +
      '   batches interaction with it, unlike XDP/AF_XDP which skip stack processing entirely.\n\n' +
      'Q: Why might XDP attached in "generic" (SKB) mode fail to deliver the expected performance gain?\n' +
      'A: Generic mode runs the XDP program after an sk_buff has already been allocated by the normal stack --\n' +
      '   it provides the same programming API but without native mode\'s pre-allocation performance benefit,\n' +
      "   often used as a fallback when the NIC driver lacks native XDP support.\n\n" +
      'Q: What is the real cost of an AF_XDP/DPDK busy-poll userspace network loop?\n' +
      'A: It dedicates a full CPU core to continuous polling regardless of whether packets are arriving,\n' +
      '   trading CPU efficiency for minimal packet latency -- a real cost that must be weighed against the\n' +
      '   throughput/latency gain for the specific workload.</code></pre>',
      try: [
        ['📖 Kernel docs — AF_XDP', 'https://docs.kernel.org/networking/af_xdp.html', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is dropping a packet via an XDP program dramatically cheaper than dropping the same packet via an iptables rule under a volumetric flood?',
      opts: [
        'iptables rules are always evaluated twice',
        'XDP runs at the NIC driver level before an sk_buff is allocated, while an iptables rule only sees the packet after it has already traveled most of the normal kernel network stack path',
        'XDP programs run on a separate physical CPU core dedicated to networking',
        'iptables only works with IPv4, so IPv6 floods bypass it entirely'],
      ok: 1,
      why: 'The cost of a packet traversing the kernel network stack is paid well before netfilter/iptables sees it. XDP intercepts at the driver level, before that cost is incurred, making an early drop decision far cheaper per packet.' },
    { q: 'When would AF_XDP be preferred over full DPDK for a custom packet-processing pipeline?',
      opts: [
        'AF_XDP is always strictly faster than DPDK in every scenario',
        'When the NIC needs to continue serving normal kernel-managed traffic on other queues, since AF_XDP diverts only specific queues to userspace while DPDK takes over the entire NIC',
        'When the application does not need any performance improvement',
        'AF_XDP and DPDK are interchangeable names for the same technology'],
      ok: 1,
      why: 'DPDK claims the whole NIC via vfio-pci/uio, removing it from kernel management entirely -- appropriate for a dedicated appliance. AF_XDP instead diverts specific queues while the kernel driver model and other queues keep working normally.' },
    { q: 'What distinct problem does io_uring solve, compared to XDP/AF_XDP kernel-bypass networking?',
      opts: [
        'io_uring is just another name for AF_XDP',
        'io_uring reduces per-operation syscall overhead for high-throughput I/O generally (disk and network) via shared ring buffers, while still going through the kernel\'s normal I/O path rather than bypassing it',
        'io_uring only works for network sockets, never for disk I/O',
        'io_uring replaces the need for an I/O scheduler entirely'],
      ok: 1,
      why: 'io_uring is an async I/O interface that batches submissions and completions to cut syscall overhead -- it stays within the kernel\'s I/O path, unlike XDP/AF_XDP which skip normal network-stack processing for specific traffic.' }
  ]
};
