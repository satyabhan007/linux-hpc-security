#!/usr/bin/env python3
"""
Containers · Step 3 — the bind-mount set for containerised MPI over RDMA.

A container that ships its own MPI must still use the HOST's fabric to
get RDMA. Two working models:

  hybrid/bind : mount host MPI + verbs libs + /dev/infiniband into the
                container. Fast, but the container MPI ABI must be
                compatible with the host libraries.
  matched-PMI : container ships a host-compatible MPI; only the process
                manager interface (PMI/PMIx socket) is shared.

If neither holds, MPI silently falls back to the TCP sockets path and
runs ~10x slower. This lab computes the required binds and detects the
mismatch.
"""

HOST = {
    "mpi": ("openmpi", "5.0.2"),
    "pmix": "4.2.6",
    "libs": ["/usr/lib64/libibverbs.so.1", "/usr/lib64/librdmacm.so.1",
             "/usr/lib64/libmlx5.so.1", "/usr/lib64/libucp.so.0"],
    "devices": ["/dev/infiniband/uverbs0", "/dev/infiniband/rdma_cm"],
    "ucx": "1.16.0",
}


def plan_binds(container, model):
    binds, notes = [], []
    if model == "bind":
        binds += HOST["libs"] + HOST["devices"]
        binds.append("/opt/openmpi-5.0.2")            # host MPI tree
        # ABI check: container's linked MPI soname vs host
        c_name, c_ver = container["mpi"]
        h_name, h_ver = HOST["mpi"]
        if c_name != h_name or c_ver.split(".")[0] != h_ver.split(".")[0]:
            notes.append(f"ABI MISMATCH: container {c_name}{c_ver} vs host {h_name}{h_ver}"
                         " -> bind model unsafe, expect TCP fallback")
            return binds, notes, "tcp-fallback"
        return binds, notes, "rdma"
    elif model == "matched-pmi":
        c_name, c_ver = container["mpi"]
        h_name, h_ver = HOST["mpi"]
        # container brings its own fabric stack; only PMIx socket shared
        binds += HOST["devices"]
        binds.append("/var/run/pmix")
        if container.get("pmix_compat") and c_name == h_name and \
           c_ver.split(".")[0] == h_ver.split(".")[0]:
            return binds, notes, "rdma"
        notes.append("PMIx/MPI not host-compatible -> PMI bootstrap fails or TCP")
        return binds, notes, "tcp-fallback"
    raise ValueError(model)


def main():
    good = {"mpi": ("openmpi", "5.0.3"), "pmix_compat": True}   # same major as host
    bad = {"mpi": ("openmpi", "4.1.6"), "pmix_compat": False}   # major 4 vs host 5
    mpich = {"mpi": ("mpich", "4.2.0"), "pmix_compat": False}

    for label, c in [("host-matched openmpi 5.x", good),
                     ("stale openmpi 4.x", bad),
                     ("mpich container", mpich)]:
        binds, notes, transport = plan_binds(c, "bind")
        print(f"\n{label}  (model=bind)")
        print(f"  --bind {','.join(b.split('/')[-1] for b in binds[:4])}...  "
              f"({len(binds)} paths)")
        for n in notes:
            print(f"  ! {n}")
        print(f"  => transport: {transport.upper()}")

    b1, n1, t1 = plan_binds(good, "bind")
    b2, n2, t2 = plan_binds(bad, "bind")
    b3, n3, t3 = plan_binds(mpich, "bind")
    assert t1 == "rdma" and not n1
    assert t2 == "tcp-fallback" and n2, "openmpi 4 in container vs host 5 => unsafe"
    assert t3 == "tcp-fallback", "different MPI implementation => bind model won't give RDMA"

    # the matched-PMI model rescues the good container without binding host MPI tree
    b4, n4, t4 = plan_binds(good, "matched-pmi")
    assert t4 == "rdma"
    assert "/opt/openmpi-5.0.2" not in b4, "matched-PMI does not bind the host MPI tree"
    assert "/dev/infiniband/uverbs0" in b4, "still needs the IB device nodes"

    # required verbs libs are always in the bind model
    assert any("libibverbs" in x for x in b1)
    assert any("libmlx5" in x for x in b1)

    print("\nPASS — bind set computed; ABI/impl mismatch correctly predicts TCP fallback.")


if __name__ == "__main__":
    main()
