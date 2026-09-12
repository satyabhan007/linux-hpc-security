/* linux-hpc-security Learn — Part 3 · Chapter 11: Multi-Tenancy, Accounting & Fairshare at Scale */
window.CH[11] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A university cluster serves a dozen departments, each of whom paid into the cluster's budget in different proportions and expects
      compute time roughly proportional to what they paid. <b>Slurm accounting</b> tracks exactly who ran what, for how long, on how many
      resources — the raw data both fairshare (Chapter 1) and chargeback billing depend on — and needs to scale from a handful of accounts
      to hundreds of labs/projects/grants without the bookkeeping itself becoming a full-time job.</p>
      <pre><code>Every completed job → slurmdbd (accounting daemon) → MySQL/MariaDB backend
                                                     → sreport (billing/usage reports)
                                                     → sshare (fairshare priority inputs)</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A shared apartment building's utility bill.</b> Everyone paid into the
      building differently (bigger units, more residents) and expects utilities split fairly, not equally. Slurm accounting is the building's
      submeter on every unit — it doesn't decide what "fair" means, it just produces the accurate usage numbers that any fairness formula
      (fairshare) or actual bill (chargeback) needs as its raw input.</p></div>`,
      try: [
        ['📖 Slurm — Accounting and Resource Limits', 'https://slurm.schedmd.com/accounting.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p><code>sacctmgr</code> manages the accounting hierarchy (clusters → accounts → users), <code>sacct</code> queries individual job
      records, and <code>sreport</code> produces aggregated usage reports for billing:</p>
      <pre><code># build the account hierarchy: a top-level account per department, users under it
$ sacctmgr add account physics Description="Physics Dept" Organization=university
$ sacctmgr add user alice Account=physics

# set the RawShares that drive fairshare priority (Chapter 1) for this account
$ sacctmgr modify account physics set fairshare=150

# per-job accounting detail: exact resources consumed, for chargeback
$ sacct -j 123456 --format=JobID,User,Account,Elapsed,AllocTRES,State

# a monthly usage report per account, ready to hand to a budget office
$ sreport cluster AccountUtilizationByUser start=2026-08-01 end=2026-09-01 -t hours</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard backend is <b><code>slurmdbd</code></b> talking to a
      MySQL/MariaDB database — accounting data does not live in <code>slurmctld</code>'s in-memory state, so historical usage survives
      controller restarts and can be queried months or years later. <b>TRES</b> (Trackable RESources — CPUs, memory, GPUs, and licenses)
      is the unit accounting actually bills in, not just "core-hours," which matters once GPU nodes enter the picture.</p></div>`,
      try: [
        ['📖 Slurm — sacctmgr(1)', 'https://slurm.schedmd.com/sacctmgr.html', 'o'],
        ['📖 Slurm — TRES (Trackable Resources)', 'https://slurm.schedmd.com/tres.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Setting up Slurm accounting for chargeback.</b> A shared cluster's
      funding model requires each department to be billed monthly for actual usage, in dollars, not just core-hours. The accounting hierarchy
      maps departments to accounts and grants to sub-accounts underneath them, TRES billing weights are configured in
      <code>slurm.conf</code> (<code>TRESBillingWeights</code>) so a GPU-hour costs proportionally more than a CPU-hour to reflect real
      hardware cost, and a monthly <code>sreport</code> job feeds a script that converts TRES-hours into an actual invoice line per account
      — turning "the cluster is shared infrastructure" into an auditable, self-service-verifiable bill each department can check against
      their own job history.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A fairshare decay tuning decision.</b> Two departments argue about
      whether a burst of heavy usage three months ago should still be lowering their fairshare priority today. Slurm's <code>PriorityDecayHalfLife</code>
      controls exactly this — a short half-life (e.g. 1 day) makes fairshare responsive to only very recent usage, quickly "forgiving" past
      bursts, while a long half-life (e.g. 30 days) makes the effect of a big usage burst linger much longer. Neither is objectively correct;
      it's a policy decision about how long institutional memory should matter, made explicit and tunable rather than left as an unexamined
      default.</p></div>
      <p><b>Auditing GPU-hour usage for a grant report</b> is a direct consumer of the same accounting data: a PI needing to prove to a
      funding agency exactly how many GPU-hours a specific grant's jobs consumed queries <code>sacct</code>/<code>sreport</code> filtered by
      account and TRES type over the grant's active period — accurate accounting isn't just an internal fairness mechanism, it's the
      cluster's answer to external compliance and reporting obligations too.</p>`,
      try: [
        ['📖 Slurm — TRES Billing Weights', 'https://slurm.schedmd.com/tres.html#TRESBillingWeights', 'o'],
        ['🖥️ Ch 8 — HPC job scheduling policy design', '#ch8', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Billing purely on core-hours, ignoring     Configure TRESBillingWeights so GPU-hours (or high-memory
GPU/memory as separate cost dimensions     nodes) bill proportionally to their real hardware cost, not
                                             as if a GPU node costs the same as a CPU-only one.
Fairshare decay half-life left at          PriorityDecayHalfLife should reflect an actual institutional
whatever the install default happened      policy decision (how long should a usage burst matter) —
to be                                       not an accidental default nobody examined.
No sub-account structure for grants/       A flat department-level account can't answer "how much did
projects under a department account        grant X specifically use" — nest grant/project sub-accounts
                                             under the department for accurate per-grant reporting.
Accounting database with no backup         slurmdbd's MySQL/MariaDB backend is the sole source of
strategy separate from the cluster itself  historical usage/billing truth — back it up independently
                                             of whatever backup strategy covers the compute nodes.
Treating accounting purely as an           The same accounting data answers compliance/grant-reporting
internal fairness mechanism                obligations — design the account hierarchy anticipating
                                             "what will we be asked to prove," not just internal fairness.
Manually reconciling usage reports by      sreport's built-in report types (AccountUtilizationByUser,
hand from raw sacct output every month     UserUtilizationByAccount, etc.) already produce the standard
                                             aggregations — build billing scripts on those, not raw sacct.</code></pre>
      <p><b>The real test:</b> if a department disputes their monthly bill, can you reproduce the exact number from raw, queryable
      <code>slurmdbd</code> records in minutes — or does the billing process depend on a spreadsheet someone manually maintained alongside
      the actual scheduler data?</p>`,
      try: [
        ['📖 Slurm — sreport(1)', 'https://slurm.schedmd.com/sreport.html', 'o'],
        ['🖥️ Ch 14 — cluster capacity planning & TCO', '#ch14', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, multi-tenant accounting is the <b>trust infrastructure</b> underneath every other governance mechanism in the
      cluster: fairshare priority (Chapter 1), preemption policy (Chapter 8), and chargeback billing all depend on the same accounting data
      being accurate, auditable, and reproducible by anyone who's disputing a number. A cluster where usage data is approximate, or lives
      partly in someone's private spreadsheet, cannot sustain fair multi-tenant policy no matter how well-designed the fairshare formula is
      — the formula is only as trustworthy as its inputs.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why should GPU-hours and CPU-hours be billed with different TRES weights rather than treated as
   equivalent "compute hours"?
A: A GPU node represents substantially more hardware cost per hour than a CPU-only node. Billing them
   identically either overcharges CPU-only users or undercharges GPU users relative to actual resource
   cost — TRESBillingWeights lets the accounting reflect real infrastructure economics.

Q: What does PriorityDecayHalfLife actually control, and why is it a policy decision, not a technical
   one?
A: It controls how quickly past usage stops counting against current fairshare priority. A short
   half-life quickly forgives a usage burst; a long one makes it matter for much longer. There's no
   technically "correct" value — it encodes how much institutional memory the site wants fairshare to
   have, which is a governance choice.

Q: Why does a flat, department-level accounting hierarchy fail for grant-funded research usage
   reporting?
A: A department-level account can't distinguish which specific grant's jobs consumed which resources.
   Nesting grant/project-level sub-accounts under the department is necessary to answer "how much did
   grant X use," which is often an external compliance requirement, not just an internal nicety.

Q: A department disputes their monthly compute bill. What should your response process look like?
A: Reproduce the exact billed number directly from slurmdbd/sreport records filtered to their account
   and billing period, independent of any manually-maintained spreadsheet. If the number can't be
   reproduced from the actual accounting database, the billing process itself is broken, not just this
   one dispute.

Q: Why is accounting data described as "trust infrastructure" for the whole multi-tenant cluster, not
   just a fairness nicety?
A: Fairshare priority, preemption policy, and chargeback billing all depend on the same underlying usage
   data being accurate. If that data is wrong or unauditable, every governance mechanism built on top of
   it — however well-designed — inherits that same untrustworthiness.</code></pre>`,
      try: [
        ['📖 Slurm — Multi-Cluster Accounting', 'https://slurm.schedmd.com/multi_cluster.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should GPU-hours typically be billed with a different TRES weight than CPU-hours in Slurm accounting?',
      opts: [
        'Slurm cannot track GPU usage at all',
        'A GPU node represents substantially higher hardware cost than a CPU-only node, so billing should reflect actual resource cost via TRESBillingWeights',
        'GPU jobs always run for exactly the same duration as CPU jobs',
        'TRES only applies to memory, never to GPUs'],
      ok: 1,
      why: 'Treating GPU-hours and CPU-hours as equivalent misrepresents real infrastructure cost; TRESBillingWeights lets billing proportionally reflect the actual hardware being consumed.' },
    { q: 'What does Slurm\'s PriorityDecayHalfLife setting actually control, and why is choosing its value a policy decision rather than a technical one?',
      opts: [
        'It controls how often slurmctld restarts, a purely operational setting',
        'It controls how quickly past usage stops affecting current fairshare priority, encoding how much institutional memory the site wants fairshare to have',
        'It sets the maximum walltime for any job on the cluster',
        'It has no effect on fairshare and is purely cosmetic'],
      ok: 1,
      why: 'There is no technically correct half-life value — it reflects a governance choice about how long a usage burst should continue to count against an account\'s priority.' },
    { q: 'A department disputes their monthly compute bill. What is the correct way to resolve the dispute?',
      opts: [
        'Apologize and issue a discount regardless of the actual usage',
        'Reproduce the exact billed number directly from slurmdbd/sreport records for their account and billing period',
        'Ignore the dispute since billing is always approximate',
        'Manually recalculate the bill from memory'],
      ok: 1,
      why: 'Accounting data in slurmdbd is the authoritative, queryable source of truth; a trustworthy billing process must be reproducible directly from it, not from a separately maintained approximation.' }
  ]
};
