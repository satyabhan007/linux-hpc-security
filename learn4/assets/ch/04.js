/* linux-hpc-security Learn — Part 4 · Chapter 4: Kernel Hardening — Lockdown Mode & Security-Relevant sysctls */
window.CH[4] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>"Root can do anything" is true by design on a stock Linux kernel — including reading arbitrary kernel memory, loading an ' +
      'unsigned kernel module, or writing to <code>/dev/mem</code>. That is fine until root is not you, it is an attacker who escalated ' +
      'from a compromised service account. Kernel lockdown mode is the line drawn between "root the administrator" and "root the ' +
      'attacker who wants to install a rootkit that survives a reboot".</p>' +
      '<pre><code>root = unconditionally trusted             →     root = trusted for administration, but kernel\n' +
      '  (can load any module, read any memory)             lockdown still blocks rootkit-class actions</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A hotel master key vs. a fire-control panel behind separate glass.</b> ' +
      'A master key opens every guest room — that is its job. But even the hotel manager with the master key still needs a special, ' +
      'logged override to touch the fire-suppression system, because that one system is too dangerous to leave behind a key that already ' +
      'opens everything else.</p></div>',
      try: [
        ['📖 Kernel.org — Kernel Lockdown documentation', 'https://docs.kernel.org/admin-guide/kernel-lockdown.html', 'o'],
        ['🛡️ Ch 3 — SELinux & AppArmor policy authoring', '#ch3', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>Lockdown mode has two levels — <b>integrity</b> (blocks modifying the running kernel, e.g. unsigned module loading, ' +
      '<code>/dev/mem</code> writes) and <b>confidentiality</b> (adds blocking of anything that could leak kernel memory, e.g. ' +
      '<code>kexec</code> without signature, most of <code>/proc/kcore</code>). It is paired with a set of hardening sysctls that close ' +
      'related information-disclosure paths:</p>' +
      '<pre><code># check/set lockdown mode (persistent form: kernel cmdline "lockdown=integrity")\n' +
      '$ cat /sys/kernel/security/lockdown\n' +
      'none [integrity] confidentiality\n\n' +
      '# security-relevant sysctls, set via /etc/sysctl.d/99-hardening.conf\n' +
      'kernel.kptr_restrict = 2        # hide kernel pointers from /proc even from privileged reads\n' +
      'kernel.dmesg_restrict = 1       # require CAP_SYSLOG to read the kernel ring buffer\n' +
      'kernel.yama.ptrace_scope = 1    # restrict ptrace to direct child processes only\n' +
      'kernel.unprivileged_bpf_disabled = 1   # require CAP_SYS_ADMIN/CAP_BPF for eBPF program loading\n\n' +
      '$ sysctl --system                # apply all sysctl.d files\n' +
      '$ sysctl kernel.kptr_restrict    # verify a specific value</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard baseline is the <b>DISA STIG / CIS kernel hardening ' +
      'section</b> encoded as a <code>sysctl.d</code> drop-in applied by config management, plus <b>lockdown=integrity</b> (or ' +
      '<code>confidentiality</code> for the highest-assurance fleets) set on the kernel command line via <code>grub2-mkconfig</code>, ' +
      'since lockdown mode itself is not a runtime-toggleable sysctl on most distributions.</p></div>',
      try: [
        ['📖 Kernel.org — sysctl documentation', 'https://docs.kernel.org/admin-guide/sysctl/kernel.html', 'o'],
        ['📖 Madaidan / kernel hardening guidance references', 'https://kernsec.org/wiki/index.php/Kernel_Self_Protection_Project', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Lockdown mode breaks a legitimate debug tool.</b> A fleet ' +
      'enables <code>lockdown=confidentiality</code> and the performance team\'s <code>perf</code>-based profiler stops working because ' +
      'it needs raw access to kernel symbols that confidentiality mode hides. Fix: this is usually the RIGHT tradeoff, not a bug to route ' +
      'around — provide a separate, tightly-scoped debug/lab tier with lockdown relaxed (or disabled) instead of weakening the ' +
      'production-fleet setting to accommodate one team\'s workflow.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The sysctl that got reset by a config drift.</b> A kernel ' +
      'package update ships a new default and a subsequent reboot silently reverts <code>kernel.yama.ptrace_scope</code> to 0 because ' +
      'the drop-in file ordering changed. Fix: sysctl hardening needs to be verified on every boot (or scanned continuously, Ch 1/13), ' +
      'not just applied once — a config-management run that "sets and forgets" a kernel sysctl is exactly the drift pattern that makes ' +
      'continuous compliance scanning necessary in the first place.</p></div>' +
      '<p><b>Lockdown and MAC (SELinux/AppArmor) are complementary, not redundant:</b> MAC confines what a process can touch through ' +
      'normal syscalls; lockdown closes off entire classes of kernel-level actions regardless of MAC policy, including from root itself.</p>',
      try: [
        ['📖 Kernel Self Protection Project — wiki', 'https://kernsec.org/wiki/index.php/Main_Page', 'o'],
        ['🛡️ Ch 1 — DISA STIG automation at fleet scale', '#ch1', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Kernel hardening sysctls set once at        Re-verify (or continuously scan) sysctl values on every boot —\n' +
      '  image build, never re-checked               package updates and drift can silently reset defaults.\n' +
      'Relaxing lockdown mode fleet-wide            Carve out a separate, tightly-scoped debug/lab tier instead of\n' +
      '  because one debug tool needs raw access      weakening the production-fleet security posture for one workflow.\n' +
      'Treating lockdown mode as redundant with     Layer them — lockdown blocks kernel-level actions (even for root)\n' +
      '  SELinux/AppArmor confinement                 that MAC policy does not address, and vice versa.\n' +
      'Setting kernel.unprivileged_bpf_disabled     Test observability/eBPF-based tooling (Ch 8) against the hardened\n' +
      '  without checking eBPF-based tooling first    setting BEFORE fleet-wide rollout, not after it breaks monitoring.\n' +
      'Enabling confidentiality-level lockdown on   Roll out integrity mode first, validate for a burn-in period, THEN\n' +
      '  the whole fleet in one change                move to confidentiality — the two levels break different things.\n' +
      'No documented mapping from sysctl to CVE     Tie each hardening sysctl to the specific class of attack it closes\n' +
      '  class / attack class it mitigates            off, so a future engineer knows the cost of reverting it.</code></pre>' +
      '<p><b>The real test:</b> if you disabled every kernel hardening sysctl on one canary node right now, could you name — without ' +
      'looking anything up — the specific attack technique each one you just re-enabled was blocking?</p>',
      try: [
        ['📖 Kernel.org — admin guide index', 'https://docs.kernel.org/admin-guide/index.html', 'o'],
        ['🛡️ Ch 8 — intrusion detection: auditd & eBPF-based sensors', '#ch8', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, kernel hardening is about narrowing the gap between "has root" and "controls the kernel" — historically the ' +
      'same thing on Linux, and a major reason a single privilege-escalation bug could turn into a persistent, undetectable rootkit. ' +
      'Lockdown mode and the associated sysctls do not stop an attacker from gaining root; they stop root (legitimate or attacker-held) ' +
      'from doing the specific things a rootkit needs to do — loading unsigned code into the kernel, reading arbitrary kernel memory, or ' +
      'writing to physical memory directly.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What is the difference between kernel lockdown\'s "integrity" and "confidentiality" modes?\n' +
      'A: Integrity mode blocks actions that could MODIFY the running kernel (unsigned module loading,\n' +
      '   /dev/mem writes). Confidentiality mode includes everything integrity does, plus actions that could\n' +
      "   LEAK kernel memory contents (e.g. most of /proc/kcore, unsigned kexec) — it's the stricter tier.\n\n" +
      'Q: Why does lockdown mode matter even for a host with strong SELinux/AppArmor policy already in place?\n' +
      'A: MAC policy confines what a confined process can do through normal syscalls; lockdown blocks entire\n' +
      '   classes of kernel-level actions independent of MAC policy — including actions available to root\n' +
      '   itself, which is often outside what MAC alone restricts.\n\n' +
      'Q: kernel.yama.ptrace_scope is set to 1 fleet-wide. What does this actually restrict, and why does it\n' +
      '   matter for security?\n' +
      'A: It restricts ptrace to a process\'s direct children only, preventing one process from attaching to\n' +
      '   and reading the memory of an unrelated process — closing a common credential/secret-scraping\n' +
      '   technique used after an initial compromise.\n\n' +
      'Q: A performance team\'s profiling tool breaks after enabling lockdown=confidentiality. What is the\n' +
      '   right response?\n' +
      'A: Usually NOT to relax lockdown fleet-wide — provide a separate, scoped debug/lab tier with relaxed\n' +
      '   settings instead, so the production security posture is not weakened for one workflow\'s convenience.\n\n' +
      'Q: Why must hardening sysctls be continuously verified rather than applied once at image build?\n' +
      "A: Package updates, reboots, and config-management drift can silently reset a sysctl to its distro\n" +
      '   default; without continuous verification (or scanning, Ch 1/13) the fleet can drift out of its\n' +
      '   intended hardened state without anyone noticing.</code></pre>',
      try: [
        ['📖 Kernel.org — Kernel Lockdown documentation', 'https://docs.kernel.org/admin-guide/kernel-lockdown.html', 'o'],
        ['🛡️ Ch 9 — file integrity monitoring & host-based intrusion prevention', '#ch9', 'o']
      ] }
  ],

  quiz: [
    { q: 'What is the key difference between kernel lockdown "integrity" mode and "confidentiality" mode?',
      opts: [
        'They are identical; "confidentiality" is just a legacy name',
        'Integrity mode blocks actions that could modify the running kernel; confidentiality mode additionally blocks actions that could leak kernel memory contents',
        'Confidentiality mode only affects network traffic, not the kernel',
        'Integrity mode is stricter than confidentiality mode'],
      ok: 1,
      why: 'Confidentiality mode is the stricter superset — it includes integrity mode\'s modification-blocking plus additional protection against kernel memory disclosure.' },
    { q: 'A fleet-wide performance profiling tool breaks after enabling lockdown=confidentiality. What is the recommended response?',
      opts: [
        'Disable lockdown mode fleet-wide to restore the tool',
        'Provide a separate, tightly-scoped debug/lab tier with relaxed lockdown settings instead of weakening the production fleet\'s posture',
        'Ignore the profiling team\'s tooling needs entirely going forward',
        'Switch every host back to lockdown=none permanently'],
      ok: 1,
      why: 'The tradeoff of lockdown breaking certain low-level tools is usually the correct one for production; carving out a separate debug environment preserves both the security posture and the workflow.' },
    { q: 'Why must kernel hardening sysctls (like kernel.kptr_restrict) be continuously verified rather than set once at image build time?',
      opts: [
        'sysctls automatically revert every 24 hours regardless of configuration',
        'Package updates, reboots, and configuration drift can silently reset a sysctl to its distro default, so continuous verification is needed to catch it',
        'sysctl values cannot be persisted across reboots under any circumstances',
        'This is not actually necessary — image-build-time settings are permanent'],
      ok: 1,
      why: 'Like STIG/CIS controls, kernel hardening sysctls are subject to drift from updates and configuration changes, so they need the same continuous-verification treatment as any other compliance control.' }
  ]
};
