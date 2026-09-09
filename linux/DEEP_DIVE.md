# Linux Internals — Deep Dive: Production Scenarios

Real incidents, the commands that diagnose them, and the fixes. Every
scenario here has happened on a real cluster more than once.

---

## Scenario 1 — "The node has 2 GB free, page it before it OOMs!"

**Symptom.** Monitoring alerts on `MemFree < 5%`. On-call pages the team
at 03:00. The node is running a large MPI job and is completely healthy.

**What's actually happening.** The job's dataset is cached. `free -m`:

```
              total        used        free      shared  buff/cache   available
Mem:         128760      41230        2015         598       85515       96328
```

`free` is 2 GB, but `available` is **96 GB** — that's cache Linux will
evict the instant a process needs the memory. `SwapUsed` is `0`.

**Fix.**
- Alert on `MemAvailable / MemTotal`, not `MemFree`.
- Add `si`/`so` (swap in/out) from `vmstat 1` and `pgmajfault` from
  `/proc/vmstat` to the dashboard — non-zero and climbing is the real
  memory-pressure signal.
- For jobs that genuinely must not be cache-evicted mid-run, that's a
  scheduler memory-request problem (Module 8), not a kernel one.

---

## Scenario 2 — Load average 250, CPU idle, whole partition "down"

**Symptom.** `uptime` shows `250, 240, 210`. `top` shows 95% idle.
`sinfo` shows the partition draining. Users report every command hangs.

**Diagnosis.**

```bash
ps -eo state,pid,cmd | awk '$1 ~ /D/'      # uninterruptible-sleep procs
cat /proc/<pid>/stack                       # where in the kernel they're stuck
iostat -x 2                                 # %util 100, await in the seconds
mount | grep nfs ; dmesg | grep -i 'nfs: server .* not responding'
```

**Root cause (most common first).**
1. An NFS server (often `/home`) hung. Every process that `stat()`s a
   home dir — including the shell prompt — parks in `D` state.
2. A failing local disk: `smartctl -a`, `dmesg` full of I/O errors.
3. A Lustre client eviction (Module 10).

**Fix.** Recover or fail the storage. `D`-state processes cannot be
killed (`kill -9` does nothing) — they unblock only when the I/O
completes or errors. Mount NFS with `soft,timeo=,retrans=` for
non-critical mounts so they error instead of hanging forever; use
`hard,intr` semantics deliberately.

---

## Scenario 3 — Database p99 latency spikes every few minutes, no pattern

**Symptom.** A Postgres/Oracle instance on a compute-adjacent node has
periodic 200 ms+ stalls. CPU, disk, and network all look fine at 1 s
resolution.

**Diagnosis.**

```bash
grep -E 'Dirty|Writeback' /proc/meminfo      # watch it sawtooth
sysctl vm.dirty_ratio vm.dirty_background_ratio vm.dirty_expire_centisecs
# eBPF (Module 5):
biolatency-bpfcc 10 1                          # disk latency histogram
```

**Root cause.** `vm.dirty_ratio = 20` on a 512 GB box means up to
~100 GB of dirty pages before writes go **fully synchronous**. When a
bulk writer (backup, a big `COPY`, a checkpoint) hits that ceiling, every
process doing a write — including the DB's WAL — blocks in
`balance_dirty_pages()` until writeback catches up.

**Fix.**

```
vm.dirty_background_ratio = 3       # start writeback early, in the background
vm.dirty_ratio = 10                # lower the hard wall
vm.dirty_expire_centisecs = 1000   # don't let pages sit dirty for 30s
```

Plus explicit hugepages for the DB shared buffers and `THP=never`
(Module 12). Tune, then re-measure — do not cargo-cult these numbers.

---

## Scenario 4 — A cgroup memory limit is killing a job "randomly"

**Symptom.** A Slurm job dies with `oom-kill` in `dmesg` but the node
has 400 GB free.

```
Memory cgroup out of memory: Killed process 48213 (python3)
  total-vm:38G, anon-rss:31G ... oom_memcg=/slurm/uid_1234/job_98765
```

**What it means.** The job requested `--mem=32G`. Slurm's cgroup plugin
set `memory.max = 32G` on the job's cgroup. The job's RSS hit 32 GB and
the **cgroup-scoped** OOM killer fired — protecting every other job on
the node. This is the system working correctly.

**Fix.** Right-size `--mem`, or find the leak. `--mem=0` requests all
memory on the node (use with `--exclusive`). Check
`/sys/fs/cgroup/.../memory.events` for `oom` and `oom_kill` counts;
`memory.high` (soft, throttles+reclaims before the hard kill) is a
gentler ceiling if your site configures it.

---

## Scenario 5 — `fork()` failing with ENOMEM on a box with free RAM

**Symptom.** `bash: fork: retry: Resource temporarily unavailable`, or a
service failing to spawn workers.

**Diagnosis.**

```bash
cat /proc/sys/kernel/pid_max                    # PID exhaustion?
cat /proc/sys/vm/overcommit_memory              # 2 = strict, refuses optimistic fork
grep -c '' /proc/*/status 2>/dev/null | wc -l   # process count
systemctl show <svc> -p TasksMax                # cgroup pids.max hit?
ulimit -u                                        # per-user process limit (RLIMIT_NPROC)
```

**Root causes.** `pids.max` on the cgroup (systemd `TasksMax=`, default
often 15% of `pid_max`); `RLIMIT_NPROC` via `/etc/security/limits.d/`; or
`vm.overcommit_memory=2` with `overcommit_ratio` too low so a large
process cannot `fork()` (copy-on-write still needs a reservation).

---

## The tools that resolve most "the box is weird" tickets

| Tool | Answers |
|---|---|
| `vmstat 1` | swap activity, run queue, I/O wait, context switches |
| `pidstat -d -r -u 1` | per-process CPU / RSS / I/O over time |
| `iostat -x 2` | per-device `%util`, `await`, queue depth |
| `ps -eo state,wchan:32,cmd` | *what kernel function* every `D`-state task is stuck in |
| `/proc/<pid>/stack`, `/proc/<pid>/status` | one process's kernel stack, memory, limits, signals |
| `slabtop` | kernel slab cache — dentry/inode cache bloat |
| `perf top`, `perf record -g` | where CPU time goes, system-wide |
| bcc/bpftrace (Module 5) | everything above, live, with per-syscall detail |

---

## Config checklist for a compute node

```
# /etc/sysctl.d/90-hpc.conf  (illustrative — validate per workload)
vm.swappiness = 10
vm.dirty_background_ratio = 3
vm.dirty_ratio = 10
vm.zone_reclaim_mode = 0          # do NOT reclaim locally before going remote — hurts HPC
kernel.numa_balancing = 0         # for pinned jobs; auto-NUMA migration adds jitter
kernel.sched_autogroup_enabled = 0
net.core.somaxconn = 4096
```

Bake these into the Warewulf image (Module 7) via a `sysctl.d` drop-in,
enforce with the OpenSCAP scan (Module 3), and re-verify on every image
build.
