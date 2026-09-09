# Containers & Reproducibility — The Amateur's Guide

> Docker is a shipping-container yard with a crane and a foreman (the
> daemon) stacking layers. Apptainer hands you one welded box you can put
> on any truck yourself — no crane, no foreman, and it only contains what
> you own.

---

## 1. The problem on a shared cluster

You cannot `apt install`. You are not root. Three hundred users need
conflicting versions of every library and compiler. And someone will
ask you, in 2031, to reproduce Figure 4 from the 2026 paper.

Three tools, three layers:

| Tool | What it does | Analogy |
|---|---|---|
| **Environment modules / Lmod** | swap pre-built software into `$PATH`/`$LD_LIBRARY_PATH` | the shared workshop's tool cabinet — pick the drill you want |
| **Spack / EasyBuild** | build software from source with every dependency, compiler, and flag pinned | a machine that fabricates a custom tool from raw stock to spec |
| **Apptainer** (formerly Singularity) | package an entire userspace into one file you carry between machines and years | shipping the whole workbench, tools bolted down, in a sealed crate |

```bash
module load gcc/13.2 openmpi/5.0 fftw/3.3.10
spack install hdf5@1.14.3 %gcc@13.2 +mpi ^openmpi@5.0
apptainer exec solver_v3.sif ./run.sh
```

---

## 2. Apptainer: Docker rethought for HPC

| | Docker | Apptainer |
|---|---|---|
| **Image** | a layer store + manifest, assembled by a daemon | one immutable `.sif` file (squashfs + metadata + optional signature) |
| **Daemon** | yes (runs as root) | none |
| **Identity inside** | root by default | **you stay you** — your UID maps through; files you create are yours |
| **Privilege** | `docker run` ≈ root on the host | rootless, no privilege escalation |
| **Home/CWD/tmp** | isolated unless you mount them | bind-mounted by default — "just works" in a batch job |
| **Fits on Lustre** | awkward (many small blobs) | yes — one file |

It builds *from* Docker images: `apptainer build app.sif docker://python:3.12`.

> Clusters ban the Docker daemon because `docker run -v /:/host` is a
> one-liner to root. Apptainer's model is what makes **user-supplied
> containers safe on a shared multi-user machine.**

(Lab: `step1_apptainer_sif.py` parses the SIF layout.)

---

## 3. The catch: MPI and the fabric must match the host

A container that ships its own MPI still has to use the **host's**
InfiniBand to get RDMA (Module 9). Two working models:

- **Bind / hybrid** — mount the host MPI tree + verbs libs
  (`libibverbs`, `libmlx5`, `libucp`) + `/dev/infiniband` into the
  container. Fast, but the container's MPI **ABI must be compatible**
  with the host libraries (same implementation, same major version).
- **Matched-PMI** — the container ships a host-compatible MPI; only the
  process-manager socket (PMI/PMIx) is shared.

If neither holds, MPI **silently falls back to TCP** and runs ~10×
slower. GPU is analogous: `apptainer exec --nv` binds the host NVIDIA
driver stack.

```bash
apptainer exec --nv \
  --bind /opt/openmpi,/usr/lib64/libibverbs.so.1,/dev/infiniband \
  solver.sif  srun --mpi=pmix -n 384 ./solver
```

(Lab: `step3_mpi_bind_mount.py`.)

---

## 4. Spack: building 200 packages consistently

Spack's core trick is **concretization**: you give an abstract spec
(`hdf5 +mpi`), and Spack's solver resolves *every* dependency, version,
variant, compiler, and target microarchitecture into a fully concrete
**build DAG**, then builds each package into a **hashed prefix** so
incompatible builds coexist. It auto-generates Lmod modules.

```bash
spack spec -I hdf5@1.14.3 +mpi %gcc@13.2 target=x86_64_v3   # show the concretized DAG
spack install hdf5@1.14.3 +mpi %gcc@13.2
spack module lmod refresh
```

**Analogy — a travel agent** turning "somewhere warm in spring, not too
expensive" into a specific flight, seat, hotel, and transfer that are
all mutually consistent and bookable — *before* anyone leaves.

**EasyBuild** is the alternative: recipe-driven "easyconfigs", a big
curated set, strong on reproducible toolchains.

(Lab: `step2_spack_concretize.py`.)

---

## 5. Environment modules / Lmod

```bash
module avail                 # what's installed
module load gcc/13.2 openmpi/5.0
module list
module purge                 # clean slate
ml spider hdf5               # Lmod: find every hdf5 and how to load it
```

A module file just sets/prepends environment variables. Lmod adds a
hierarchy (loading `openmpi` reveals only the `hdf5` builds compiled
against it) and `spider` search. Spack and EasyBuild both generate these.

---

## 6. Layers of reproducibility — pick the depth the science needs

| Level | What you commit | Reproduces |
|---|---|---|
| 1 | pinned `module load` lines in the job script | on this cluster, until it's reimaged |
| 2 | a Spack **environment** (`spack.yaml` + `spack.lock`) in git | exactly, rebuildable anywhere Spack runs |
| 3 | an Apptainer image + its **definition file** + digest, archived | exactly, on any Linux + Apptainer, for years |
| 4 | image + input data + workflow (Snakemake/Nextflow) + a DOI | the whole result |

Trade-off: bind-mounting host MPI is fast but ties you to one site; a
fully self-contained container is portable but may leave 5–15%
performance on the table.

---

## 7. Run the labs

```bash
python3 containers/step1_apptainer_sif.py     # SIF layout vs Docker's multi-blob layout
python3 containers/step2_spack_concretize.py  # abstract spec -> pinned DAG, with a conflict
python3 containers/step3_mpi_bind_mount.py     # the bind set for containerised MPI over RDMA
```

Next: **`tuning/`** — the last 20% of performance, in the kernel.
