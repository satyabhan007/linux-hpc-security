/* linux-hpc-security Learn — Part 3 · Chapter 10: Containerized HPC Workloads: Apptainer on Slurm */
window.CH[10] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>A researcher builds a pipeline on their laptop with a specific Python version and a dozen exact library versions. On the cluster,
      the shared module system has different versions of everything, and reproducing "it worked on my laptop" becomes its own research
      project. <b>Apptainer</b> (formerly Singularity) packages the whole software environment into one image file that runs identically on
      a laptop and a 10,000-node cluster — and, critically for HPC, it does this <b>without needing root</b> to run, unlike Docker.</p>
      <pre><code>Docker:      needs a root-owned daemon running — a non-starter on a shared multi-tenant HPC login node
      Apptainer:   runs as the invoking user, no daemon, no elevated privilege needed to execute a container</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A shipping container, not a moving truck you have to borrow.</b> A
      Docker daemon is like needing to borrow the building's one loading dock (root) every time you want to move anything. Apptainer is a
      shipping container you can pick up and carry yourself — the same sealed box works on any truck, any dock, without needing special
      building access, which is exactly the constraint on a shared multi-user HPC login node.</p></div>`,
      try: [
        ['📖 Apptainer — Quick Start', 'https://apptainer.org/docs/user/main/quick_start.html', 'o'],
        ['🖥️ Ch 1 — Slurm scheduler internals', '#ch1', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Apptainer images are single <code>.sif</code> files, built from a definition file (similar to a Dockerfile) or pulled directly from
      Docker Hub, and Slurm runs them with no special integration needed since Apptainer executes as a normal unprivileged process:</p>
      <pre><code># pull an existing Docker image and convert it to Apptainer's .sif format directly
$ apptainer pull my_pipeline.sif docker://myorg/pipeline:2.3

# build from a definition file for full reproducibility (pinned base image + exact deps)
$ apptainer build my_pipeline.sif pipeline.def

# run it inside a normal Slurm job — no daemon, no root, just a wrapped process
$ srun apptainer exec --nv my_pipeline.sif python3 train.py

# bind-mount the cluster's scratch filesystem into the otherwise-isolated container
$ apptainer exec --bind /scratch:/scratch my_pipeline.sif ./run_analysis.sh</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The <b><code>--nv</code></b> flag is the standard way to expose NVIDIA
      GPU drivers/libraries into an otherwise-isolated container without baking driver binaries into the image itself (drivers must match
      the host kernel module, so they can never be safely bundled inside a portable image). <code>--bind</code> is the standard way to reach
      the parallel filesystem (Chapter 5) from inside the container, since the container's own filesystem is otherwise isolated from the
      host by design.</p></div>`,
      try: [
        ['📖 Apptainer — GPU Support (--nv)', 'https://apptainer.org/docs/user/main/gpu.html', 'o'],
        ['📖 Apptainer — Bind Paths and Mounts', 'https://apptainer.org/docs/user/main/bind_paths_and_mounts.html', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>Building an Apptainer image for a research pipeline.</b> A lab's
      genomics pipeline depends on a specific, hard-to-reproduce combination of a bioinformatics tool's exact version and a matching Python
      environment. Building it as an Apptainer <code>.def</code> file pinned to specific package versions means the pipeline that passed
      peer review is exactly the pipeline that runs a year later for a reproducibility check — the definition file itself becomes part of
      the paper's supplementary material, and "what environment did this run in" has a literal, exact answer instead of "whatever modules
      were loaded that week."</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>GPU passthrough into a container on Slurm.</b> A team's ML training
      job runs fine bare-metal but fails inside their Apptainer container with a CUDA driver mismatch error. The container was built with
      CUDA libraries baked in, but not the actual kernel driver (which must match the host exactly and cannot be containerized). Fix: use
      <code>--nv</code>, which mounts the host's NVIDIA driver libraries and device nodes into the container at runtime instead of relying on
      anything bundled in the image — the CUDA <i>toolkit</i> version inside the container can be pinned freely, but the driver must always
      come from the host.</p></div>
      <p><b>A container-vs-module reproducibility argument:</b> environment modules (<code>module load gcc/12 openmpi/4.1</code>) are
      lighter-weight and better for MPI codes that need tight integration with the host's fabric drivers (a containerized MPI job's
      performance depends heavily on whether the container's MPI implementation is ABI-compatible with the host's RDMA stack — see Chapter
      4), while containers win decisively for reproducibility and for non-MPI, single-node pipelines with complex, fragile dependency
      trees. Neither replaces the other cluster-wide; the right choice depends on the workload.</p>`,
      try: [
        ['📖 Apptainer — MPI Applications', 'https://apptainer.org/docs/user/main/mpi.html', 'o'],
        ['🖥️ Ch 4 — RDMA/InfiniBand fabric design', '#ch4', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Baking GPU driver binaries into the         Drivers must match the host kernel module exactly and can
container image                             never be safely bundled — always use --nv/--rocm for driver
                                             passthrough, pin only the CUDA/ROCm toolkit version inside.
Assuming a containerized MPI job gets       Container-internal MPI must be ABI-compatible with the host's
full native RDMA performance for free       RDMA stack (Chapter 4) or it silently falls back to a much
                                             slower transport — verify with actual bandwidth tests.
Using "latest" tags for research            Pin exact image digests/tags for anything tied to a
pipeline images                             publication or long-running study — "latest" breaks the
                                             exact reproducibility containers are supposed to provide.
No --bind for the parallel filesystem,      Forgetting --bind means the container silently can't see
silent failures reading input data          /scratch or /home, producing a confusing "file not found"
                                             instead of an obvious permission/mount error.
Treating every workload as a container      Tightly-coupled MPI codes needing exact fabric-driver
candidate, ignoring MPI/fabric tightness    integration are often better served by environment modules;
                                             containers shine for single-node, dependency-heavy pipelines.
Running unprivileged containers with        Apptainer's whole security value proposition (Chapter 4's
--fakeroot as a default habit               "linux-hpc-security" theme) is not needing elevated
                                             privilege — reach for --fakeroot only when truly required.</code></pre>
      <p><b>The real test:</b> for a reproducibility question a year from now, can you hand someone the exact <code>.sif</code> file (or its
      build recipe) and have it run byte-identical to how it ran the first time — or does "the pipeline" actually mean "whatever module
      versions happened to be default that week"?</p>`,
      try: [
        ['📖 Apptainer — Reproducible Environments', 'https://apptainer.org/docs/user/main/build_a_container.html', 'o'],
        ['🖥️ Ch 3 — MPI job placement & topology awareness', '#ch3', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, containerized HPC is a <b>reproducibility-vs-performance tradeoff</b> managed workload by workload: containers give
      near-perfect environment reproducibility and zero-root operation, which is exactly what a shared multi-tenant HPC login/compute
      environment needs, but that isolation boundary is precisely what has to be carefully punctured (via <code>--nv</code>, <code>--bind</code>,
      ABI-compatible MPI) for GPU access, storage access, and fabric performance to work at all. Getting this right means understanding
      which parts of the host environment absolutely must leak through the container boundary, and which shouldn't.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why can't GPU driver binaries simply be bundled inside an Apptainer image for full portability?
A: The GPU driver has a kernel-module component that must match the host's running kernel exactly.
   Bundling a driver in the image would break the moment the image runs on a host with a different
   kernel/driver version. Only the CUDA/ROCm toolkit (userspace libraries) belongs in the image; the
   driver itself is always passed through from the host via --nv/--rocm.

Q: A containerized MPI job runs much slower than the same code run bare-metal on the same nodes. What's
   the likely cause?
A: The container's bundled MPI implementation is likely not ABI-compatible with the host's RDMA/fabric
   stack, causing a silent fallback to a slower transport (e.g. TCP instead of native RDMA verbs).
   Verify with an actual point-to-point bandwidth test inside vs. outside the container.

Q: Why is Apptainer's "no root/daemon needed" property specifically important for HPC, more than for a
   typical cloud/web deployment?
A: HPC login and compute nodes are shared, multi-tenant systems where users cannot be granted root or a
   privileged daemon. Docker's daemon-based model is a non-starter there; Apptainer's unprivileged
   execution model is what makes containerization viable on shared HPC infrastructure at all.

Q: When would you recommend environment modules over containers for a specific HPC workload?
A: For tightly-coupled, multi-node MPI codes where deep integration with the host's exact fabric drivers
   and MPI implementation matters more than portability/reproducibility — containerizing such a workload
   risks silently losing RDMA performance unless the container's MPI stack is carefully matched to the
   host's.

Q: Why should "latest" image tags be avoided for anything tied to a research publication?
A: A publication's reproducibility claim depends on the exact software environment being recoverable
   later. "latest" is a moving target that can silently change; pinning an exact tag or image digest is
   what actually delivers on the reproducibility promise containers are meant to provide.</code></pre>`,
      try: [
        ['📖 Apptainer — Security Considerations', 'https://apptainer.org/docs/admin/main/security.html', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why can\'t a GPU driver simply be bundled inside an Apptainer container image for full portability?',
      opts: [
        'Apptainer does not support GPUs at all',
        'The driver has a kernel-module component that must match the host\'s exact running kernel, so only the toolkit belongs in the image while the driver is passed through via --nv',
        'GPU drivers are always identical across all Linux kernel versions',
        'Bundling drivers would violate NVIDIA licensing in every case'],
      ok: 1,
      why: 'Kernel-module drivers must match the running host kernel exactly; bundling one in a portable image would break on any host with a different kernel/driver combination.' },
    { q: 'Why is Apptainer\'s unprivileged, daemon-free execution model specifically important for HPC clusters?',
      opts: [
        'It makes containers run faster than Docker in all cases',
        'HPC login/compute nodes are shared multi-tenant systems where users cannot be granted root or a privileged daemon, which Docker\'s model requires',
        'It eliminates the need for any filesystem bind-mounts',
        'It is only relevant for single-user workstations'],
      ok: 1,
      why: 'Docker\'s daemon-based architecture needs elevated privilege, which is incompatible with shared multi-tenant HPC systems; Apptainer runs as the invoking user with no daemon.' },
    { q: 'A containerized MPI job runs significantly slower than the same code bare-metal on identical nodes. What is the most likely cause?',
      opts: [
        'Containers always add a fixed 50% performance penalty to any workload',
        'The container\'s bundled MPI is not ABI-compatible with the host\'s RDMA fabric stack, causing a silent fallback to a slower transport',
        'The job was not assigned enough CPU cores',
        'Apptainer disables all networking inside containers by default'],
      ok: 1,
      why: 'Tight MPI/fabric integration is fragile across container boundaries; an ABI mismatch commonly causes silent fallback from native RDMA to a much slower transport like TCP.' }
  ]
};
