#!/usr/bin/env python3
"""
Warewulf · Step 1 — the network-boot handshake as a state machine.

A diskless node has no OS. It gets one by walking a fixed chain:

  1. DHCP  DISCOVER  -> OFFER  (IP + next-server + boot filename)
  2. TFTP  RRQ boot-file        (iPXE binary; TFTP is tiny + simple)
  3. iPXE  HTTP GET  vmlinuz + initramfs   (HTTP is fast)
  4. Warewulf init: HTTP GET  container image  + system/runtime overlays
  5. switch_root -> /sbin/init

This runs the chain, checks each response has what the next stage needs,
and shows how a single missing DHCP option stalls the whole node.
"""

def dhcp(server_cfg, mac):
    if mac not in server_cfg["known_macs"]:
        return {"ok": False, "why": f"unknown MAC {mac} — node not registered (wwctl node add)"}
    resp = {"ok": True, "yiaddr": server_cfg["pool"][mac], "options": {}}
    # option 66 (next-server) + 67 (boot filename) are what PXE needs
    if server_cfg.get("next_server"):
        resp["options"][66] = server_cfg["next_server"]
    if server_cfg.get("boot_file"):
        resp["options"][67] = server_cfg["boot_file"]
    return resp


def tftp(dhcp_resp, tftp_root):
    if 66 not in dhcp_resp["options"] or 67 not in dhcp_resp["options"]:
        return {"ok": False, "why": "no next-server/boot-file in DHCP OFFER — node PXE-times-out"}
    fn = dhcp_resp["options"][67]
    if fn not in tftp_root:
        return {"ok": False, "why": f"TFTP has no {fn}"}
    return {"ok": True, "downloaded": fn, "bytes": tftp_root[fn]}


def ipxe_http(http_root, kver):
    need = [f"vmlinuz-{kver}", f"initramfs-{kver}.img"]
    missing = [n for n in need if n not in http_root]
    if missing:
        return {"ok": False, "why": f"HTTP missing {missing}"}
    return {"ok": True, "kernel_args": f"root=wwinit ww4.node=cpu001 wwid={kver} quiet"}


def wwinit(http_root, image_tag):
    need = [f"image::{image_tag}", "overlay::system", "overlay::runtime"]
    missing = [n for n in need if n not in http_root]
    if missing:
        return {"ok": False, "why": f"HTTP missing {missing}"}
    return {"ok": True, "rootfs": image_tag, "pivot": "/sbin/init"}


def boot(server_cfg, mac, tftp_root, http_root, kver, image_tag):
    trace = []
    d = dhcp(server_cfg, mac); trace.append(("DHCP", d))
    if not d["ok"]:
        return trace
    t = tftp(d, tftp_root); trace.append(("TFTP", t))
    if not t["ok"]:
        return trace
    i = ipxe_http(http_root, kver); trace.append(("iPXE/HTTP", i))
    if not i["ok"]:
        return trace
    w = wwinit(http_root, image_tag); trace.append(("wwinit", w))
    return trace


def show(label, trace):
    print(f"  {label}")
    for stage, r in trace:
        mark = "ok  " if r["ok"] else "FAIL"
        extra = r.get("why", r.get("downloaded", r.get("rootfs", r.get("kernel_args", ""))))
        print(f"    {stage:<10} {mark} {extra}")
    print()


def main():
    GOOD = {
        "known_macs": {"aa:bb:cc:00:00:01"},
        "pool": {"aa:bb:cc:00:00:01": "10.0.1.53"},
        "next_server": "10.0.0.1",
        "boot_file": "undionly.kpxe",
    }
    TFTP_ROOT = {"undionly.kpxe": 89012}
    HTTP_ROOT = {
        "vmlinuz-6.6.0": 12_000_000, "initramfs-6.6.0.img": 40_000_000,
        "image::rocky9-compute:v2026.09": 1_800_000_000,
        "overlay::system": 12000, "overlay::runtime": 8000,
    }

    ok = boot(GOOD, "aa:bb:cc:00:00:01", TFTP_ROOT, HTTP_ROOT,
              "6.6.0", "rocky9-compute:v2026.09")
    show("healthy node:", ok)
    assert [s for s, _ in ok] == ["DHCP", "TFTP", "iPXE/HTTP", "wwinit"]
    assert all(r["ok"] for _, r in ok)

    # break DHCP option 66 -> node dies at TFTP with a PXE timeout
    bad = dict(GOOD); bad["next_server"] = None
    t2 = boot(bad, "aa:bb:cc:00:00:01", TFTP_ROOT, HTTP_ROOT, "6.6.0", "x")
    show("DHCP missing next-server:", t2)
    assert t2[-1][0] == "TFTP" and not t2[-1][1]["ok"]

    # unregistered MAC -> never even gets an IP
    t3 = boot(GOOD, "de:ad:be:ef:00:99", TFTP_ROOT, HTTP_ROOT, "6.6.0", "x")
    show("unregistered node:", t3)
    assert len(t3) == 1 and t3[0][0] == "DHCP" and not t3[0][1]["ok"]

    print("PASS — the chain succeeds end to end; one missing DHCP option stalls it at TFTP.")


if __name__ == "__main__":
    main()
