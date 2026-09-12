/* linux-hpc-security Learn — Part 4 · Chapter 3: SELinux & AppArmor Policy Authoring */
window.CH[3] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A new service throws a permission error, someone Googles it, and the top answer is <code>setenforce 0</code>. The error goes ' +
      'away. So does every last shred of mandatory access control on that host — a compromised process can now read, write, or execute ' +
      'anything the Linux DAC permissions allow, which for a misconfigured service account is often "far too much".</p>' +
      '<pre><code>"setenforce 0" to make the error go away   →   Read the AVC denial, understand WHY SELinux blocked\n' +
      '  (turns off confinement fleet-wide)             it, and write a policy that allows exactly that action</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A guard dog that barks at the mail carrier vs. removing the dog ' +
      'entirely.</b> The easy fix for a false alarm is to get rid of the dog — now nothing barks at anyone, ever again, mail carrier or ' +
      'burglar. The right fix is to teach the dog the mail carrier is fine, while it keeps barking at everyone else.</p></div>',
      try: [
        ['📖 SELinux Project — documentation', 'https://selinuxproject.org/page/Main_Page', 'o'],
        ['📖 AppArmor — official wiki', 'https://gitlab.com/apparmor/apparmor/-/wikis/home', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>SELinux confines a process to a <b>type</b> (its security context) and only allows the specific interactions a policy defines. ' +
      'When something is denied, the kernel logs an <b>AVC</b> (Access Vector Cache) denial; that denial is the raw material for a targeted ' +
      'policy fix instead of a blanket permissive mode:</p>' +
      '<pre><code># find recent denials and turn them into a reviewable custom policy module\n' +
      '$ ausearch -m avc -ts recent | audit2allow -M myapp_extra\n' +
      '$ semodule -i myapp_extra.pp                      # load the compiled module\n\n' +
      '# label a nonstandard file/directory instead of writing a policy exception around it\n' +
      '$ semanage fcontext -a -t httpd_sys_content_t "/srv/webapp(/.*)?"\n' +
      '$ restorecon -Rv /srv/webapp\n\n' +
      '# flip a single documented boolean rather than disabling enforcement\n' +
      '$ setsebool -P httpd_can_network_connect on</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard workflow is <b><code>audit2allow</code></b> ' +
      'to draft a module from real denials, <b><code>semanage</code></b>/<code>restorecon</code> for file contexts, and ' +
      '<b><code>setsebool</code></b> for the documented policy knobs — reviewing every generated <code>.te</code> rule before ' +
      'loading it with <b><code>semodule</code></b>. AppArmor\'s equivalent is a profile in <code>/etc/apparmor.d/</code> built ' +
      'iteratively in <b>complain mode</b> with <code>aa-logprof</code> before switching to <b>enforce</b>.</p></div>',
      try: [
        ['📖 SELinux — audit2allow man page', 'https://man7.org/linux/man-pages/man1/audit2allow.1.html', 'o'],
        ['📖 AppArmor — profile authoring guide', 'https://gitlab.com/apparmor/apparmor/-/wikis/QuickProfileLanguage', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The audit2allow rule that was too generous.</b> An engineer ' +
      'pipes every AVC denial from a busy service straight into <code>audit2allow -M</code> and loads the result without reading it — ' +
      'the generated module grants the service <code>domain_admin</code>-style broad access because the denial log included some ' +
      'debug-tool noise. Fix: <code>audit2allow</code> output is a draft, not policy; every generated rule gets read line-by-line and ' +
      'narrowed to the specific type/class/permission actually needed before it ships.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The AVC denial in production that "must be fixed now".</b> ' +
      'A payment service starts throwing 500s after a deploy and SELinux denials are in the log — the on-call instinct is ' +
      '<code>setenforce 0</code> to unblock revenue immediately. Fix: use <code>setenforce 0</code> only to CONFIRM SELinux is the ' +
      'cause (then immediately back to enforcing), diagnose the real denial, and ship a targeted policy module or fcontext fix — a ' +
      'production host left permissive "just for now" routinely stays permissive for months.</p></div>' +
      '<p><b>Confinement is the point, not the annoyance:</b> a service that never generates an AVC denial in its whole lifecycle is ' +
      'either perfectly profiled or has never been tested against its real workload — treat a clean audit log with suspicion, not relief.</p>',
      try: [
        ['📖 Red Hat — SELinux troubleshooting guide', 'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/using_selinux/index', 'o'],
        ['🛡️ Ch 8 — auditd & eBPF-based intrusion detection', '#ch8', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      '"setenforce 0" (or "Enforcing=0" at boot)    Diagnose the specific AVC denial and write a targeted module or\n' +
      '  to silence a denial permanently             fcontext fix; use permissive mode only as a temporary diagnostic.\n' +
      'Loading raw audit2allow output unread        Read every generated rule; narrow overly broad grants (e.g. an\n' +
      '                                             entire domain\'s permissions) down to what the denial actually needs.\n' +
      'Fixing a mislabeled file by writing a         Relabel the file/path correctly with semanage fcontext + restorecon —\n' +
      '  policy exception around the wrong label      a policy exception for a labeling mistake hides the real bug.\n' +
      'AppArmor profile shipped straight to           Build it iteratively in complain mode with aa-logprof against real\n' +
      '  enforce mode, untested                       traffic, then flip to enforce once the profile is quiet.\n' +
      'One giant custom policy module for an          Split policy by function/service; a monolithic module makes it\n' +
      '  entire fleet\'s worth of services              impossible to tell which service actually needs which rule.\n' +
      'No process for reviewing new SELinux/          Custom modules and profiles go through the same code review as\n' +
      '  AppArmor modules before deploy                any other change — a bad rule is a security regression, not a config tweak.</code></pre>' +
      '<p><b>The real test:</b> can you explain, in one sentence, why EVERY rule in your custom policy module exists — which specific ' +
      'denial it fixes? If a rule is there "just in case", it is a gap waiting to be exploited, not a safety margin.</p>',
      try: [
        ['📖 SELinux Project — policy language reference', 'https://selinuxproject.org/page/PolicyLanguage', 'o'],
        ['🛡️ Ch 9 — file integrity monitoring & host-based intrusion prevention', '#ch9', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, policy authoring is a <b>least-privilege modeling</b> exercise: SELinux types and AppArmor profiles are ' +
      'a formal description of exactly what a process should be able to touch, and every denial is either evidence the model is too ' +
      'tight (a legitimate action needs a new rule) or evidence something abnormal is happening (an exploited process trying to do ' +
      'something it was never designed to do). Confusing those two — reflexively "fixing" every denial — destroys the detective value ' +
      'of the policy along with the preventive value.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is "setenforce 0" a dangerous permanent fix for an AVC denial?\n' +
      "A: It disables SELinux's mandatory access control fleet-wide (or host-wide), not just for the one\n" +
      '   denial you saw — any process on that host, including a compromised one, now operates under plain\n' +
      '   DAC permissions with no confinement at all.\n\n' +
      'Q: You just ran audit2allow and it generated a module. What do you do before loading it?\n' +
      'A: Read every generated rule line-by-line and narrow it — audit2allow drafts the broadest rule that\n' +
      '   would silence the denial, which is often far more permissive than the service actually needs.\n\n' +
      'Q: A file is being denied access even though the permissions (owner/group/mode) look correct. What do\n' +
      '   you check first?\n' +
      'A: Its SELinux label with `ls -Z`/`stat` — a mislabeled file (wrong type) is denied by SELinux\n' +
      "   regardless of correct DAC permissions; fix the label with semanage fcontext + restorecon rather\n" +
      '   than writing a policy exception around a labeling mistake.\n\n' +
      'Q: How should you introduce a new AppArmor profile to a production service?\n' +
      'A: Load it in complain mode first, run real traffic through it, refine with aa-logprof until it is\n' +
      '   quiet, then switch to enforce — shipping straight to enforce risks blocking legitimate behavior\n' +
      '   nobody tested for.\n\n' +
      'Q: Should a completely clean SELinux audit log (zero denials, ever) make you confident the policy is\n' +
      '   well-tuned?\n' +
      'A: Not by itself — it could also mean the service has never been exercised against its full real\n' +
      '   workload, or that denials are being silently dropped/ignored somewhere in the pipeline.</code></pre>',
      try: [
        ['📖 NSA — SELinux origins & background', 'https://www.nsa.gov/what-we-do/research/selinux/', 'o'],
        ['🛡️ Ch 4 — kernel hardening: lockdown mode & security-relevant sysctls', '#ch4', 'o']
      ] }
  ],

  quiz: [
    { q: 'A service throws an SELinux AVC denial in production. What is the correct first response?',
      opts: [
        'Run "setenforce 0" permanently to eliminate SELinux-related errors',
        'Temporarily confirm SELinux is the cause, then diagnose the specific denial and write a targeted policy/fcontext fix while re-enabling enforcing mode',
        'Ignore it — AVC denials are always false positives',
        'Reinstall the service from scratch'],
      ok: 1,
      why: 'Disabling SELinux fleet-wide/host-wide removes confinement for every process, not just the one causing the denial. A targeted fix preserves confinement while resolving the real issue.' },
    { q: 'Why should generated audit2allow output always be reviewed before being loaded with semodule?',
      opts: [
        'audit2allow output is always syntactically invalid',
        'audit2allow drafts the broadest rule that would silence the denial, which is often much more permissive than the service actually needs',
        'semodule cannot load unreviewed modules',
        'Review is only needed for AppArmor profiles, not SELinux modules'],
      ok: 1,
      why: 'audit2allow is a drafting tool, not a policy authority — its output must be narrowed to the minimum permission the denial actually requires before it becomes real policy.' },
    { q: 'A file is denied access by SELinux even though its Linux owner/group/mode permissions look correct. What should you check?',
      opts: [
        'The file\'s SELinux security context/label, then fix it with semanage fcontext and restorecon',
        'Whether the disk is full',
        'The system\'s DNS configuration',
        'Whether the file is owned by root'],
      ok: 0,
      why: 'SELinux enforces its own label-based rules independently of standard DAC permissions; a mislabeled file needs its context corrected, not a policy exception written around the mistake.' }
  ]
};
