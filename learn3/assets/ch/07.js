/* linux-hpc-security Learn — Part 3 · Chapter 7: Checkpoint/Restart for Long-Running Jobs */
window.CH[7] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A simulation runs for 72 hours and dies at hour 71 — a node reboots for a security patch, or the job simply hits its walltime limit
      one hour short. Without <b>checkpointing</b>, all 71 hours of compute are gone and the job restarts from zero. Checkpointing
      periodically saves enough state to disk that a job can <b>restart</b> from the last checkpoint instead of the beginning, turning a
      catastrophic loss into a minor, recoverable delay.</p>
      <pre><code>No checkpoint: hour 0 ----------------------- hour 71 [KILLED] → restart from hour 0 (all lost)
Checkpointed:  hour 0 --[ckpt]--[ckpt]--[ckpt]-- hour 71 [KILLED] → restart from last ckpt (~hour 68)</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Saving your progress in a video game.</b> A game with no save points
      means dying at the final boss sends you back to the very start. A game that autosaves every level lets a death cost you a few minutes,
      not the whole session. Checkpoint/restart is autosave for a multi-day compute job — the only real question is how often to save (too
      rare and you lose more; too often and the saving itself slows the game down).</p></div>`,
      try: [
        ['📖 CRIU — Checkpoint/Restore In Userspace', 'https://criu.org/Main_Page', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Two layers of checkpointing exist: <b>application-level</b> (the code itself periodically writes its own state — most mature HPC
      codes like LAMMPS, GROMACS, and VASP support this natively) and <b>system-level</b> (a tool freezes and serializes an entire process's
      memory/state without the application knowing, via <b>CRIU</b> on Linux). Slurm can also trigger a checkpoint before preempting a job:</p>
      <pre><code># application-level: most HPC codes take a restart-file flag directly
$ srun ./my_sim --restart-every=3600 --restart-file=/scratch/job123/ckpt

# system-level with CRIU: dump a running process tree to disk without its cooperation
$ criu dump -t $(pgrep my_sim) -D /scratch/job123/criu_ckpt --shell-job

# ...and restore it later, elsewhere, as if it never stopped
$ criu restore -D /scratch/job123/criu_ckpt --shell-job

# Slurm job script requesting a signal before preemption, giving the app time to checkpoint
#SBATCH --signal=B:USR1@120
trap 'my_sim_checkpoint_now' USR1</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard system-level tool is <b><code>CRIU</code></b>
      (Checkpoint/Restore In Userspace), which can snapshot process memory, open files, and network state on Linux without kernel
      modification. For jobs whose code doesn't support native checkpointing, DMTCP (Distributed MultiThreaded CheckPointing) wraps CRIU-like
      functionality specifically for HPC/MPI job trees, since a naive per-process CRIU dump doesn't understand MPI's distributed rank
      state.</p></div>`,
      try: [
        ['📖 CRIU — Documentation', 'https://criu.org/Category:Documentation', 'o'],
        ['📖 DMTCP — Distributed MultiThreaded CheckPointing', 'https://dmtcp.sourceforge.io/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Adding CRIU-based checkpointing to a long job.</b> A team runs a
      custom in-house simulation with no native restart-file support, and it keeps losing multi-day runs to routine maintenance reboots.
      Wrapping the job with DMTCP (rather than raw CRIU) is the right call because the simulation is MPI-parallel across 16 nodes — DMTCP
      coordinates a consistent, distributed checkpoint across all ranks simultaneously, which a naive per-process CRIU dump on each node
      independently cannot guarantee (ranks could checkpoint at different logical points in the computation, producing an inconsistent
      restart state). Fix: <code>dmtcp_launch</code> wraps the MPI launch, and a periodic <code>dmtcp_command --checkpoint</code> from a cron
      or Slurm epilog-adjacent script takes coordinated snapshots.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Restarting a preempted job from its last checkpoint.</b> A
      lower-priority job gets preempted by Slurm to make room for a higher-priority deadline job, per the site's preemption policy (see
      Chapter 8). Because the job script requested <code>--signal=B:USR1@120</code>, the application got 120 seconds' warning before
      <code>SIGTERM</code> and wrote a final checkpoint. The job's <code>#SBATCH</code> script itself checks for an existing checkpoint file
      at startup and resumes from it automatically — so re-submission after preemption (whether automatic via
      <code>--requeue</code> or manual) picks up exactly where it left off instead of needing a human to notice and intervene.</p></div>
      <p><b>Sizing checkpoint frequency against I/O overhead</b> is a real optimization problem: checkpointing too often wastes wall-clock
      time writing multi-gigabyte state to a parallel filesystem (see Chapter 5) that could be spent computing; checkpointing too rarely
      risks losing hours of work per failure. A common rule of thumb is to size the interval so checkpoint I/O overhead stays under ~5% of
      total runtime, using observed mean-time-between-failures for the cluster to pick the actual number.</p>`,
      try: [
        ['📖 DMTCP — MPI Support', 'https://dmtcp.sourceforge.io/', 'o'],
        ['🖥️ Ch 8 — HPC job scheduling policy design', '#ch8', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Relying on raw CRIU for an MPI job          Use DMTCP (or the application's native MPI-aware checkpoint
across many nodes                           support) — independent per-rank CRIU dumps can produce an
                                             inconsistent, non-restartable distributed state.
No pre-preemption signal handling in the    Request --signal=B:USR1@N and trap it in the job script so
job script                                  the application gets warning time to checkpoint before
                                             SIGTERM/SIGKILL arrives, instead of losing all unsaved work.
Fixed checkpoint interval never revisited   Size the interval against observed cluster MTBF and actual
against actual failure rate or I/O cost     checkpoint I/O time — a stale interval either wastes I/O
                                             bandwidth or under-protects against real failure frequency.
Checkpointing to the same filesystem/       A dead OST or MDS (Chapter 5) can make checkpoint writes
directory as the primary scratch dataset    themselves fail at the worst time; consider checkpoint
                                             writes to distinct storage from primary I/O when feasible.
No automatic restart-from-checkpoint        Requiring a human to notice a job died and manually resubmit
logic in the job script itself              from the right file defeats most of checkpointing's value —
                                             the script should detect and resume automatically.
Treating checkpoint files as disposable     Verify a checkpoint is restorable (test-restore periodically)
without ever testing a restore              — a corrupt or incomplete checkpoint discovered only during
                                             a real failure is as bad as having none.</code></pre>
      <p><b>The real test:</b> if a node reboots mid-job tonight, does tomorrow morning's status check show "resumed automatically from
      hour 68" — or does someone have to notice the job died and manually figure out how to restart it?</p>`,
      try: [
        ['📖 Slurm — Preemption and Job Requeue', 'https://slurm.schedmd.com/preempt.html', 'o'],
        ['🖥️ Ch 9 — node health checks & automated remediation', '#ch9', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, checkpoint/restart is a <b>resilience-budget</b> problem: every checkpoint write trades wall-clock compute time
      for reduced risk of catastrophic loss, and the correct tradeoff depends on the cluster's actual observed failure rate (MTBF), the
      job's checkpoint I/O cost relative to its compute rate, and how expensive re-computing lost work actually is. A cluster with frequent
      preemption and flaky nodes needs aggressive, cheap, frequent checkpoints; a stable cluster running rarely-preempted jobs can afford
      sparser checkpointing and spend the saved I/O time on more compute.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why is raw per-process CRIU insufficient for checkpointing a multi-node MPI job?
A: Each node's CRIU dump is independent and has no way to coordinate a consistent global snapshot across
   ranks — different ranks could be checkpointed at different logical points in the computation
   (in-flight messages, mismatched iteration counts), producing an unrestorable inconsistent state. Tools
   like DMTCP coordinate the checkpoint across the whole distributed job.

Q: How do you size checkpoint frequency for a long-running job?
A: Balance checkpoint I/O overhead against the cluster's observed mean-time-between-failures: a common
   target is keeping checkpoint I/O under roughly 5% of total runtime, then increasing frequency only if
   observed failure rate would otherwise threaten more expected lost compute than that overhead costs.

Q: Why is --signal=B:USR1@120 in a job script important even if the application already checkpoints
   periodically?
A: It gives the application advance warning of an imminent SIGTERM (e.g. from preemption or walltime
   expiry) so it can take a final, clean checkpoint immediately before termination, rather than losing
   all work done since the last periodic checkpoint.

Q: What's the failure mode of never testing a checkpoint restore?
A: A corrupted or incomplete checkpoint file is functionally identical to having no checkpoint at all —
   except you don't discover this until a real failure, at the worst possible time. Periodic test-restores
   validate the checkpoint mechanism actually works, not just that files get written.

Q: Why should a job script auto-detect and resume from an existing checkpoint rather than requiring
   manual resubmission?
A: Manual intervention introduces delay (someone has to notice the failure) and human error (picking the
   wrong checkpoint file). Automatic detection-and-resume, combined with Slurm's --requeue, makes
   preemption/failure recovery unattended and immediate rather than dependent on an operator noticing.</code></pre>`,
      try: [
        ['📖 Slurm — sbatch --requeue Documentation', 'https://slurm.schedmd.com/sbatch.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is raw per-node CRIU insufficient for checkpointing a multi-node MPI job, unlike an MPI-aware tool such as DMTCP?',
      opts: [
        'CRIU cannot run on Linux at all',
        'Independent per-node CRIU dumps cannot coordinate a consistent global snapshot across ranks, risking an unrestorable inconsistent state',
        'CRIU only works with single-threaded applications',
        'MPI jobs never need checkpointing'],
      ok: 1,
      why: 'A distributed job needs a coordinated checkpoint across all ranks at a consistent logical point; independent per-rank dumps can capture ranks at mismatched points, producing a corrupt restart state.' },
    { q: 'What is the purpose of requesting --signal=B:USR1@120 in a Slurm job script that already checkpoints periodically?',
      opts: [
        'It has no practical effect and is purely cosmetic',
        'It gives the application advance warning before SIGTERM so it can take a final clean checkpoint before termination',
        'It forces the job to checkpoint every 120 seconds regardless of application logic',
        'It disables preemption for that job entirely'],
      ok: 1,
      why: 'The signal gives the running application time to react (e.g. write a last checkpoint) before the process is actually terminated, minimizing lost work beyond the last periodic checkpoint.' },
    { q: 'How should checkpoint interval typically be sized for a long-running HPC job?',
      opts: [
        'As frequently as technically possible, regardless of I/O cost',
        'Balanced against observed cluster MTBF and checkpoint I/O overhead — often targeting checkpoint I/O under roughly 5% of total runtime',
        'Exactly once, at the very end of the job',
        'It should never change once set, regardless of cluster conditions'],
      ok: 1,
      why: 'Checkpointing trades wall-clock compute time for reduced risk of lost work; the right frequency depends on actual failure rate and I/O cost, not a fixed universal number.' }
  ]
};
