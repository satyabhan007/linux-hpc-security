/* linux-hpc-security Learn — Part 4 · Chapter 6: Secrets Management at Scale */
window.CH[6] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A database password lives in an environment variable in a deploy script, checked into a private git repo "because it\'s ' +
      'private". It never rotates because rotating it means finding every place it is used by hand. Two years later nobody remembers ' +
      'which of forty services still depend on that exact string, so it never gets changed — even after an engineer who had access ' +
      'leaves the company.</p>' +
      '<pre><code>Static password in an env var / config file   →   Short-lived credential issued on demand from a\n' +
      '  (never rotates, unclear who/what has it)          vault, auto-expiring, every access logged</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A house key copied for every guest, forever, vs. a hotel keycard ' +
      'that expires at checkout.</b> The copied key still opens the door five years after the guest checked out, and nobody remembers ' +
      'how many copies exist. The keycard stops working the moment it should — automatically, with no one having to remember to disable it.</p></div>',
      try: [
        ['📖 HashiCorp Vault — documentation', 'https://developer.hashicorp.com/vault/docs', 'o'],
        ['📖 NIST — digital identity & credential guidelines', 'https://pages.nist.gov/800-63-3/', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>A secrets manager (<b>HashiCorp Vault</b>, or a cloud KMS-backed equivalent) issues <b>dynamic, short-lived credentials</b> ' +
      'on demand instead of storing one static secret forever. A database password is generated per-request, scoped to a TTL, and ' +
      'revoked automatically — nothing long-lived to leak in the first place:</p>' +
      '<pre><code># enable the database secrets engine and define a role with a short TTL\n' +
      '$ vault secrets enable database\n' +
      '$ vault write database/roles/app-readonly \\\n' +
      '    db_name=postgres-prod \\\n' +
      '    creation_statements="CREATE ROLE \\"{{name}}\\" LOGIN PASSWORD \\"{{password}}\\" VALID UNTIL \\"{{expiration}}\\";" \\\n' +
      '    default_ttl="1h" max_ttl="4h"\n\n' +
      '# an app requests a fresh credential at runtime — Vault generates & tracks the lease\n' +
      '$ vault read database/creds/app-readonly\n\n' +
      '# audit every secret access — who/what read which secret, and when\n' +
      '$ vault audit enable file file_path=/var/log/vault/audit.log</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern is <b><code>Vault</code></b> ' +
      '(or a cloud-native KMS/Secrets Manager) issuing <b>dynamic secrets</b> with short TTLs, workload identity ' +
      '(e.g. Kubernetes service-account tokens, AWS IAM roles) used for AUTHENTICATING to the vault rather than a static ' +
      'API key, and <b>audit logging</b> enabled from day one so every secret read has an attributable, timestamped trail.</p></div>',
      try: [
        ['📖 HashiCorp Vault — dynamic secrets concept', 'https://developer.hashicorp.com/vault/docs/secrets', 'o'],
        ['📖 NIST SP 800-57 — key management guidance', 'https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The zero-downtime rotation that took down a service.</b> A ' +
      'team rotates a static database password and every service holding the old value in memory (never re-reading it) starts failing ' +
      'auth simultaneously. Fix: rotation has to be dual-write-aware — the old and new credential both work for an overlap window, and ' +
      'services must actually re-fetch on a schedule (or on auth failure) rather than caching a secret at startup forever.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Migrating off static secrets uncovered secrets nobody knew ' +
      'existed.</b> A fleet-wide move to Vault dynamic credentials starts with an inventory pass, and the inventory turns up a dozen ' +
      'hardcoded credentials in old scripts and CI configs that predate anyone currently on the team. Fix: treat the migration itself as ' +
      'a discovery exercise — scan repos and config for secret-shaped strings (entropy scanning, known-pattern regexes) as step one, not ' +
      'an afterthought, because you cannot migrate a secret you do not know exists.</p></div>' +
      '<p><b>Auditing "who read a secret" is as important as the secret itself:</b> a leaked static password with no access log means ' +
      'you cannot even scope the blast radius of a breach — you have to assume every holder of that credential is compromised.</p>',
      try: [
        ['📖 HashiCorp Vault — dynamic secrets & leases', 'https://developer.hashicorp.com/vault/docs/concepts/lease', 'o'],
        ['🛡️ Ch 10 — privileged access management & just-in-time access', '#ch10', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Static, long-lived secret in an env var/    Dynamic, short-TTL credential issued per-request from a vault/KMS,\n' +
      '  config file checked into a repo             auto-revoked — nothing long-lived for a repo leak to expose.\n' +
      'Secret rotation done as a single cutover      Support an overlap window where old and new both validate; services\n' +
      '  (old value instantly invalid everywhere)      must re-fetch on schedule/failure, not just cache at startup.\n' +
      'No audit trail for who/what read a secret    Enable secrets-manager audit logging from day one — an unlogged\n' +
      '                                             secret leak forces you to assume every holder is compromised.\n' +
      'Authenticating to the vault with another      Use workload identity (K8s service account, cloud IAM role) to\n' +
      '  static, long-lived API key                   authenticate to the secrets manager — turtles all the way down otherwise.\n' +
      'Migration to dynamic secrets skips a          Scan repos/configs/CI for secret-shaped strings FIRST — you cannot\n' +
      '  discovery/inventory pass                     migrate a hardcoded credential nobody knows still exists.\n' +
      'Secrets scoped identically for every          Scope each credential (role, TTL, permissions) to the minimum a\n' +
      '  consumer regardless of what they need         specific workload actually needs — not one shared "prod-db" secret.</code></pre>' +
      '<p><b>The real test:</b> if a specific credential leaked right now, could you say — in seconds, from a log — exactly which ' +
      'service requested it, when, and when it auto-expired? If the answer requires guessing, it is not a managed secret yet.</p>',
      try: [
        ['📖 OWASP — secrets management cheat sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html', 'o'],
        ['🛡️ Ch 8 — intrusion detection: auditd & eBPF-based sensors', '#ch8', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, secrets management is about minimizing the <b>window of exposure</b> and the <b>blast radius</b> of any ' +
      'single leaked credential simultaneously: short TTLs shrink the window (a leaked credential that expires in an hour is far less ' +
      'useful to an attacker than one that never expires), and fine-grained per-workload scoping shrinks the radius (a leaked read-only, ' +
      'single-database credential is a much smaller incident than a leaked admin credential shared across forty services). Both matter; ' +
      'neither substitutes for the other.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why are dynamic, short-lived credentials strictly better than a static password for most workloads?\n' +
      "A: They shrink both the exposure window (a leaked credential expires quickly) and eliminate the need\n" +
      '   to remember where a static secret is used when rotating — the credential is generated on demand and\n' +
      '   revoked automatically, so there is nothing long-lived to leak in the first place.\n\n' +
      'Q: A secret rotation just took down several services simultaneously. What went wrong?\n' +
      'A: The rotation was a hard cutover with no overlap window, and the services were caching the secret at\n' +
      '   startup instead of re-fetching it — the fix is an overlap period where both old and new values\n' +
      '   validate, combined with services that re-fetch on a schedule or on auth failure.\n\n' +
      'Q: Why is audit logging on a secrets manager as important as the secrets-management system itself?\n' +
      'A: Without an access log, a leaked credential forces you to assume every service or person who ever\n' +
      '   had access to it is compromised — you cannot scope the blast radius of the incident at all.\n\n' +
      'Q: What should authenticate a workload TO the secrets manager?\n' +
      'A: Workload identity — a Kubernetes service account token, a cloud IAM role — not another static,\n' +
      "   long-lived API key, which would just relocate the original problem one layer down.\n\n" +
      'Q: What is the first step in migrating a fleet off static secrets to a vault-based system?\n' +
      'A: A discovery/inventory pass — scanning repositories, configs, and CI pipelines for secret-shaped\n' +
      '   strings — since you cannot migrate a hardcoded credential whose existence nobody currently knows about.</code></pre>',
      try: [
        ['📖 HashiCorp Vault — production hardening guide', 'https://developer.hashicorp.com/vault/tutorials/operations/production-hardening', 'o'],
        ['🛡️ Ch 11 — network segmentation & micro-segmentation for bare metal', '#ch11', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why are dynamic, short-lived credentials from a secrets manager generally preferred over a static password stored in a config file?',
      opts: [
        'Static passwords are always cryptographically weaker',
        'They shrink the exposure window and eliminate the need to track every usage location during rotation, since credentials are generated on demand and auto-expire',
        'Dynamic credentials never need to be logged',
        'Config files cannot store passwords at all'],
      ok: 1,
      why: 'Short TTLs and on-demand issuance mean there is no long-lived secret sitting around to leak, and rotation no longer requires finding every place a static value was hardcoded.' },
    { q: 'A secret rotation causes multiple services to fail simultaneously. What is the most likely root cause and fix?',
      opts: [
        'The new password was too short — increase password length requirements',
        'The rotation had no overlap window and services were caching the secret at startup instead of re-fetching it; fix by supporting dual-validity and re-fetch-on-failure',
        'The secrets manager itself is fundamentally unreliable',
        'The services should have been restarted before, not after, the rotation'],
      ok: 1,
      why: 'Zero-downtime rotation requires an overlap period where both old and new credentials validate, plus services that re-fetch rather than caching a secret indefinitely.' },
    { q: 'Why is audit logging considered essential to a secrets-management system, not an optional add-on?',
      opts: [
        'It is required only for regulatory checkbox purposes with no practical value',
        'Without a log of who/what read a secret and when, a leaked credential forces you to assume every possible holder is compromised, making incident scoping impossible',
        'Audit logs are needed to generate the secrets themselves',
        'It has no real security value beyond compliance reporting'],
      ok: 1,
      why: 'Access logging is what lets an incident responder scope the blast radius of a leak to specific consumers instead of treating every credential holder as compromised.' }
  ]
};
