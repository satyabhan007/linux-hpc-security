/* linux-hpc-security Learn — Part 3 · Chapter 9: Node Health Checks, Draining & Automated Remediation */
window.CH[9] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A node with a bad DIMM, a stuck GPU, or a filling <code>/tmp</code> doesn't usually crash outright — it keeps accepting jobs and
      silently corrupts or slows every one of them until someone notices a pattern of mysterious failures. A <b>Node Health Check (NHC)</b>
      runs continuously on every compute node, and when it detects a real problem, it tells Slurm to <b>drain</b> the node — stop giving it
      new jobs — automatically, before a human has to connect the dots across a dozen failed jobs on "node 47, again."</p>
      <pre><code>Without NHC: bad node keeps accepting jobs → jobs fail mysteriously → hours of debugging → node found broken
With NHC:    NHC detects the fault → node auto-drained → jobs route elsewhere → alert sent → human fixes hardware</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A pre-flight checklist, running continuously, not just once.</b> An
      airline doesn't inspect a plane once at delivery and never again — it runs checks before every flight, and a plane that fails one is
      pulled from rotation immediately, not after a mid-flight incident. NHC is that pre-flight check running on a loop for every compute
      node, pulling a sick one from the "flight schedule" (job rotation) before it can hurt a job.</p></div>`,
      try: [
        ['📖 LBNL Node Health Check (NHC) — GitHub', 'https://github.com/mej/nhc', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>The standard tool is <b>NHC</b> (originally from LBNL), a shell-script framework Slurm invokes via <code>HealthCheckProgram</code>
      on a schedule, plus <code>slurmctld</code>'s own <code>scontrol</code> commands for manual/scripted draining:</p>
      <pre><code># slurm.conf: run NHC every 5 minutes on every idle/allocated node
HealthCheckProgram=/usr/sbin/nhc
HealthCheckInterval=300
HealthCheckNodeState=ANY

# an nhc.conf rule: check for ECC/Xid errors in dmesg, drain the node if found
* || check_dmesg -f 'Xid|ECC error' && node_mark_offline("GPU Xid error detected")

# manually drain a node (what NHC does automatically when a rule fires)
$ scontrol update NodeName=node47 State=DRAIN Reason="GPU Xid 79 detected by NHC"

# see which nodes are drained and why, cluster-wide
$ sinfo -R
REASON               USER      TIMESTAMP           NODELIST
GPU Xid 79 detected  root      2026-09-10T03:14:02 node47</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>NHC's rule syntax (<code>check_dmesg</code>, <code>check_fs_mount</code>,
      <code>check_hw_gpu</code>, and dozens more built-ins) is standard across most Slurm sites, and <code>node_mark_offline()</code> /
      <code>node_mark_online()</code> are the functions rules call to actually change Slurm's view of the node — NHC never fixes hardware,
      it only ever removes a bad node from scheduling and alerts.</p></div>`,
      try: [
        ['📖 Slurm — HealthCheckProgram Configuration', 'https://slurm.schedmd.com/slurm.conf.html', 'o'],
        ['📖 NHC — Configuration Rule Reference', 'https://github.com/mej/nhc/wiki', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>An NHC rule catching a Xid GPU error.</b> NVIDIA GPUs log
      <b>Xid errors</b> to the kernel ring buffer (<code>dmesg</code>) when something goes wrong at the driver/hardware level — Xid 79
      specifically means "GPU has fallen off the bus," a serious hardware fault. An NHC rule that greps <code>dmesg</code> for Xid patterns
      and calls <code>node_mark_offline()</code> catches this within one health-check interval (typically minutes), instead of the failure
      mode being "every job scheduled on node47 for the next three days mysteriously fails at a random point, and someone eventually
      notices the pattern by grepping <code>sacct</code> output by node name."</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The "job failed on node 47 again" recurring-failure hunt.</b>
      Without automated draining, this becomes a manual, ad hoc investigation every time: someone eventually cross-references failed job IDs
      against <code>sacct -N node47</code>, finds the pattern, and manually drains the node — often days after the hardware fault started,
      after dozens of jobs already failed or produced silently wrong results. The fix isn't better manual detective work; it's recognizing
      that any recurring "this node again" pattern is a symptom of a missing or incomplete NHC rule, and writing the rule that would have
      caught it automatically the first time.</p></div>
      <p><b>Draining is a spectrum, not binary:</b> <code>DRAIN</code> stops new jobs but lets running ones finish; <code>DOWN</code> kills
      everything immediately. NHC rules should generally prefer drain-and-let-finish for problems that won't get worse mid-job (a slowly
      filling disk) and immediate down for problems that actively corrupt running work (a GPU that's fallen off the bus, an ECC error
      actively flipping bits).</p>`,
      try: [
        ['📖 NVIDIA — Xid Errors Reference', 'https://docs.nvidia.com/deploy/xid-errors/index.html', 'o'],
        ['🖥️ Ch 6 — GPU scheduling: MIG, time-slicing & GRES', '#ch6', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Relying on users to report "this node       Every recurring node-specific failure pattern is a missing
seems broken" instead of automated checks   or incomplete NHC rule — write the rule, don't wait for
                                             the third complaint about the same node.
Using DOWN (kill everything) for every      Match severity to remediation: DRAIN-and-finish for problems
detected fault regardless of severity       that won't worsen mid-job; immediate DOWN only for actively
                                             corrupting faults (GPU off the bus, live ECC errors).
NHC checks running too infrequently to      HealthCheckInterval should be short enough that a fault is
catch a fault before several jobs land      caught within roughly one job's typical runtime, not hours
on the bad node                             after several jobs have already failed on it.
No automatic re-check before returning a    A node manually fixed and returned to service (scontrol
drained node to service                     update State=RESUME) should re-run NHC before accepting
                                             jobs again, catching an incomplete repair immediately.
Treating NHC output as noise nobody reads   Route node_mark_offline() reasons into the same alerting
                                             pipeline as any other production incident — a drain event
                                             is an incident, not a log line to ignore.
Copy-pasted generic NHC rules never         Generic rulesets miss site-specific failure signatures (a
tuned to this cluster's actual hardware     particular GPU model's known Xid codes, a specific fabric
                                             card's error strings) — tune rules against real incident history.</code></pre>
      <p><b>The real test:</b> when a node fails the same way twice, is the second failure caught automatically by a new NHC rule written
      after the first incident — or does it require a human to notice the pattern again from scratch?</p>`,
      try: [
        ['📖 Slurm — Node State Management (scontrol)', 'https://slurm.schedmd.com/scontrol.html', 'o'],
        ['🖥️ Ch 13 — HPC monitoring & telemetry', '#ch13', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, node health management is a <b>feedback loop between incident history and detection rules</b>: every hardware
      failure a cluster experiences should leave behind not just a repaired node but a new or improved NHC rule that would have caught it
      automatically. A mature site's NHC ruleset is effectively a living record of every failure mode that cluster's specific hardware has
      ever exhibited — which is why a copy-pasted generic ruleset from another site, however well-intentioned, always under-protects against
      a fleet's actual, particular failure history.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: What is the actual job of a Node Health Check — does it fix hardware problems?
A: No. NHC only detects a problem and changes Slurm's scheduling state (drain/down) so no more jobs land
   on the bad node, plus alerts a human. It never repairs hardware — remediation there is "automated" in
   the sense of automatic detection and removal from rotation, not automatic hardware repair.

Q: When should an NHC rule use DOWN (kill running jobs immediately) instead of DRAIN (let running jobs
   finish, block new ones)?
A: Only for faults that actively corrupt in-progress work if left running — e.g. a GPU that has fallen
   off the bus (Xid 79) or live ECC errors flipping bits. Faults that won't worsen mid-job (a slowly
   filling disk, a degraded but functional link) should drain and let running jobs complete normally.

Q: Users report "job failed on node 47" repeatedly over several days before anyone notices the pattern.
   What's the systemic fix, not just the immediate one?
A: The immediate fix is draining node47 and diagnosing the hardware. The systemic fix is writing (or
   improving) the NHC rule that should have caught this fault automatically within one health-check
   interval, so the next occurrence — on this node or any other with the same failure mode — is caught
   without a human noticing a pattern in failed job logs first.

Q: Why should a manually-repaired node re-run NHC before being returned to the schedulable pool?
A: To catch an incomplete or incorrect repair immediately, rather than accepting jobs onto a node that
   still exhibits the original (or a new) fault — resuming a node without re-validation just defers
   discovery of a bad repair to the next job failure.

Q: Why does a mature site's NHC ruleset diverge meaningfully from a generic, copy-pasted one?
A: Because it accumulates rules specific to that cluster's actual observed failure history — particular
   GPU models' Xid codes, specific fabric card error strings, filesystem mount patterns unique to that
   site's storage. A generic ruleset only catches generic, well-known failure modes, missing whatever
   is unique to this fleet's hardware and history.</code></pre>`,
      try: [
        ['📖 NHC — Writing Custom Health Check Rules', 'https://github.com/mej/nhc/wiki', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'What does a Node Health Check (NHC) actually do when it detects a hardware fault?',
      opts: [
        'It automatically repairs the hardware fault',
        'It changes the node\'s Slurm scheduling state (drain/down) so no more jobs land on it, and alerts a human — it does not fix hardware',
        'It permanently deletes the node from the cluster inventory',
        'It reboots the node and hopes the problem resolves itself'],
      ok: 1,
      why: 'NHC\'s role is detection and automatic removal from job rotation, not repair — a human still has to diagnose and fix the underlying hardware issue.' },
    { q: 'When should an NHC rule use DOWN instead of DRAIN for a detected fault?',
      opts: [
        'Always — DOWN should be the default for every detected issue',
        'Only for faults that would actively corrupt in-progress work if jobs kept running, such as a GPU falling off the bus',
        'Never — DRAIN should be used for every fault regardless of severity',
        'DOWN and DRAIN are interchangeable with no functional difference'],
      ok: 1,
      why: 'DRAIN lets already-running jobs finish safely while blocking new ones; DOWN is reserved for faults severe enough that letting jobs continue would actively corrupt their results.' },
    { q: 'Node 47 fails the same way repeatedly over several days before anyone notices the pattern. What is the systemic (not just immediate) fix?',
      opts: [
        'Permanently remove node 47 from the cluster',
        'Write or improve an NHC rule that would catch this specific fault automatically within one health-check interval',
        'Tell users to avoid submitting jobs to node 47 manually',
        'Increase the job walltime limit cluster-wide'],
      ok: 1,
      why: 'A recurring node-specific failure pattern indicates a gap in automated detection; the systemic fix is closing that gap with a new rule so the next occurrence is caught automatically.' }
  ]
};
