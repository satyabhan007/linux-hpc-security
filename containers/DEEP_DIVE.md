# Containers & Reproducibility — Deep Dive: Production Scenarios

---

## Scenario 1 — "Reproduce Figure 4 from our 2026 paper" (it's 2031)

**What makes it succeed:** the repo has `solver_2026.sif` (with its
`Apptainer` definition file and a recorded digest), a `spack.lock`, the
`sbatch` script, and the input dataset (or a DOI for it). You
`apptainer run` it and get the same numbers.

**What makes it fail:** the methods section says "we used GCC and
OpenMPI on our cluster", the cluster has been reimaged twice, the
module `openmpi/4.0.2` no longer exists, and the code assumes a library
version nobody recorded.

**The practice.** For any result you might need to defend:
1. `spack.yaml` + `spack.lock` committed, **or** an Apptainer def file +
   built `.sif` archived alongside the data.
2. The exact launch command and environment in the repo.
3. A digest / checksum of the image and the inputs.
4. Ideally a workflow tool (Snakemake/Nextflow/CWL) so the DAG is
   explicit.

---

## Scenario 2 — Containerised MPI runs 10× slow over InfiniBand

**Symptom.** `apptainer exec app.sif mpirun -n 256 ./solver` — `osu_latency`
inside reads 25 µs; native reads 1 µs.

**Diagnose.**
```bash
apptainer exec app.sif ldd $(which mpirun) | grep -E 'ucx|ibverbs|fabric'
apptainer exec app.sif ompi_info | grep -E 'btl|pml|MCA ucx'
apptainer exec app.sif ucx_info -d | grep -E 'Transport|rc|dc'
# host vs container MPI versions
mpirun --version ; apptainer exec app.sif mpirun --version
env | grep -E 'UCX_|OMPI_|PMIX_'
```

**Causes & fixes.**
| Cause | Fix |
|---|---|
| Container has no `rdma-core`/`libibverbs` | add it to the image, or bind host libs |
| Container MPI ≠ host MPI (impl or major version) | rebuild container MPI to match, or use matched-PMI model |
| `/dev/infiniband` not visible in container | `--bind /dev/infiniband` (or `--rocm`/`--nv` for GPU) |
| `RLIMIT_MEMLOCK` too low → registration fails → TCP | `ulimit -l unlimited` in the job env + limits.d |
| `PMIx` version mismatch with host `srun` | build container PMIx to the host's major version; `srun --mpi=pmix` |

**Bind (hybrid) launch that works:**
```bash
srun --mpi=pmix -n 256 apptainer exec \
  --bind /opt/ompi-5.0,/usr/lib64/libibverbs.so.1,/usr/lib64/libmlx5.so.1,/dev/infiniband,/etc/libibverbs.d \
  --env LD_LIBRARY_PATH=/opt/ompi-5.0/lib:$LD_LIBRARY_PATH \
  app.sif ./solver
```

(Lab: `step3_mpi_bind_mount.py` models the decision.)

---

## Scenario 3 — Spack build takes 6 hours and half the packages fail

**Symptoms & fixes.**
- **Rebuilding the world each time.** Use a **Spack environment**
  (`spack.yaml`) + a **build cache** (binary mirror): `spack buildcache`
  push/install so CI and users pull binaries, not rebuild.
- **Concretizer picks weird versions.** Pin in `packages.yaml`
  (preferred versions/variants, `require:` for MPI provider), and pin
  the compiler. Commit `spack.lock`.
- **Compiler not found / wrong.** `spack compiler find` after loading
  the module; check `compilers.yaml`.
- **Flaky downloads.** A source mirror (`spack mirror create`).
- **One package breaks the whole env.** `spack install --keep-stage`
  and read `spack-build-out.txt`; `spack install <spec> ^dep@ver` to
  override just that dep.
- **Microarch mismatch.** `target=x86_64_v3` (or the real arch) so
  binaries don't `SIGILL` on older nodes.

---

## Scenario 4 — A user wants to run a random Docker image on the cluster

**Their ask.** "Just let me `docker run tensorflow/tensorflow:latest`."

**Why not.** The Docker daemon runs as root; `docker` group membership ≈
root; `docker run --privileged -v /:/host` escapes trivially. On a
shared machine that's unacceptable.

**The answer.**
```bash
apptainer build tf.sif docker://tensorflow/tensorflow:2.17.0-gpu
# or, to keep the OCI layout:
apptainer pull --oci tf.sif docker://...
apptainer exec --nv tf.sif python train.py
```

Apptainer converts the Docker image, runs it rootless, keeps the user's
UID, binds `$HOME`/`$PWD`, and (with `--nv`) wires in the host GPU
stack. For rootless *Docker-like* workflows, `podman` is the other
option, but Apptainer is the HPC standard.

---

## Scenario 5 — STIG-regulated environment needs scanned containers

**Requirements.** Every image on the cluster must derive from a trusted,
scanned base; images are re-scanned on a schedule; provenance is
recorded.

**Pipeline.**
```
trusted base image (RHEL UBI / hardened)  --built in CI-->
  ├─ oscap-podman / trivy / grype scan  → fail build on new CAT I / critical CVE
  ├─ cosign sign  (or apptainer sign with a project PGP key)
  └─ push to the internal registry with an immutable tag + digest

user job images  FROM  <internal>/base:<digest>
  └─ same scan gate, same signing, recorded in an SBOM
apptainer verify job.sif    # checks the signature before the cluster runs it
```

Container STIGs / the CIS Docker benchmark cover the image and runtime
config, not the (nonexistent) container kernel — see Module 3.

---

## Reference

```bash
# Apptainer
apptainer build --fakeroot img.sif img.def       # build from a definition file
apptainer sif list img.sif                         # descriptors inside the SIF
apptainer sign / verify img.sif
apptainer exec --nv --bind /scratch,/opt/mpi img.sif CMD

# Spack
spack env create myproj ; spack env activate myproj
spack add hdf5@1.14.3 +mpi ; spack concretize -f ; spack install
spack buildcache push --only=package <mirror> <spec>
spack module lmod refresh

# Lmod
ml spider <pkg> ; module load ... ; module --raw show <mod>
```
