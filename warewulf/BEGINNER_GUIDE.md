# Warewulf Provisioning — The Amateur's Guide

> A hotel where every room is made up from one master template each
> morning, plus a small card with that room's number and preferences.
> Rooms never "drift" — a messy room is fixed by re-making it, not by
> cleaning around the mess.

---

## 1. What Warewulf does

Provisions cluster nodes **over the network**: no per-node OS install,
no local disk required. The controller holds:

- **one node image** (in Warewulf 4, an OCI container image)
- a set of **overlays** (small per-node differences)

Each compute node PXE-boots, pulls the image into RAM (or to disk for
stateful mode), applies its overlays, and is running the full OS in
~2 minutes. Adding a node = rack it, register its MAC, power on.

The payoff: **a fleet with no snowflakes.** Drift is structurally
impossible. Debugging becomes "compare to a sibling"; recovery is a
reboot, not a ticket.

---

## 2. The network-boot handshake

```
1. node NIC  --DHCP DISCOVER-->  Warewulf DHCP
   Warewulf   --DHCP OFFER---->  IP + next-server (66) + boot filename (67)
2. node       --TFTP RRQ------->  fetch iPXE binary        (TFTP: tiny, simple)
3. iPXE       --HTTP GET------->  vmlinuz + initramfs      (HTTP: fast)
   kernel args: quiet ww4.node=cpu001 wwid=...
4. wwinit     --HTTP GET------->  container image rootfs
              --HTTP GET------->  system overlay + runtime overlay
5. switch_root  -->  /sbin/init  (systemd)
```

**Analogy.** Asking directions at the border (DHCP), getting a basic
paper map to the depot (TFTP/iPXE), then at the depot getting a fast car
and full GPS (HTTP kernel), which drives you to a furnished house
(image + overlays).

One missing DHCP option (`next-server`) → the node PXE-times-out at step
2. An unregistered MAC → it never gets past step 1. (Lab:
`step1_pxe_handshake.py`.)

---

## 3. The node image *is* a container

```bash
wwctl container import docker://rockylinux:9  rocky9-base
wwctl container shell rocky9-base            # chroot in, add Slurm/Lustre/MPI/monitoring
wwctl container build rocky9-base            # bake the bootable image
wwctl node set --container rocky9-base cpu[001-200]
```

Better than a chroot: a **Containerfile** built in CI, so the node OS is
versioned, diffable, and testable in a container before a single node
reboots.

**Kernel upgrade on 1,000 nodes:** build image `v2026.09`, boot it on
one canary, run the acceptance benchmarks (Module 4), then
`wwctl node set --container v2026.09 cpu[001-1000]` and roll reboots in
waves. Rollback = set the tag back. (Lab: `step3_image_diff.py` models
the pre-roll diff.)

---

## 4. Overlays — how identical nodes get their differences

| Overlay type | When applied | Good for |
|---|---|---|
| **system** | at build/provision, baked in | base network config, `/etc/resolv.conf`, sshd host-key strategy |
| **runtime** | fetched + refreshed on the *running* node | `/etc/hosts`, `/etc/slurm/`, munge key, user list — things that change without a reboot |

Overlays are **Go templates**: `{{ .Ipaddr }}`, `{{ .Hostname }}`,
`{{ range .NetDevs }}…{{ end }}`, `{{ if .Bonded }}…{{ end }}` — one
file renders per node. (Lab: `step2_overlay_render.py`.)

**Analogy.** The master uniform (image) vs the name badge and today's
shift card (overlays). The uniform changes once a season; the badge is
printed per person; the shift card is swapped daily with no new uniform.

```bash
wwctl overlay create runtime
wwctl overlay import runtime /etc/hosts.ww    # a template
wwctl overlay build                            # render for all nodes
wwctl node set --runtime-overlay runtime,slurm cpu[001-200]
```

---

## 5. Stateless vs stateful

- **Stateless** (default): rootfs lives in `tmpfs` (RAM). Reboot = clean
  slate. Size node RAM to hold the rootfs + working set, or go hybrid.
- **Stateful**: Warewulf writes the image to a local disk partition;
  used when RAM is tight or you want persistence across reboots.
- **Hybrid**: rootfs in RAM, `/scratch` or a writable overlay on local
  NVMe.

---

## 6. Operating it

- **Controller HA.** It's now in the boot path for the whole cluster.
  (Booted nodes keep running if it dies; new/rebooted nodes can't come
  up.) Run a redundant controller.
- **Boot storms.** A mass reboot after a power event can DDoS your own
  provisioning server. Fixes: multiple controllers, per-rack HTTP
  caching proxies, or a staggered boot delay in the kernel args.
- **Provisioning VLAN** segmented from user traffic; DHCP authoritative
  only there.
- Pair with **Ansible** (Module 6) for day-2 config that shouldn't need
  an image rebuild.

**Alternatives:** xCAT (IBM heritage, heavier), Bright/BCM (commercial),
MAAS (cloud-style), Foreman/Katello (stateful + Puppet).

---

## 7. Run the labs

```bash
python3 warewulf/step1_pxe_handshake.py    # the DHCP->TFTP->HTTP chain as a state machine
python3 warewulf/step2_overlay_render.py   # one Go-template overlay -> N node files
python3 warewulf/step3_image_diff.py       # diff two node images, get a rollout risk verdict
```

Next: **`hpc/`** — the scheduler that turns these provisioned nodes into
a shared supercomputer.
