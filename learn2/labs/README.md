# Part 2 · labs — runnable configs

> Standard tools, at production depth. Every file here is validated in CI
> (`.github/workflows/lab-tests.yml`).

Landing alongside chapters 2–16: a bpftrace/BCC script set for scheduler and
syscall-latency profiling, a cgroups v2 resource-control example (systemd
slice + cpu/memory/io limits), a NUMA binding + reporting toolkit, a sysctl
fleet-baseline (Ansible role + drift-check), a kdump/crash walkthrough
against a captured vmcore, and a kpatch live-patching example.

## Directory map

| Directory | Companion chapter(s) | What's in it |
|---|---|---|
| [`ebpf-profiling/`](ebpf-profiling/) | Ch1, Ch5, Ch9 | `bpftrace` scripts for scheduler-latency and syscall-latency histograms, plus a documented BCC (Python) file-open tracer |
| [`cgroups-resource-control/`](cgroups-resource-control/) | Ch4 | A real `batch-jobs.slice` systemd unit (CPU/memory/IO/pids limits) plus apply/verify scripts reading live cgroup v2 controller files |
| [`numa-tuning/`](numa-tuning/) | Ch3 | `numactl`-based CPU+memory binding launcher and a `numastat`-based per-process NUMA hit/miss reporter |
| [`sysctl-fleet-baseline/`](sysctl-fleet-baseline/) | Ch13 | An Ansible role rendering a versioned `/etc/sysctl.d/` baseline, plus a standalone JSON+shell drift-check script |
| [`kdump-crash-debug/`](kdump-crash-debug/) | Ch11 | A kdump-readiness check script and an annotated `crash`-utility session walkthrough |
| [`kpatch-live-patching/`](kpatch-live-patching/) | Ch12 | An example CVE-shaped patch plus build/load and verify-it's-actually-active scripts |

Each subdirectory has its own README with usage, what to look for, and
validation notes specific to that lab.

## Validation summary

- Shell scripts: `bash -n` (syntax) plus hand-review for `shellcheck`-style
  cleanliness (`set -euo pipefail`, quoted expansions, explicit error
  handling) — `shellcheck` itself is not installable in the authoring
  sandbox, so scripts were also functionally exercised wherever the
  underlying tool (`sysctl`, `numactl`/`numastat`, `systemctl`) was actually
  present, confirming real, correct behavior rather than syntax alone.
- YAML (the Ansible role): `yamllint` with this repo's relaxed CI profile.
- JSON (the sysctl baseline): `python -m json.tool`.
- Python (the BCC example): `python -m py_compile`.
- `bpftrace` scripts: syntax-validated against a live `bpftrace` v0.25
  binary (parses and reaches the attach stage cleanly); actual probe
  attachment requires root/CAP_BPF and a live kernel tracing subsystem,
  which this sandbox does not grant — documented clearly in each file.
- `kpatch`/`crash` require a full kernel build toolchain or a captured
  vmcore respectively, neither of which is available in a CI sandbox — both
  labs document the real workflow and fail gracefully with a clear message
  when the underlying tool is absent, rather than assuming it exists.
