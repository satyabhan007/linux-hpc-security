# Linux Internals & the Boot Path — The Amateur's Guide

> The kernel's whole job is to lie convincingly: it tells every program
> "you have the machine to yourself", and it tells you "memory is a
> simple number". Neither is true, and both lies are load-bearing.

---

## 1. Power-on to login prompt, in one breath

1. **Firmware (UEFI/BIOS)** wakes up, tests RAM and devices, finds a disk
   with a boot partition, loads the first stage of a **bootloader**.
2. **GRUB** shows the menu, loads the **Linux kernel** (`vmlinuz`) and a
   small temporary root filesystem (`initramfs`) into RAM.
3. The **kernel** initialises drivers, mounts the `initramfs`, then uses
   it to find and mount the *real* root filesystem (which might need LVM,
   RAID, LUKS, or a network — that's why initramfs exists).
4. The kernel starts **PID 1** — `systemd` — and never starts another
   process directly again.
5. `systemd` brings up units in dependency order until you get
   `sshd.service` and a login prompt.

**Analogy — opening a shop.** Security unlocks the building (firmware),
the manager reads the opening checklist (kernel init), the temporary
till float comes out of the safe (initramfs), the real tills are
connected (root fs), and then staff take their posts (systemd units).
Customers — your commands — only matter once everyone is in place.

A server "stuck on boot" is stuck at exactly one of these handoffs:
*no boot device* (firmware), *grub rescue>* (bootloader), *Give root
password for maintenance* (an `/etc/fstab` entry that would not mount).

---

## 2. Every process gets a private universe

Two illusions, built by the kernel:

### Virtual memory
Each process sees a huge, private, contiguous address space. The **MMU**
+ **page tables** map 4 KiB **pages** of that virtual space to real RAM,
to swap, or to a file — *only when the page is first touched* (a **page
fault** fills it in).

- **Minor fault**: the page is already in RAM (a shared library, a
  cached file). Wire up the mapping. ~0.2 µs.
- **Major fault**: the page must be read from disk. ~milliseconds —
  about **10,000× slower**. A high major-fault rate means you are
  *thrashing*: your working set does not fit in RAM.

**Analogy — a hotel.** Every guest is told they have room 100. The front
desk (page table) secretly maps each "room 100" to a different real
room, and rooms are only cleaned and handed over when a guest actually
shows up (demand paging).

### The virtual filesystem (VFS)
Disks, sockets, devices, and kernel state all appear as files under one
tree. `cat /proc/cpuinfo` and `cat notes.txt` use the *same* `open`,
`read`, `close` syscalls. `/proc` and `/sys` are windows into live
kernel data structures, not real files.

---

## 3. Sharing one CPU: the scheduler

Hundreds of threads want to run; there are 8, 48, 128 CPUs. The
**scheduler** picks who runs next. Linux used **CFS** for ~15 years and
switched to **EEVDF** in kernel 6.6. Both track each task's
**virtual runtime** (CPU time consumed, divided by the task's weight)
and run whoever is furthest behind — so a fair share of CPU, weighted by
`nice`.

**Analogy — a fair cashier at one checkout.** Everyone is served in
short bursts, so nobody starves. "Load average" counts the queue.

> **Load is not CPU usage.** Load average counts tasks *running* **plus**
> tasks in **uninterruptible I/O sleep** (state `D`). A load of 40 on an
> 8-core box with the CPU 90% idle means ~32 processes are frozen waiting
> on a slow disk or a hung NFS mount, not that the CPU is overwhelmed.

---

## 4. One kernel pretending to be many: namespaces + cgroups

- **Namespace** = a private view of *one* resource. `pid` (own PID 1),
  `net` (own interfaces + routes), `mnt` (own mounts), `uts` (own
  hostname), `user` (root inside, nobody outside). Stack them and you
  have a container.
- **cgroup** (v2 = one unified tree) = *accounting and limits* for a
  group of processes: `cpu.max`, `cpu.weight`, `memory.max`, `io.max`,
  `pids.max`. Breach `memory.max` and the **cgroup-scoped OOM killer**
  fires — it kills something *inside that cgroup*, not a random victim
  system-wide.

**Analogy — an apartment building.** Namespaces give each apartment its
own address, mailbox, and locks. cgroups are the per-apartment fuse box:
overload your circuit and *your* fuse trips, not the building main.

`systemd` already runs every service in its own cgroup — that's what
`systemctl status` means by "Tasks: 1, Memory: 6.4M".

---

## 5. Where the performance actually goes

- **"Free memory" is a myth.** Linux uses spare RAM as **page cache**
  and gives it back instantly under pressure. Watch `MemAvailable` in
  `/proc/meminfo`, never `MemFree`. (Lab: `step1_proc_meminfo.py`.)
- **Dirty writeback.** Unwritten ("dirty") pages accumulate until
  `vm.dirty_ratio`; past that, *every write blocks* until writeback
  drains. The classic "database went slow at 2 a.m." is a backup job
  filling the dirty-page budget.
- **NUMA.** On a 2-socket box, RAM has a *distance*. A page on the wrong
  socket costs ~1.5× latency. (Module 12.)
- **Syscalls cost.** Every one is a user↔kernel switch. `io_uring` and
  **eBPF** (Module 5) exist to do more work per crossing.

---

## 6. Run the labs

```bash
python3 linux/step1_proc_meminfo.py     # MemAvailable vs MemFree, the kernel's own heuristic
python3 linux/step2_page_cache_sim.py   # minor vs major faults; the thrash cliff
python3 linux/step3_scheduler_sim.py    # a fair scheduler from vruntime, in 40 lines
```

Next: **`hardening/`** — taking this default machine and making it
defensible. Then **`tuning/`** (Module 12) goes back into the kernel for
the last 20% of performance.
