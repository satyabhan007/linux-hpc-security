#!/usr/bin/env python3
"""
Warewulf · Step 3 — diff two node images before you roll them.

A Warewulf node image is a container image: versioned, and crucially
*diffable*. Before pushing v2 to 1,000 nodes you compare it to the
running v1 — package adds/removes/upgrades and changed critical files —
and decide whether it is a safe rolling reboot or a canary-first change.

This models two image manifests and produces that diff + a risk verdict.
"""

V1 = {
    "packages": {
        "kernel": "6.6.0-14", "slurm": "23.11.1", "lustre-client": "2.15.4",
        "openmpi": "4.1.6", "munge": "0.5.15", "openssh-server": "8.7p1-38",
        "prometheus-node-exporter": "1.7.0",
    },
    "files": {
        "/etc/slurm/slurm.conf": "sha:aaa1",
        "/etc/security/limits.d/99-hpc.conf": "sha:lim1",
        "/usr/lib/systemd/system/slurmd.service": "sha:svc1",
        "/etc/ssh/sshd_config": "sha:ssh1",
    },
    "kernel_cmdline": "crashkernel=auto rd.lvm=0 transparent_hugepage=never",
}

V2 = {
    "packages": {
        "kernel": "6.6.0-20",                 # upgrade (kernel! reboot required)
        "slurm": "23.11.6",                    # upgrade (minor)
        "lustre-client": "2.15.4",             # same
        "openmpi": "5.0.2",                    # MAJOR upgrade — ABI risk
        "munge": "0.5.15",
        "openssh-server": "9.6p1-1",           # upgrade
        "prometheus-node-exporter": "1.7.0",
        "numactl": "2.0.16",                   # added
        # 'prometheus-node-exporter' kept; nothing removed
    },
    "files": {
        "/etc/slurm/slurm.conf": "sha:aaa2",   # CHANGED (critical)
        "/etc/security/limits.d/99-hpc.conf": "sha:lim1",
        "/usr/lib/systemd/system/slurmd.service": "sha:svc1",
        "/etc/ssh/sshd_config": "sha:ssh2",    # CHANGED (critical)
    },
    "kernel_cmdline": "crashkernel=auto rd.lvm=0 transparent_hugepage=never numa_balancing=disable",
}

CRITICAL_FILES = {"/etc/slurm/slurm.conf", "/etc/ssh/sshd_config",
                  "/etc/security/limits.d/99-hpc.conf"}
ABI_SENSITIVE = {"openmpi", "lustre-client", "kernel"}


def semver_major(v):
    return v.split(".")[0].split("-")[0]


def diff(a, b):
    pa, pb = a["packages"], b["packages"]
    added = {k: pb[k] for k in pb.keys() - pa.keys()}
    removed = {k: pa[k] for k in pa.keys() - pb.keys()}
    upgraded = {k: (pa[k], pb[k]) for k in pa.keys() & pb.keys() if pa[k] != pb[k]}

    changed_files = [f for f in a["files"].keys() & b["files"].keys()
                     if a["files"][f] != b["files"][f]]
    cmdline_changed = a["kernel_cmdline"] != b["kernel_cmdline"]
    return added, removed, upgraded, changed_files, cmdline_changed


def risk(added, removed, upgraded, changed_files, cmdline_changed):
    reasons = []
    if "kernel" in upgraded:
        reasons.append(("reboot-required", "kernel upgraded — nodes must reboot, not live-patch"))
    for pkg, (o, n) in upgraded.items():
        if pkg in ABI_SENSITIVE and semver_major(o) != semver_major(n):
            reasons.append(("canary-first", f"{pkg} {o}->{n} crosses a major version — ABI/perf risk"))
    for f in changed_files:
        if f in CRITICAL_FILES:
            reasons.append(("review-diff", f"{f} changed — a bad value locks out or breaks the scheduler"))
    if cmdline_changed:
        reasons.append(("reboot-required", "kernel cmdline changed — only applies on reboot"))
    if removed:
        reasons.append(("canary-first", f"packages removed: {sorted(removed)}"))
    verdict = "canary-first" if any(r[0] == "canary-first" for r in reasons) else \
              "rolling-reboot" if reasons else "live-safe"
    return verdict, reasons


def main():
    added, removed, upgraded, changed_files, cmd = diff(V1, V2)

    print("packages added:   ", added or "-")
    print("packages removed: ", removed or "-")
    print("packages upgraded:")
    for k, (o, n) in sorted(upgraded.items()):
        print(f"    {k:<26} {o}  ->  {n}")
    print("critical files changed:", [f for f in changed_files if f in CRITICAL_FILES])
    print("kernel cmdline changed:", cmd)

    verdict, reasons = risk(added, removed, upgraded, changed_files, cmd)
    print(f"\nverdict: {verdict.upper()}")
    for tag, why in reasons:
        print(f"  [{tag}] {why}")

    assert added == {"numactl": "2.0.16"}
    assert removed == {}
    assert "kernel" in upgraded and "openmpi" in upgraded
    assert set(f for f in changed_files if f in CRITICAL_FILES) == \
        {"/etc/slurm/slurm.conf", "/etc/ssh/sshd_config"}
    # openmpi 4 -> 5 is a major bump => must canary first, not blind rolling reboot
    assert verdict == "canary-first"
    assert any("openmpi" in why for _, why in reasons)
    assert any(tag == "reboot-required" for tag, _ in reasons)   # kernel + cmdline

    print("\nPASS — diff surfaces the kernel + MPI-major + slurm.conf changes; verdict is canary-first.")


if __name__ == "__main__":
    main()
