# linux-hpc-security — Systems Engineering from the Metal Up

[![Live Site](https://img.shields.io/badge/Live%20Site-GitHub%20Pages-0a0e14?logo=githubpages&labelColor=0a0e14&color=10b981)](https://satyabhan007.github.io/linux-hpc-security/)
[![Course](https://img.shields.io/badge/Course-12%20modules%20%C3%97%205%20levels-22d3ee)](https://satyabhan007.github.io/linux-hpc-security/learn/)
[![Lab Tests](https://github.com/satyabhan007/linux-hpc-security/actions/workflows/lab-tests.yml/badge.svg)](https://github.com/satyabhan007/linux-hpc-security/actions/workflows/lab-tests.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981.svg)](LICENSE)

> A from-scratch, zero-black-box curriculum for the people who keep clusters
> alive — Linux internals, security hardening, DISA STIGs, HPC benchmarking,
> eBPF, Ansible, Warewulf, Slurm, RDMA fabric, parallel storage, containers
> and kernel tuning — with runnable pure-Python labs that model the real
> mechanism.

**Three ways in:**
- 🌐 **[The Systems Engineering Course](https://satyabhan007.github.io/linux-hpc-security/learn/)** — 12 modules × 5 levels (analogy → expert), with checkpoint quizzes.
- 🧪 **The labs** — 36 standalone `stepN_*.py` files, zero dependencies, CI-tested.
- 📂 **The guides** — every module has a `BEGINNER_GUIDE`, a `DEEP_DIVE` (production war-stories + real configs) and an `INTERVIEW` file (micro-detail Q&A).

---

## 🗺️ Repository structure

```
linux-hpc-security/
├── linux/         # 01 · Linux internals & the boot path
├── hardening/     # 02 · Security hardening (CIS, SSH/PAM, sudo, SELinux, sysctl)
├── stigs/         # 03 · STIGs & compliance automation (SCAP, XCCDF/OVAL, OpenSCAP)
├── benchmarking/  # 04 · HPC benchmarking (HPL, HPCG, STREAM, OSU, IOR, roofline)
├── ebpf/          # 05 · eBPF & observability (verifier, maps, ring buffer, CO-RE)
├── ansible/       # 06 · Ansible automation at scale
├── warewulf/      # 07 · Warewulf stateless provisioning (PXE → image → overlays)
├── hpc/           # 08 · HPC cluster architecture & Slurm (backfill, fairshare, MPI)
├── fabric/        # 09 · Networking & RDMA fabric (InfiniBand, RoCE, fat-tree)
├── storage/       # 10 · Parallel storage (Lustre/BeeGFS, striping, metadata)
├── containers/    # 11 · Containers & reproducibility (Apptainer, Spack, modules)
├── tuning/        # 12 · Kernel & performance tuning (NUMA, cgroups v2, hugepages)
│
├── learn/         # The 12-module × 5-level course (static site)
├── run_all.py     # Runs all 36 labs — this is what CI runs
└── assets/        # Site CSS/JS
```

Every module has the same shape:

| File | What it is |
|---|---|
| `stepN_*.py` (×3) | Runnable, zero-dependency models of the real mechanism. End with a `PASS` assert. |
| `BEGINNER_GUIDE.md` | The concept in plain English, with everyday analogies. |
| `DEEP_DIVE.md` | Production scenarios, real commands/configs, and outage post-mortems. |
| `INTERVIEW.md` | Micro-detail Q&A — concept checks, debug drills, back-of-envelope math. |

---

## ⚡ Quick start

```bash
git clone https://github.com/satyabhan007/linux-hpc-security.git
cd linux-hpc-security

# run the whole lab suite — 36 labs, ~10s, zero deps
python3 run_all.py

# walk any module: read the guide, then run the three steps
python3 benchmarking/step1_hpl_problem_size.py
python3 hpc/step1_slurm_backfill.py
python3 ebpf/step3_latency_hist.py
```

No cluster, no root, no dependencies. Each lab prints its reasoning and a
final `PASS`. The labs are **models**, not wrappers — they compute HPL
problem sizes, simulate the Slurm backfill pass, walk an eBPF verifier,
render Warewulf overlay templates, and so on, in a few dozen readable lines.

---

## 📚 Guide index

| Module | Beginner | Deep dive | Interview |
|---|---|---|---|
| Linux internals | [Guide](linux/BEGINNER_GUIDE.md) | [Deep Dive](linux/DEEP_DIVE.md) | [Q&A](linux/INTERVIEW.md) |
| Security hardening | [Guide](hardening/BEGINNER_GUIDE.md) | [Deep Dive](hardening/DEEP_DIVE.md) | [Q&A](hardening/INTERVIEW.md) |
| STIGs & compliance | [Guide](stigs/BEGINNER_GUIDE.md) | [Deep Dive](stigs/DEEP_DIVE.md) | [Q&A](stigs/INTERVIEW.md) |
| HPC benchmarking | [Guide](benchmarking/BEGINNER_GUIDE.md) | [Deep Dive](benchmarking/DEEP_DIVE.md) | [Q&A](benchmarking/INTERVIEW.md) |
| eBPF & observability | [Guide](ebpf/BEGINNER_GUIDE.md) | [Deep Dive](ebpf/DEEP_DIVE.md) | [Q&A](ebpf/INTERVIEW.md) |
| Ansible automation | [Guide](ansible/BEGINNER_GUIDE.md) | [Deep Dive](ansible/DEEP_DIVE.md) | [Q&A](ansible/INTERVIEW.md) |
| Warewulf provisioning | [Guide](warewulf/BEGINNER_GUIDE.md) | [Deep Dive](warewulf/DEEP_DIVE.md) | [Q&A](warewulf/INTERVIEW.md) |
| HPC / Slurm architecture | [Guide](hpc/BEGINNER_GUIDE.md) | [Deep Dive](hpc/DEEP_DIVE.md) | [Q&A](hpc/INTERVIEW.md) |
| Networking & RDMA fabric | [Guide](fabric/BEGINNER_GUIDE.md) | [Deep Dive](fabric/DEEP_DIVE.md) | [Q&A](fabric/INTERVIEW.md) |
| Parallel storage | [Guide](storage/BEGINNER_GUIDE.md) | [Deep Dive](storage/DEEP_DIVE.md) | [Q&A](storage/INTERVIEW.md) |
| Containers & reproducibility | [Guide](containers/BEGINNER_GUIDE.md) | [Deep Dive](containers/DEEP_DIVE.md) | [Q&A](containers/INTERVIEW.md) |
| Kernel & performance tuning | [Guide](tuning/BEGINNER_GUIDE.md) | [Deep Dive](tuning/DEEP_DIVE.md) | [Q&A](tuning/INTERVIEW.md) |

---

## 🎓 Provenance

Built as a companion to [`satyabhan007/AI-ML`](https://github.com/satyabhan007/AI-ML)
(the same "from scratch, zero black box" approach, applied to AI engineering).
This repo is the systems half: what the AI stack actually runs on.

## License

MIT — see [`LICENSE`](LICENSE).
