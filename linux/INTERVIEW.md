# Linux Internals — Interview Q&A

Micro-details that come up in Linux / HPC / SRE screens. Answer out loud
in 2–3 sentences, then check yourself against the "why it matters".

---

## Boot & init

**Q: Walk me through what happens from power-on to a login prompt.**
Firmware (UEFI) POSTs and runs the bootloader → GRUB loads `vmlinuz` +
`initramfs` into RAM → kernel initialises, mounts initramfs, pivots to
the real root fs → starts PID 1 (`systemd`) → systemd brings up units in
dependency order → `getty`/`sshd`.
*Why it matters:* a hung boot is stuck at exactly one handoff; naming
them tells the interviewer you can debug it.

**Q: Why does `initramfs` exist? Why not mount root directly?**
The kernel needs drivers/tools to *find* root — LVM, mdraid, LUKS,
multipath, iSCSI/NFS root, a non-built-in filesystem. initramfs is a
tiny userspace with just enough to assemble and mount the real root,
then `switch_root`.

**Q: `systemd` vs SysV init — one concrete advantage.**
Dependency-based parallel startup and cgroup-per-service (so
`systemctl status` shows resource use, and `MemoryMax=`/`CPUQuota=` work
out of the box). Also socket activation and proper service supervision.

---

## Memory

**Q: Difference between a minor and a major page fault?**
Minor = the page is already resident (shared lib, page cache) — just
wire up the mapping. Major = must read from disk/swap, ~10⁴× slower.
High major-fault rate ⇒ thrashing.

**Q: `MemFree` vs `MemAvailable` — which do you alert on and why?**
`MemAvailable`. Linux uses free RAM as page cache and reclaims it
instantly under pressure, so `MemFree` is near-zero on a healthy busy
box. `MemAvailable` estimates what you can actually allocate without
swapping.

**Q: What is `vm.swappiness`?**
The kernel's relative preference for reclaiming anonymous pages (→ swap)
vs page-cache pages. 0–100; lower keeps process memory resident longer.
HPC compute nodes often run 1–10; `0` means "only swap to avoid OOM".

**Q: What is overcommit? `vm.overcommit_memory` values?**
The kernel hands out more virtual memory than it has, betting not all is
touched. `0` = heuristic, `1` = always allow, `2` = strict
(`CommitLimit = swap + ratio×RAM`). Strict prevents OOM surprises but
can make `fork()` of a big process fail.

**Q: OOM killer — how does it choose a victim?**
Highest `oom_score` (roughly RSS-weighted, adjustable via
`oom_score_adj`). With cgroup v2 memory limits, a per-cgroup OOM fires
first and only kills within that cgroup.

**Q: What is the page cache, and how do you drop it?**
Cached file contents in otherwise-free RAM. `echo 1 > /proc/sys/vm/drop_caches`
(pagecache), `2` (dentries+inodes), `3` (both). Almost never needed in
prod — it's a benchmarking tool, not a fix.

**Q: `Dirty` pages and `vm.dirty_ratio`?**
Dirty = modified in memory, not yet written to disk. At
`dirty_background_ratio` the kernel starts async writeback; at
`dirty_ratio` writers block synchronously. Bulk writers hitting the hard
ratio cause latency spikes for everyone.

**Q: Anonymous vs file-backed memory?**
Anonymous = heap/stack, backed by swap (or nothing). File-backed =
mmap'd files / program text, backed by the file. Only file-backed clean
pages can be dropped for free.

---

## Processes & scheduling

**Q: What does load average measure?**
Exponentially-weighted count of tasks that are *running or runnable*
**plus** tasks in **uninterruptible sleep (`D`)**. It is not CPU%.

**Q: Load 40, CPU 90% idle — explain.**
~36 tasks are blocked in `D` state on I/O (dead disk, hung NFS, Lustre
eviction). They inflate load without using CPU. `ps -eo state,wchan,cmd`
and `iostat -x` confirm.

**Q: Why can't you `kill -9` a process in `D` state?**
Signals are only delivered when a task returns toward userspace. A
`D`-state task is blocked inside the kernel in an uninterruptible wait;
it must finish (or the I/O must error) first.

**Q: CFS vs EEVDF — what stayed the same?**
Both are fair-share: track virtual runtime weighted by `nice`, run the
task furthest behind. EEVDF (6.6+) adds latency-sensitivity (a "virtual
deadline") so interactive tasks get lower latency without more CPU.

**Q: What does `nice` actually change? Range?**
Scheduler *weight*, not a hard priority. Range −20..+19; each step is
~1.25× CPU share. `nice 0` = weight 1024. Only root can go negative.

**Q: `SCHED_FIFO` / `SCHED_RR` vs `SCHED_OTHER`?**
Real-time policies: a `SCHED_FIFO` task runs until it blocks or yields,
preempting all normal tasks. Used for latency-critical threads; a
runaway RT thread can lock a CPU (hence `kernel.sched_rt_runtime_us`).

**Q: What is a context switch and roughly what does it cost?**
Save registers + stack pointer, swap the page-table base (CR3),
flush/tag the TLB, restore the next task. ~1–3 µs direct; cache/TLB
pollution can cost more. 100k/s shows as `%sy` in `top`.

**Q: `fork()` vs `vfork()` vs `posix_spawn()` vs `clone()`?**
`fork` = COW copy of the address space. `vfork` = share until `exec`
(fast, dangerous). `clone` = the primitive; flags select what's shared
(threads = `clone` sharing memory). `posix_spawn` = fork+exec done
efficiently by the library.

**Q: Zombie process — what is it, how do you clear it?**
A terminated child whose exit status the parent hasn't `wait()`ed for.
It holds only a PID slot. Fix: parent must reap; if the parent is buggy,
kill the parent and `init` reaps the orphan.

---

## Filesystems & VFS

**Q: What is the VFS?**
The kernel abstraction that makes every filesystem (and `/proc`, `/sys`,
sockets, pipes, devices) present the same `inode`/`dentry`/`file` API,
so one set of syscalls works everywhere.

**Q: Hard link vs symlink?**
Hard link = another directory entry pointing at the same inode (same
filesystem, no link to directories, survives original deletion).
Symlink = a tiny file containing a path, resolved at open time, can
cross filesystems and dangle.

**Q: What is an inode? What isn't stored in it?**
Metadata: type, permissions, owner, size, timestamps, link count, and
block pointers. The **filename** is not in the inode — it's in the
directory entry that points to the inode.

**Q: `df` says full, `du` says half — why?**
A deleted file still held open by a process: the directory entry is
gone (`du` can't see it) but the blocks aren't freed until the last fd
closes (`df` still counts them). `lsof +L1` finds it. Or: inode
exhaustion — `df -i`.

**Q: What does `fsync()` guarantee vs `write()`?**
`write()` returns when data is in the page cache. `fsync(fd)` returns
only after that file's data *and metadata* are durable on the device
(assuming the drive honours cache-flush).

---

## Namespaces & cgroups

**Q: Name the namespace types and what each isolates.**
`mnt` (mounts), `pid` (process IDs), `net` (interfaces/routes/ports),
`uts` (hostname), `ipc` (SysV IPC/POSIX queues), `user` (UID/GID
mapping), `cgroup` (cgroup root view), `time` (boot/monotonic clocks).

**Q: cgroups v1 vs v2 — the key difference?**
v1 = multiple independent hierarchies (one per controller). v2 = a
single unified hierarchy, cleaner delegation, better memory accounting,
`cpu.max`/`cpu.weight`/`memory.max`/`io.max`.

**Q: How does a container differ from a VM, one sentence?**
A container is a set of namespaced + cgroup-limited processes sharing
the host kernel; a VM runs its own kernel on virtual hardware.

**Q: `cpu.max` vs `cpu.weight`?**
`cpu.max "QUOTA PERIOD"` is a hard ceiling (e.g. `50000 100000` = 0.5
CPU). `cpu.weight` is proportional share of the *remainder* when the CPU
is contended (default 100).

---

## Quick-fire

- **`strace` vs `ltrace` vs `perf trace`?** syscalls / library calls /
  syscalls with far less overhead (perf).
- **What's in `/proc/<pid>/`?** `status`, `stat`, `maps`, `fd/`,
  `cmdline`, `environ`, `stack`, `limits`, `smaps`.
- **`ulimit -n` — what and where set?** max open fds; `/etc/security/limits.d/`
  or systemd `LimitNOFILE=`.
- **What is `THP`?** Transparent Huge Pages — kernel auto-promotes 4K→2M;
  its `khugepaged` compaction causes latency spikes, often set to
  `madvise` or `never` for HPC/DBs.
- **`kswapd` at 100% CPU means?** memory pressure; the kernel is
  scanning/reclaiming pages continuously — you're near OOM.
