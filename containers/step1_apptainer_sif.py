#!/usr/bin/env python3
"""
Containers · Step 1 — what is inside a SIF file, vs a Docker image.

Apptainer's SIF is ONE file: a global header + a descriptor table
pointing at data objects — the build definition, the squashfs root
filesystem, and (optionally) a detached cryptographic signature. It is
immutable, content-addressable, and sits happily on Lustre.

A Docker image is a directory of tar layers + a JSON manifest + a config
blob, assembled by a daemon into an overlayfs mount.

This models both and shows why SIF fits HPC.
"""

SIF_MAGIC = b"SIF_MAGIC"


def build_sif(defn: bytes, rootfs: bytes, signature: bytes | None):
    objects = [("Deffile", defn), ("FS.squashfs", rootfs)]
    if signature is not None:
        objects.append(("Signature", signature))
    # descriptor table: (id, type, offset, size)
    header = {"magic": SIF_MAGIC, "version": "1.1", "arch": "amd64",
              "n_desc": len(objects)}
    descriptors, blob, off = [], bytearray(), 0
    for i, (typ, data) in enumerate(objects, 1):
        descriptors.append({"id": i, "type": typ, "offset": off, "size": len(data)})
        blob += data
        off += len(data)
    return {"header": header, "descriptors": descriptors, "data": bytes(blob)}


def read_object(sif, typ):
    for d in sif["descriptors"]:
        if d["type"] == typ:
            return sif["data"][d["offset"]:d["offset"] + d["size"]]
    return None


def docker_image(layers: list[bytes]):
    manifest = {"schemaVersion": 2,
                "layers": [{"digest": f"sha256:{hash(l) & 0xffffffff:08x}",
                            "size": len(l)} for l in layers],
                "config": {"digest": "sha256:cfg"}}
    return {"manifest": manifest, "blobs": {d["digest"]: l
                                            for d, l in zip(manifest["layers"], layers)}}


def main():
    defn = b"Bootstrap: docker\nFrom: rockylinux:9\n%post\n  dnf -y install openmpi\n"
    rootfs = b"<squashfs: 812 MiB of read-only rootfs>"
    sig = b"<PGP detached signature over the FS object>"

    signed = build_sif(defn, rootfs, sig)
    unsigned = build_sif(defn, rootfs, None)

    print("SIF (signed):")
    print(f"  header: {signed['header']}")
    for d in signed["descriptors"]:
        print(f"  desc {d['id']}: {d['type']:<12} off={d['offset']:<4} size={d['size']}")

    # a SIF is one contiguous file: header + descriptors + one data blob
    assert signed["header"]["magic"] == SIF_MAGIC
    assert read_object(signed, "Deffile") == defn
    assert read_object(signed, "FS.squashfs") == rootfs
    assert read_object(signed, "Signature") == sig
    assert read_object(unsigned, "Signature") is None
    # immutability: the rootfs object is squashfs (read-only by construction)
    assert b"read-only" in read_object(signed, "FS.squashfs")

    print("\nDocker image (same rootfs as 3 layers):")
    di = docker_image([b"layer: base os", b"layer: dnf install openmpi",
                       b"layer: app + entrypoint"])
    for l in di["manifest"]["layers"]:
        print(f"  {l['digest']}  {l['size']} B")
    assert len(di["manifest"]["layers"]) == 3
    assert "config" in di["manifest"]

    # the HPC-relevant contrast, asserted:
    #  - SIF: 1 file to scp / archive / checksum;  Docker: N blobs + manifest
    sif_files = 1
    docker_files = len(di["blobs"]) + 1
    assert sif_files == 1 and docker_files == 4
    #  - SIF carries its own provenance (Deffile) and can carry a signature
    assert read_object(signed, "Deffile") is not None

    print("\n  1 file, immutable rootfs, embedded build recipe, optional signature,")
    print("  runs rootless with no daemon — that is why clusters standardise on SIF.")
    print("\nPASS — SIF layout parsed; Docker multi-blob layout contrasted.")


if __name__ == "__main__":
    main()
