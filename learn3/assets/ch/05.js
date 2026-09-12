/* linux-hpc-security Learn — Part 3 · Chapter 5: Parallel Filesystems at Scale: Lustre & GPFS */
window.CH[5] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A single NFS server tops out fast when a thousand compute nodes all try to read the same dataset at once. A <b>parallel
      filesystem</b> — <b>Lustre</b> or <b>IBM Spectrum Scale (GPFS)</b> — spreads both the data and the job of serving it across many
      servers, so a thousand nodes reading a big file in parallel get near-linear aggregate throughput instead of hammering one bottleneck.
      The catch: how a workload uses the filesystem (huge sequential files vs. millions of tiny ones) determines whether it flies or grinds
      the whole cluster to a halt.</p>
      <pre><code>NFS: node → one server → one disk array         (throughput capped by one server)
Lustre/GPFS: node → many OSS/OST or NSD servers in parallel   (throughput scales with server count)</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>One checkout lane vs. a warehouse with many loading docks.</b> A single
      NFS server is one checkout lane — no matter how many shoppers show up, they funnel through one register. A parallel filesystem is a
      warehouse with dozens of loading docks, each handling part of the load simultaneously. But if everyone tries to use the same one dock
      for tiny individual items (millions of small files hitting one metadata server) the warehouse's parallel design doesn't help at all.</p></div>`,
      try: [
        ['📖 Lustre — Introduction', 'https://doc.lustre.org/lustre_manual.xhtml', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Lustre splits each file into <b>stripes</b> spread across <b>OSTs</b> (Object Storage Targets, each backed by an OSS server), while
      a separate <b>MDS</b> (MetaData Server) handles filenames/directories/permissions — data and metadata paths are physically separate.
      GPFS instead spreads both data and metadata across <b>NSD</b> (Network Shared Disk) servers in a more unified design. Striping is the
      main per-file tuning knob:</p>
      <pre><code># check current striping on a directory (inherited by new files created in it)
$ lfs getstripe /scratch/project/
stripe_count: 1  stripe_size: 1048576  pattern: raw  stripe_offset: -1

# set wide striping for a directory of large checkpoint files (spread across 8 OSTs)
$ lfs setstripe -c 8 -S 4M /scratch/project/checkpoints/

# a single huge file benefits from striping across many/all OSTs
$ lfs setstripe -c -1 /scratch/project/big_dataset.h5

# check overall OST usage/balance across the filesystem
$ lfs df -h</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard tuning rule: <b>stripe count 1 for small files, wide
      striping (or -1 for "all OSTs") only for large files</b> that a single job reads/writes in parallel. Striping a directory full of small
      files across many OSTs doesn't speed anything up — it just multiplies the per-file open/lock overhead across servers for no
      benefit, which is one of the most common Lustre performance own-goals.</p></div>`,
      try: [
        ['📖 Lustre — Managing File Layout (Striping)', 'https://doc.lustre.org/lustre_manual.xhtml#managingstripingfreespace', 'o'],
        ['📖 IBM Spectrum Scale (GPFS) — Documentation', 'https://www.ibm.com/docs/en/storage-scale', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>An MDS bottleneck from small-file I/O.</b> A genomics pipeline
      writes millions of small intermediate files (one per read pair) into a single shared directory. The filesystem's aggregate data
      throughput (OSTs) is barely used, but every metadata operation (open, stat, create, unlink) funnels through one MDS, and the whole
      cluster's filesystem responsiveness — for every user, every job — degrades because one pipeline is metadata-bound. Fix: batch small
      files into container formats (HDF5, tar, or a key-value store) so metadata operation count drops by orders of magnitude, or shard the
      files across many subdirectories if the workload can't be batched, and set <code>stripe_count=1</code> on that directory since wide
      striping only worsens per-file overhead here.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Choosing Lustre vs. GPFS for a new cluster.</b> A site evaluates
      both for a new deployment: Lustre tends to lead on raw sequential throughput for HPC-classic workloads and has a larger open-source
      community footprint; GPFS (Spectrum Scale) offers more built-in enterprise features out of the box (native tiering/ILM policies,
      AFM caching for multi-site, POSIX ACL/quota integration) and a more unified metadata architecture that can better tolerate small-file
      workloads. The real decision driver isn't "which is faster in a vacuum" but the actual workload mix (large sequential HPC vs. mixed
      HPC+small-file ML data loading) and in-house operational expertise, since both require serious specialist skill to run well at scale.
      </p></div>
      <p><b>Client-side caching and locking</b> matter as much as server-side layout: a job doing uncoordinated small writes to the same file
      from many ranks (rather than each rank writing its own region or using MPI-IO collective writes) forces the distributed lock manager
      into constant lock ping-pong between clients, which can be slower than a single-threaded write to local disk.</p>`,
      try: [
        ['📖 Lustre — Lock Management Overview', 'https://doc.lustre.org/lustre_manual.xhtml', 'o'],
        ['🖥️ Ch 13 — HPC monitoring & telemetry', '#ch13', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Wide-striping every directory "for         Stripe wide only for large files a single job reads/writes
safety" regardless of file size             in parallel; stripe_count=1 for small-file directories.
Millions of small files in one flat        Batch into container formats (HDF5/tar) or shard across
directory                                   subdirectories to cut metadata-server operation count.
Uncoordinated small writes to the same      Use MPI-IO collective writes or have each rank write a
shared file from many MPI ranks             distinct region/file — avoids DLM lock ping-pong between
                                             clients that can be slower than serial I/O.
Treating the parallel filesystem as         /scratch on Lustre/GPFS is (usually) not backed up and is
durable, long-term storage                  purged; production data belongs on a home/project filesystem
                                             with actual backup/replication, not the fast scratch tier.
No monitoring on MDS/OSS load separately    Aggregate throughput can look fine while one MDS is pegged
from aggregate OST throughput               by a single small-file-heavy job — monitor metadata ops/sec
                                             per server, not just bytes/sec across the whole filesystem.
Ignoring filesystem-level quotas until      Set per-project inode AND space quotas up front — inode
a user exhausts inodes cluster-wide         exhaustion from small files can block writes cluster-wide
                                             even when there's plenty of free space.</code></pre>
      <p><b>The real test:</b> when a user complains "the filesystem is slow," can you tell within minutes whether it's an OST bandwidth
      problem, an MDS metadata-rate problem, or a lock-contention problem — because the fix for each is completely different?</p>`,
      try: [
        ['📖 Lustre — Lustre Monitoring and Statistics', 'https://doc.lustre.org/lustre_manual.xhtml', 'o'],
        ['🖥️ Ch 9 — node health checks & automated remediation', '#ch9', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, parallel filesystem tuning is inseparable from the <b>I/O pattern of the workloads that dominate the cluster</b>:
      the same Lustre deployment can be excellent for one lab's large-checkpoint HPC simulations and terrible for another lab's small-file
      ML data-loading pipeline, with no configuration change in between — only workload behavior. The expert's job is to classify workloads
      by I/O pattern before they hit production (large-sequential vs. small-file vs. random-access vs. shared-file-parallel-write) and route
      each to the storage tier and striping policy that fits, rather than treating "the filesystem" as one undifferentiated resource.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: A cluster's filesystem "feels slow" for everyone, but aggregate OST throughput graphs look fine. What
   do you check next?
A: MDS metadata operation rate. A single small-file-heavy workload can saturate the metadata server
   (opens/stats/creates/unlinks) while barely touching OST data bandwidth — the two are separate
   bottlenecks and must be monitored separately.

Q: Why does striping a directory of millions of small files across many OSTs make things worse, not
   better?
A: Striping helps when a single file is read/written by many clients/threads in parallel. For small
   files accessed by one process each, wide striping multiplies per-file network/lock overhead across
   more servers with no parallel-read benefit to offset it.

Q: Why can uncoordinated writes to a shared file from many MPI ranks be slower than one rank writing
   serially?
A: The distributed lock manager must arbitrate conflicting byte-range locks between clients, causing
   "lock ping-pong." MPI-IO collective writes (or per-rank distinct regions/files) avoid this by
   coordinating access patterns so locks aren't contended.

Q: When would you choose GPFS (Spectrum Scale) over Lustre for a new deployment?
A: When the workload mix includes significant small-file/mixed-access patterns GPFS's more unified
   metadata architecture tolerates better, or when built-in enterprise features (ILM tiering, AFM
   multi-site caching) reduce integration work versus building the equivalent around Lustre.

Q: Why should /scratch on a parallel filesystem never be treated as durable storage?
A: Scratch tiers are provisioned for throughput, not durability — they're typically not backed up and
   often subject to automatic purge policies. Production/result data needs a home or project filesystem
   with actual replication/backup, a completely different reliability tier.</code></pre>`,
      try: [
        ['📖 Lustre — Data on MDT (small-file performance)', 'https://doc.lustre.org/lustre_manual.xhtml', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'A cluster-wide filesystem "feels slow" but aggregate OST (data) throughput graphs look normal. What is the most likely bottleneck to check next?',
      opts: [
        'The InfiniBand fabric bisection bandwidth',
        'The MDS (metadata server) operation rate, which is a separate bottleneck from data throughput',
        'The Slurm scheduler priority weights',
        'The compute nodes\' CPU frequency scaling settings'],
      ok: 1,
      why: 'Metadata (opens/stats/creates) and data (OST bandwidth) are separate subsystems in Lustre/GPFS; a small-file-heavy workload can saturate the MDS while OST bandwidth graphs stay flat.' },
    { q: 'Why does wide-striping a directory full of millions of small files typically make performance worse, not better?',
      opts: [
        'Wide striping always improves performance regardless of file size',
        'Small files accessed by one process each gain no parallel-read benefit, while per-file overhead is multiplied across more servers',
        'Striping is only a metadata-server setting and has no effect on data',
        'Lustre does not support striping on small files at all'],
      ok: 1,
      why: 'Striping helps when a single file is accessed in parallel by many clients. For small, single-process files it just adds coordination overhead across more OSTs with nothing to parallelize.' },
    { q: 'Why can uncoordinated concurrent writes to the same shared file from many MPI ranks be slower than serial writes from one rank?',
      opts: [
        'MPI does not support parallel file writes at all',
        'The distributed lock manager must arbitrate conflicting byte-range locks between clients, causing lock contention overhead',
        'Parallel filesystems disable writes when multiple clients are involved',
        'It is always faster regardless of coordination'],
      ok: 1,
      why: 'Without MPI-IO collective writes or non-overlapping regions per rank, the DLM must serialize conflicting lock requests, which can dominate and exceed the cost of a single serial writer.' }
  ]
};
