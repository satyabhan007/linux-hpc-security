# Containers & Reproducibility — Interview Q&A

---

## Apptainer vs Docker

**Q: Why do HPC centres run Apptainer/Singularity instead of the Docker daemon?**
The Docker daemon runs as root, so `docker run` effectively grants root
on a shared multi-user login node. Apptainer is daemonless and rootless:
your UID maps straight through, no privilege is escalated, and an image
is one immutable `.sif` file that sits happily on parallel storage.

**Q: What is a SIF file?**
Singularity Image Format — a single file containing a squashfs root
filesystem, a JSON descriptor block, optionally a partition for an
overlay, and an optional cryptographic signature. One file to copy,
checksum, sign, and archive.

**Q: `apptainer` binds three host paths by default — which, and why does that matter?**
`$HOME`, `$PWD`, `/tmp` (plus `/proc`, `/sys`, `/dev`). It means a batch
job "just works" without a `-v` flag — but it also means the container
is **not** fully isolated from your home dir; use `--no-home`
`--containall` when you want a clean environment for reproducibility.

**Q: How does an unprivileged user build an Apptainer image?**
`--fakeroot` (uses user namespaces + `/etc/subuid` mappings) for most
builds, or build the `.sif` on a machine where you do have rights / in
CI, then copy it. Historically needed setuid; modern kernels + userns
make rootless build the norm.

**Q: Docker image → Apptainer, one command?**
`apptainer build app.sif docker://org/app:1.2.3` (or from a local daemon
via `docker-daemon://`). Layers are flattened into the squashfs.

---

## Running MPI in a container

**Q: A containerised MPI job silently falls back to TCP and runs 10× slower over InfiniBand. Cause and fix?**
The MPI/fabric stack **inside** the container is incompatible with the
host's `libibverbs`/UCX/driver. Fix with the **hybrid model**:
bind-mount the host MPI, `libibverbs`, `/dev/infiniband`, and the PMI/
PMIx libraries into the container, or build the container's MPI to be
ABI-compatible with the host and let `srun`/`mpirun` launch it sharing
PMIx.

**Q: Who launches the ranks — `mpirun` inside or `srun` outside?**
Outside. `srun apptainer exec img.sif ./app` (or `mpirun -n N apptainer
exec ...`). The launcher and the process manager (PMIx) live on the
host; the container just provides the userspace for each rank.

**Q: Cost of the fully self-contained (no host bind) approach?**
Portability at the price of ~5–15% performance, because you cannot use
the host's tuned transport. Fine for loosely-coupled or single-node
work; painful for tightly-coupled collective-heavy codes.

---

## Spack

**Q: What does `spack` concretization produce?**
A fully resolved dependency DAG: every package version, variant,
compiler, compiler flags, and target microarchitecture pinned and
mutually consistent — ready to build. Abstract `hdf5 +mpi` → a concrete
graph with `openmpi@5.0.5 %gcc@13.2 arch=linux-rocky9-zen4`, etc.

**Q: How do two incompatible builds of the same library coexist?**
Each concrete package installs under a hashed prefix
(`/opt/spack/.../hdf5-1.14.3-<hash>`). Different concretizations →
different hashes → different directories. Lmod modules are generated per
hash.

**Q: `spack.yaml` vs `spack.lock`?**
`spack.yaml` is the human-written environment spec (what you want).
`spack.lock` is the fully concretized, hashed result (what you get) —
commit both; `spack.lock` makes the environment rebuildable exactly.

**Q: Spack vs EasyBuild — one-line distinction.**
Spack: a dependency solver + from-source builder, very flexible,
solver-driven. EasyBuild: recipe-driven ("easyconfigs"), a large curated
set, strong on reproducible named toolchains (`foss/2023b`,
`intel/2023b`).

---

## Environment modules / Lmod

**Q: What does `module load gcc/13.2` actually do?**
Runs a Lua/Tcl modulefile that prepends to `PATH`, `LD_LIBRARY_PATH`,
`MANPATH`, `PKG_CONFIG_PATH`, sets `CC`/`CXX`, and records the change so
`module unload` can reverse it. It is `$PATH` surgery, nothing more.

**Q: Lmod "hierarchical" modules — the point?**
`fftw` built against `openmpi/5.0` is only visible **after** you
`module load openmpi/5.0`. The hierarchy stops you loading an MPI-linked
library against the wrong MPI — a class of silent ABI bug.

**Q: A user reports `module load` "worked yesterday, broken today". First checks?**
`module --version` / site changed; `module spider <name>` for what
exists now; `echo $MODULEPATH`; a stale `~/.lmod.d` default collection;
or the module was rebuilt under a new compiler and the old hash is gone.

---

## Reproducibility ladder

**Q: Rank the levels of reproducibility from cheapest to strongest.**
1. Pin module versions in the job script.
2. A Spack environment (`spack.yaml` + `spack.lock`) in git — rebuildable.
3. An Apptainer `.sif` + its definition file + recorded digest, archived
   with the data.
4. Image + input data (or DOI) + workflow engine (Snakemake/Nextflow) +
   the launch command, all versioned.

**Q: Why isn't "we used GCC and OpenMPI" reproducible?**
No versions, no flags, no dependency versions, and the cluster is a
moving target (reimaged, modules retired). Reproducibility requires the
*exact* graph, captured as a lockfile or an image, not prose.

**Q: STIG-regulated site — extra step for containers?**
Container images need their **own** compliance scanning (a container
STIG profile, not the host one) and must come from a trusted base-image
pipeline; a `.sif` pulled from Docker Hub is unaccredited software.

---

## Debug drills

**Q: `apptainer exec` gives `FATAL: could not open image ... Permission denied` on a Lustre path. Likely cause?**
The `.sif` is on a filesystem mounted `nosuid`/`nodev` in a way that
blocks the loop/overlay, or root-squash prevents the needed access, or
(older Apptainer) it needs `allow container squashfs = yes` in
`apptainer.conf`. Move the image to `$HOME` or a permitted path to
confirm.

**Q: Container job runs fine interactively, fails under Slurm with "library not found".**
Interactive shell had modules loaded that leaked host libraries into the
container via `LD_LIBRARY_PATH`. Under `sbatch` that environment is
absent. Fix: make the container self-sufficient, or explicitly
`--env`/bind what it needs; do not rely on the caller's environment.

**Q: Two nodes, same `.sif`, different results. Where do you look?**
Non-deterministic reductions (MPI/OpenMP reduction order, `-ffast-math`),
different microarchitecture dispatch inside the image (AVX-512 vs AVX2
code paths), an un-pinned RNG seed, or a bind-mounted host library that
differs between the nodes.
