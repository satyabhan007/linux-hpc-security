/* linux-hpc-security Learn — Part 2 · Chapter 14: Container vs VM Kernel Isolation Tradeoffs */
window.CH[14] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A new kernel privilege-escalation CVE is announced. For hosts running virtual machines, the security team says "your ' +
      'workloads are isolated from each other regardless, patch on the normal schedule." For hosts running containers on shared hosts, ' +
      'the same team says "patch now, this is critical" — because containers share far more with the host and each other than a VM ' +
      'ever does, even though both look like "isolated environments" from the outside.</p>' +
      '<pre><code>VM:        Guest OS + kernel  ->  hypervisor  ->  host kernel   (two kernel boundaries between tenants)\n' +
      'Container: Just a process     ->  namespaces/cgroups  ->  host kernel   (one shared kernel between tenants)</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Separate houses versus separate rooms in one house.</b> Each ' +
      'house (VM) has its own foundation, plumbing, and walls — a fire in one does not directly threaten the other. Rooms in one house ' +
      '(containers) share the same foundation and plumbing; a structural problem with the house itself (the shared host kernel) affects ' +
      'every room, no matter how good the doors between them are.</p></div>',
      try: [
        ['📖 Kernel docs — Namespaces overview', 'https://man7.org/linux/man-pages/man7/namespaces.7.html', 'o'],
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A <b>container</b> is a normal process isolated by kernel <b>namespaces</b> (PID, network, mount, UTS, IPC, user) and ' +
      'resource-limited by <b>cgroups</b> — all containers on a host share one kernel. A <b>VM</b> runs its own complete guest kernel on ' +
      'top of a <b>hypervisor</b> (KVM/QEMU), giving genuine hardware-enforced isolation between guests. <b>gVisor</b> and <b>Kata ' +
      'Containers</b> sit in between: gVisor intercepts syscalls in a userspace kernel shim, Kata runs each "container" inside a ' +
      'lightweight VM.</p>' +
      '<pre><code># see the namespaces a container process is actually using\n' +
      '$ lsns -p &lt;container-pid&gt;\n' +
      '        NS TYPE   NPROCS   PID USER    COMMAND\n' +
      '4026532345 net          3 12345 root    nginx: master\n\n' +
      '# confirm two containers DO share the host kernel (same uname -r inside both)\n' +
      '$ docker exec container1 uname -r\n' +
      '$ docker exec container2 uname -r        # identical -- same kernel, unlike separate VMs\n\n' +
      '# run a container inside a lightweight VM instead, via Kata\n' +
      '$ ctr run --runtime io.containerd.kata.v2 ...\n\n' +
      '# gVisor: run a container through its userspace kernel shim (runsc)\n' +
      '$ docker run --runtime=runsc -it untrusted-image</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard building blocks are Linux ' +
      '<b><code>namespaces</code>/<code>cgroups</code></b> (containers), <b>KVM/QEMU</b> (VMs), with ' +
      '<b><code>gVisor</code> (runsc)</b> and <b><code>Kata Containers</code></b> as the standard sandboxed-container runtimes for ' +
      'multi-tenant, untrusted-workload scenarios that want container-like ergonomics with stronger isolation.</p></div>',
      try: [
        ['📖 man7.org — namespaces(7)', 'https://man7.org/linux/man-pages/man7/namespaces.7.html', 'o'],
        ['📖 gVisor docs — Architecture Guide', 'https://gvisor.dev/docs/architecture_guide/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Choosing gVisor for a multi-tenant, untrusted workload.</b> A ' +
      'platform team needs to run customer-submitted code (untrusted, arbitrary) alongside internal services on shared infrastructure, ' +
      'and a full VM per customer job is too slow to spin up for short-lived jobs while a plain container is too weak an isolation ' +
      'boundary for genuinely untrusted code. Fix: run untrusted jobs under <b>gVisor</b>, which intercepts syscalls in a userspace ' +
      '"sentry" process instead of passing them straight to the host kernel — reducing the host kernel\'s attack surface exposed to the ' +
      'untrusted workload, at some performance cost, without paying full VM boot/overhead cost.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A kernel CVE that only affects containers, not VMs.</b> A ' +
      'namespace-related privilege-escalation CVE is announced. Hosts running plain containers on a shared kernel are directly exposed — ' +
      'a compromised container could potentially escalate to the host kernel itself. Hosts running the equivalent workloads inside VMs ' +
      'are exposed only if the hypervisor itself has a matching flaw, which is a separate and typically much narrower attack surface — ' +
      'the same CVE announcement requires a "patch immediately" response on one fleet and a "normal cadence" response on the other.</p></div>' +
      '<p><b>The container-escape blast-radius conversation:</b> a successful container escape on a shared-kernel host can potentially ' +
      'reach every other container on that host and the host itself; a successful VM guest-kernel compromise is contained to that guest ' +
      'unless it also finds a hypervisor escape — a categorically rarer and more valuable class of vulnerability.</p>',
      try: [
        ['📖 Kata Containers docs — Architecture', 'https://katacontainers.io/learn/', 'o'],
        ['🐧 Ch 4 — cgroups v2 resource control', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                                FIX\n' +
      'Treating "containerized" and "isolated"      Containers share one kernel -- isolation is namespace/cgroup-\n' +
      '  as synonymous for security purposes           enforced software boundaries, not hardware-enforced like a VM.\n' +
      'Running genuinely untrusted, multi-tenant     Use gVisor or Kata for untrusted code -- plain containers assume\n' +
      '  code in plain containers "for speed"           a baseline trust level a VM-like boundary does not require.\n' +
      'Applying the same CVE urgency policy to      A kernel-namespace CVE is far more urgent for shared-kernel\n' +
      '  container hosts and VM hosts uniformly        container hosts than for VM hosts, where the hypervisor is a\n' +
      '                                                separate, narrower attack surface.\n' +
      'Assuming gVisor/Kata have zero performance    Both trade some performance (syscall interception overhead for\n' +
      '  cost versus plain containers                  gVisor; VM boot/memory overhead for Kata) for isolation --\n' +
      '                                                measure the actual cost for your workload before adopting.\n' +
      'Ignoring shared-kernel resource contention    Even with perfect namespace isolation, containers still share\n' +
      '  as a form of isolation failure                 the host\'s CPU scheduler, page cache, and I/O subsystem --\n' +
      '                                                cgroups (Ch 4) address this, namespaces do not.\n' +
      'Choosing isolation level based on habit      Match isolation mechanism to actual trust boundary: internal\n' +
      '  rather than the workload\'s actual trust level  microservices vs untrusted third-party code need different answers.</code></pre>' +
      '<p><b>The real test:</b> for a specific multi-tenant workload, can you name the exact isolation boundary being relied on — ' +
      'namespaces+cgroups, a userspace syscall shim, or a full hypervisor — and whether that boundary actually matches the trust level of ' +
      'the code running inside it?</p>',
      try: [
        ['📖 man7.org — namespaces(7)', 'https://man7.org/linux/man-pages/man7/namespaces.7.html', 'o'],
        ['🐧 Ch 9 — syscall tracing & auditing', '#ch9', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, container-vs-VM is not a single decision but a spectrum matched per workload: plain containers for trusted, ' +
      'internally-authored services where the shared-kernel tradeoff is acceptable; gVisor/Kata for untrusted or lower-trust code that ' +
      'needs container-like density and startup speed with a narrower host-kernel attack surface; full VMs where hardware-enforced ' +
      'isolation is a hard requirement (regulatory, genuinely adversarial multi-tenancy). The right architecture uses more than one of ' +
      'these simultaneously, applied by trust boundary, not applied uniformly by default.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why does a kernel privilege-escalation CVE typically demand faster patching on container hosts than VM hosts?\n' +
      'A: Containers on one host share a single kernel, so a namespace/cgroup-related privilege-escalation flaw is\n' +
      "   directly reachable from any container on that host. VM guests each run their own kernel; reaching the\n" +
      '   host from inside a guest additionally requires a separate hypervisor escape, a narrower attack surface.\n\n' +
      'Q: How does gVisor reduce the host kernel\'s attack surface compared to a plain container?\n' +
      'A: gVisor intercepts a sandboxed process\'s syscalls in a userspace "sentry" component instead of passing\n' +
      '   them directly to the host kernel, re-implementing much of the kernel interface in userspace -- reducing\n' +
      '   (not eliminating) what surface of the real host kernel is exposed to untrusted code.\n\n' +
      'Q: How does Kata Containers differ architecturally from gVisor, despite both targeting the same use case?\n' +
      'A: Kata runs each "container" inside its own lightweight, hardware-virtualized VM with a real guest kernel,\n' +
      "   closer to full VM isolation with container-like tooling/ergonomics. gVisor instead uses a userspace\n" +
      '   syscall-interception shim without a separate guest kernel or hardware virtualization boundary.\n\n' +
      'Q: Why is "the container escaped" a categorically different severity event than "the VM guest kernel was compromised"?\n' +
      'A: A container escape on a shared-kernel host can potentially reach the host and every other container on\n' +
      '   it directly. A VM guest-kernel compromise is contained to that guest unless a separate hypervisor escape\n' +
      '   is also found -- a rarer, higher-value, and typically much harder class of vulnerability.\n\n' +
      'Q: Why might a platform choose different isolation mechanisms for different workloads on the same fleet?\n' +
      'A: Isolation mechanism should match the actual trust level of the code: internally-authored trusted\n' +
      "   services can accept the shared-kernel tradeoff of plain containers for density and speed, while\n" +
      '   untrusted or third-party code warrants gVisor/Kata/full-VM boundaries despite the added overhead.</code></pre>',
      try: [
        ['📖 gVisor docs — Architecture Guide', 'https://gvisor.dev/docs/architecture_guide/', 'o'],
        ['🐧 Ch 16 — the kernel performance platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why does a kernel namespace-related privilege-escalation CVE typically require more urgent patching on container hosts than on VM hosts?',
      opts: [
        'Containers are always less secure than VMs in every respect, with no exceptions',
        'Containers on a host share a single kernel, so a namespace-related flaw is directly reachable from any container on that host, while a VM guest would additionally need a separate hypervisor escape to reach the host',
        'VM hosts do not run the Linux kernel at all',
        'Container hosts cannot receive kernel patches without a full reinstall'],
      ok: 1,
      why: 'Shared-kernel architecture means all containers on a host are exposed to a host-kernel flaw simultaneously. A VM guest kernel compromise stays contained to that guest unless a separate, rarer hypervisor-level escape is also found.' },
    { q: 'How does gVisor reduce a sandboxed workload\'s exposure to the host kernel compared to a plain container?',
      opts: [
        'It runs the workload inside a full hardware-virtualized VM like Kata does',
        'It intercepts the sandboxed process\'s syscalls in a userspace component ("sentry") and re-implements much of the kernel interface there, reducing what surface of the real host kernel is directly exposed',
        'It disables all syscalls entirely, so the workload cannot function',
        'It requires the workload to run as a privileged user, increasing exposure'],
      ok: 1,
      why: 'gVisor\'s userspace syscall-interception layer stands between the sandboxed process and the real host kernel, narrowing (though not eliminating) the host kernel surface an untrusted workload can directly reach.' },
    { q: 'Why might a platform team deliberately use different isolation mechanisms (plain containers, gVisor/Kata, full VMs) for different workloads on the same fleet rather than one mechanism everywhere?',
      opts: [
        'Because Kubernetes requires using all three mechanisms simultaneously for every deployment',
        'Because the appropriate isolation boundary should match the actual trust level of the code -- trusted internal services can accept a shared-kernel tradeoff for density, while untrusted or third-party code warrants a stronger boundary',
        'Because plain containers are being deprecated and will soon be unsupported',
        'Because full VMs are always strictly better and should be preferred whenever resources allow'],
      ok: 1,
      why: 'Isolation is a tradeoff between overhead and blast radius. Matching the isolation mechanism to each workload\'s actual trust level lets a platform get container-like density for trusted code and stronger boundaries only where untrusted code actually needs them.' }
  ]
};
