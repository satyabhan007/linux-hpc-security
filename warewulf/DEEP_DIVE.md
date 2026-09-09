# Warewulf Provisioning — Deep Dive: Production Scenarios

---

## Scenario 1 — A node won't PXE boot

**Symptom.** `cpu047` sits at `PXE-E53: No boot filename received` or
loops `DHCP...DHCP...DHCP`.

**Diagnose in boot order.**
```bash
# 1. is the node even reaching DHCP? watch on the controller:
tcpdump -ni provision0 port 67 or port 68 -e | grep -i <MAC>
journalctl -u warewulfd -f
wwctl node list -a cpu047                 # is the MAC registered? right netdev?

# 2. DHCP offering next-server + filename?
tcpdump -ni provision0 port 67 -vv        # look for option 66 / 67 in the OFFER

# 3. TFTP serving the iPXE binary?
journalctl -u tftp.socket -u tftp@*  ;  ls -l /var/lib/tftpboot/warewulf/
tftp <controller> -c get warewulf/x86_64.efi

# 4. HTTP serving kernel + image?
curl -sI http://<controller>:9873/provision/...
```

**Common root causes.**
| Symptom | Cause |
|---|---|
| loops at DHCP | MAC not registered, or wrong `--netdev`, or another rogue DHCP server on the VLAN |
| `No boot filename` | `next-server`/`filename` not set for the node's profile; UEFI vs BIOS binary mismatch |
| gets iPXE then hangs | HTTP unreachable (firewall on 9873), or wrong `--kernelargs` |
| kernel panics "no root" | image not built (`wwctl container build`), or overlay error |
| Secure Boot fails | unsigned shim/kernel; need the signed `shim.efi` chain |

---

## Scenario 2 — Boot storm after a datacenter power event

**Symptom.** Power restored; 1,800 nodes PXE-boot simultaneously. The
controller's `httpd` pegs at 100% CPU, TFTP times out, half the nodes
fail to boot and retry, making it worse.

**Immediate mitigation.** Power the racks back on in staggered groups
(PDU scripting / `ipmitool ... power on` in batches of ~50 with a
`sleep 30`).

**Permanent fixes.**
- **Multiple Warewulf controllers**, DHCP split by scope or with
  `failover` peers; nodes' profiles point at different `next-server`s
  per rack.
- **Per-rack caching HTTP proxy** (nginx `proxy_cache`) for the big
  image + kernel objects; only the first node per rack pulls from the
  controller.
- **Boot delay** in kernel args (`rd.retry`, or a custom init sleep
  keyed off the last octet of the IP) so nodes ramp in over a few
  minutes.
- Put the image store on fast local NVMe on the controller, not NFS.

---

## Scenario 3 — Kernel/driver upgrade across the fleet

**Goal.** New kernel + new OFED/GPU driver, zero unplanned downtime,
fast rollback.

```bash
# 1. build the new image in CI from a Containerfile, tag it
wwctl container import ./rocky9.Containerfile rocky9:v2026.10
wwctl container build rocky9:v2026.10

# 2. canary
wwctl node set --container rocky9:v2026.10 cpu999
ipmitool -H cpu999-bmc ... power cycle
#    run acceptance: STREAM, HPL-1node, osu_latency, ibstat, nvidia-smi, mount checks

# 3. roll in waves, draining first (Ansible, Module 6)
for wave in "cpu[001-050]" "cpu[051-200]" ...; do
  ansible "$wave" -m command -a "scontrol update nodename={{inventory_hostname}} state=drain reason=kernel"
  # wait for idle, then:
  wwctl node set --container rocky9:v2026.10 "$wave"
  ansible "$wave" -m reboot
  ansible "$wave" -m command -a "/usr/sbin/nhc"   # health check
  ansible "$wave" -m command -a "scontrol update nodename={{inventory_hostname}} state=resume"
done

# rollback = set the tag back and reboot; no state to unwind
```

**Diff before you roll** (Lab: `step3_image_diff.py`): a kernel bump or
kernel-cmdline change is *reboot-required*; an MPI major-version bump is
*canary-first* (ABI/perf risk); a changed `slurm.conf` in a system
overlay means *review the diff* before it locks the scheduler out.

---

## Scenario 4 — "It works on cpu001 but not cpu002" on identical nodes

On a stateless fleet this should be **impossible** for anything in the
image. So it's one of:
- an **overlay template** bug that renders differently for that node
  (`{{ if }}` on a tag only some nodes have, a bad `NetDevs` loop)
- a **hardware** difference (a DIMM, a dead NIC port, a BMC on old
  firmware) — `dmidecode`, `ibstat`, `ethtool` diff against a sibling
- a **runtime overlay** that didn't refresh (`wwctl overlay build` not
  run, or the node's periodic pull failed) — check the overlay version
  on the node vs the controller

`wwctl overlay show runtime --render cpu002` prints exactly what that
node will get — diff it against `cpu001`.

---

## Scenario 5 — Node RAM pressure from the tmpfs rootfs

**Symptom.** Stateless nodes with 96 GB RAM: jobs OOM sooner than
expected; `df -h /` shows the rootfs using 8–15 GB of tmpfs.

**Fixes.**
- Trim the image: it's a *compute node*, not a workstation — remove
  docs, `-devel` packages you don't build on nodes, GUI stacks, unused
  locales/firmware.
- Move `/tmp`, `/var/log`, `/scratch` to local NVMe (hybrid mode) so
  they don't consume RAM.
- Use `overlayfs` with a squashfs lower layer (read-only, not counted as
  tmpfs) + a small tmpfs upper.
- Account for the rootfs in the Slurm `RealMemory` / `MemSpecLimit` so
  the scheduler doesn't hand jobs memory the OS is using.

---

## A sane Warewulf layout

```
controller:
  /var/lib/warewulf/
    chroots/            # imported container images
    overlays/system/    # baked-in per-node config templates
    overlays/runtime/   # live-refreshed config templates
  /etc/warewulf/warewulf.conf   # DHCP range, TFTP/HTTP, netdev, ipaddr

CI:
  images/rocky9.Containerfile         # the node OS, as code
  overlays/                            # templates, in git
  .github/workflows/build-image.yml    # build + smoke-test image in a container

node profiles:
  default   -> container=rocky9:stable, runtime=hosts,slurm, nfs
  gpu       -> + nvidia overlay, tags: {gpu_count: 8}
  login     -> different container, no compute overlays
```
