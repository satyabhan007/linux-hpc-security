# Warewulf Provisioning — Interview Q&A

---

## Model

**Q: What does Warewulf do, in one sentence?**
Stateless (diskless) network provisioning for cluster nodes: one image
+ per-node overlays, PXE-booted, so every node is byte-identical and a
reboot is the repair procedure.

**Q: Stateless vs stateful provisioning?**
Stateless: rootfs runs from RAM (tmpfs), reboot = clean slate, no drift.
Stateful: image is written to a local disk and persists. Hybrid: RAM
rootfs + local disk for `/tmp`, `/var/log`, `/scratch`.

**Q: Warewulf 4's big architectural change from v3?**
Node images are OCI container images — import from a registry or build
with a Containerfile, version by tag, test in a container, roll by
changing the assigned tag.

---

## The boot chain

**Q: Walk the network boot handshake.**
NIC sends DHCP DISCOVER → server OFFERs an IP plus `next-server` (opt 66)
and boot `filename` (opt 67) → node fetches iPXE over TFTP → iPXE fetches
kernel + initramfs over HTTP → the Warewulf init in the initramfs pulls
the image + overlays over HTTP → `switch_root` to the real root →
systemd.

**Q: Why TFTP then HTTP — why not one protocol?**
Firmware PXE ROMs only speak TFTP (tiny, no auth, UDP) — just enough to
pull the iPXE binary. iPXE then speaks HTTP, which is far faster and
more robust for the multi-hundred-MB kernel/initramfs and multi-GB
image.

**Q: DHCP options 66 and 67?**
66 = `next-server` (the TFTP/boot server address). 67 = boot `filename`
(the file to fetch, e.g. the iPXE binary). Missing either → `No boot
filename received` and a PXE timeout.

**Q: A node loops forever at "DHCP...". Causes?**
MAC not registered in Warewulf, wrong `--netdev` for the node, the node
booting on the wrong NIC, a rogue DHCP server on the provisioning VLAN,
or link/VLAN misconfig on the switch port.

**Q: BIOS vs UEFI vs Secure Boot in this chain?**
UEFI needs a `*.efi` boot file (not `undionly.kpxe`); Secure Boot needs
a signed `shim` → signed GRUB/iPXE → signed kernel chain. A common
failure is offering the BIOS binary to a UEFI node.

---

## Images

**Q: How do you update the kernel on 1,000 nodes?**
Build a new image tag, canary it on one node with acceptance tests,
then `wwctl node set --container <tag>` for a wave and reboot (drained
first). Rollback = set the tag back and reboot — no state to unwind.

**Q: Where do you build the image — chroot or CI?**
CI, from a `Containerfile` in git: reproducible, reviewable, diffable,
and testable in a plain container before any node reboots.
`wwctl container shell` is fine for exploration, not for production
change control.

**Q: What must be in a compute-node image that isn't in a base OS?**
MPI + the fabric user-space (libibverbs/UCX/libfabric), the parallel
-FS client (Lustre/BeeGFS), the resource-manager client (slurmd, munge),
environment modules/Lmod, monitoring agents, and NHC. Strip GUI, docs,
`-devel` you don't need.

---

## Overlays

**Q: System overlay vs runtime overlay?**
System: applied at provision/build time, baked in — needs a
re-provision/reboot to change. Runtime: rebuilt and re-pulled on the
*running* node — for files that change without a reboot (`/etc/hosts`,
`/etc/slurm/`, munge key, users).

**Q: What language are overlay templates?**
Go `text/template`: `{{ .Hostname }}`, `{{ .Ipaddr }}`,
`{{ range .NetDevs }}`, `{{ if .Tags.gpu }}` — rendered once per node
from that node's facts/tags.

**Q: You changed `slurm.conf` and need it on all nodes now, no reboot.
How?**
Put it in a **runtime** overlay, `wwctl overlay build`, and let the
nodes' periodic pull (or a push) pick it up. A system overlay would
require re-provisioning.

---

## Operations

**Q: Is the Warewulf controller a single point of failure?**
For *new/rebooting* nodes, yes — they can't come up without it.
Already-running nodes keep running. Mitigate with a redundant
controller and DHCP failover.

**Q: What is a "boot storm" and how do you survive one?**
Many nodes PXE-booting at once (post power event) overwhelming the
controller's TFTP/HTTP. Mitigate: multiple controllers, per-rack HTTP
caching proxies, staggered power-on, and a boot delay in kernel args.

**Q: How does Warewulf fit with Ansible?**
Image + overlays for the base OS and node identity (survives reboot with
zero action); Ansible for day-2 config, orchestration (drain → patch →
verify), users/keys, and compliance remediation that shouldn't force an
image rebuild.

**Q: Warewulf vs xCAT vs Bright/BCM?**
Warewulf: lightweight, container-image-based, open source, stateless
-first. xCAT: older, heavier, very feature-complete, IBM heritage.
Bright/BCM (NVIDIA): commercial, GUI, integrated monitoring + scheduler
+ provisioning.

**Q: How do you debug "identical nodes behave differently" on a
stateless fleet?**
It can't be the image, so: an overlay template that renders differently
(bad `if`/`range`, a tag mismatch), a stale runtime overlay that didn't
refresh, or a hardware difference. `wwctl overlay show --render <node>`
and `dmidecode`/`ibstat` diff against a healthy sibling.
