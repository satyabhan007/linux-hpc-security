#!/usr/bin/env python3
"""
Containers · Step 2 — Spack concretization: abstract spec -> pinned DAG.

You ask for `hdf5 +mpi`. The concretizer must pick a version, resolve
every dependency, choose ONE mpi provider, pick a compiler, and honour
conflicts — producing a fully concrete build graph where every node is
pinned. This is a small constraint solver over a package repo.
"""

REPO = {
    "hdf5": {"versions": ["1.14.3", "1.12.2"], "variants": {"mpi": True},
             "depends": lambda s: (["mpi"] if s["variants"].get("mpi") else []) + ["zlib"],
             "conflicts": []},
    "zlib": {"versions": ["1.3.1", "1.2.13"], "variants": {},
             "depends": lambda s: [], "conflicts": []},
    "openmpi": {"versions": ["5.0.2", "4.1.6"], "variants": {"fabrics": "ucx"},
                "provides": ["mpi"], "depends": lambda s: ["hwloc", "ucx"], "conflicts": []},
    "mpich": {"versions": ["4.2.0"], "variants": {}, "provides": ["mpi"],
              "depends": lambda s: ["hwloc"], "conflicts": []},
    "hwloc": {"versions": ["2.10.0"], "variants": {},
              "depends": lambda s: [], "conflicts": []},
    # ucx 1.16 is known-bad with openmpi 5 in this toy repo -> forces a downgrade
    "ucx": {"versions": ["1.16.0", "1.15.0"], "variants": {},
            "depends": lambda s: [],
            "conflicts": [("openmpi", "5.0.2", "1.16.0")]},
}

PREFS = {"mpi_provider": "openmpi", "compiler": "gcc@13.2.0", "target": "x86_64_v3"}
VIRTUALS = {"mpi"}


def concretize(name, want_variants, chosen):
    if name in VIRTUALS:
        name = PREFS["mpi_provider"]
    if name in chosen:
        return chosen[name]

    pkg = REPO[name]
    spec = {
        "name": name,
        "version": pkg["versions"][0],                 # newest preferred
        "variants": {**pkg.get("variants", {}), **(want_variants or {})},
        "compiler": PREFS["compiler"],
        "target": PREFS["target"],
        "deps": [],
    }
    chosen[name] = spec

    for dep in pkg["depends"](spec):
        dep_name = PREFS["mpi_provider"] if dep in VIRTUALS else dep
        concretize(dep_name, None, chosen)
        spec["deps"].append(dep_name)

    # conflict resolution: (other_pkg, other_ver, my_bad_ver)
    for other, other_ver, bad_ver in pkg.get("conflicts", []):
        if chosen.get(other, {}).get("version") == other_ver and spec["version"] == bad_ver:
            alt = [v for v in pkg["versions"] if v != bad_ver]
            assert alt, f"no compatible {name}"
            spec["version"] = alt[0]
            spec["_repick"] = f"avoided {name}@{bad_ver} (conflicts with {other}@{other_ver})"

    return spec


def main():
    dag = {}
    concretize("hdf5", {"mpi": True}, dag)

    print("concrete DAG:")
    for name, s in dag.items():
        rep = f"   [{s['_repick']}]" if "_repick" in s else ""
        print(f"  {name}@{s['version']} %{s['compiler']} target={s['target']} "
              f"deps={s['deps']}{rep}")

    for s in dag.values():
        assert s["version"] and s["compiler"] and s["target"]

    providers = [n for n in dag if "mpi" in REPO[n].get("provides", [])]
    assert providers == ["openmpi"], providers
    assert "mpich" not in dag

    assert set(dag["hdf5"]["deps"]) == {"openmpi", "zlib"}
    assert set(dag["openmpi"]["deps"]) == {"hwloc", "ucx"}

    assert dag["ucx"]["version"] == "1.15.0"
    assert "_repick" in dag["ucx"]

    print("\n  abstract 'hdf5 +mpi' -> a graph where nothing is left to chance, and the")
    print("  known-bad ucx@1.16 + openmpi@5 pairing was resolved automatically.")
    print("\nPASS — concretization pins every node and respects the conflict.")


if __name__ == "__main__":
    main()
