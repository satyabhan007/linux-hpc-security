#!/usr/bin/env python3
"""Run every stepN_*.py lab in the repo and report a summary.

Zero dependencies. This is exactly what CI runs on every push:
each lab is a standalone pure-Python model of a real mechanism and
must exit 0 after printing a "PASS" line.
"""
import subprocess
import sys
import time
from pathlib import Path

MODULES = [
    "linux", "hardening", "stigs", "benchmarking", "ebpf", "ansible",
    "warewulf", "hpc", "fabric", "storage", "containers", "tuning",
    "linux-security", "encrypted-anomaly", "fraud-detection", "key-management",
    "soc", "noc", "splunk", "chaos", "redblue",
]

ROOT = Path(__file__).resolve().parent


def discover():
    labs = []
    for m in MODULES:
        labs += sorted((ROOT / m).glob("step*.py"))
    return labs


def main():
    labs = discover()
    if not labs:
        print("no labs found", file=sys.stderr)
        return 1

    width = max(len(str(p.relative_to(ROOT))) for p in labs)
    passed, failed = 0, []
    t0 = time.time()

    for lab in labs:
        rel = str(lab.relative_to(ROOT))
        r = subprocess.run(
            [sys.executable, str(lab)],
            capture_output=True, text=True, timeout=120,
        )
        ok = r.returncode == 0 and "PASS" in (r.stdout + r.stderr)
        mark = "\033[32mPASS\033[0m" if ok else "\033[31mFAIL\033[0m"
        print(f"  {rel:<{width}}  {mark}")
        if ok:
            passed += 1
        else:
            failed.append(rel)
            if r.stdout.strip():
                print("    ---- stdout ----")
                print("\n".join("    " + ln for ln in r.stdout.strip().splitlines()[-20:]))
            if r.stderr.strip():
                print("    ---- stderr ----")
                print("\n".join("    " + ln for ln in r.stderr.strip().splitlines()[-20:]))

    dt = time.time() - t0
    print()
    print(f"  {passed}/{len(labs)} labs passed in {dt:.1f}s")
    if failed:
        print("  failed: " + ", ".join(failed))
        return 1
    print("  ALL LABS PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
