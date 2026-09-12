# kpatch live-patching — a runnable workflow

Companion lab for Ch12 (live kernel patching).

## Files

- **`example-fix.patch`** — an illustrative unified diff fixing a
  (fictional) CVE via a bounds check added to an ioctl handler. Deliberately
  the class of fix Ch12 says **is** livepatch-eligible: a pure function-level
  logic change, no in-memory data structure layout change.
- **`build-and-load.sh`** — wraps `kpatch-build` (build a kpatch kernel
  module from the patch, against the currently running kernel) and
  `kpatch load` (load it, no reboot), printing `kpatch list` at the end.
- **`verify-patch.sh`** — the follow-up step Ch12 insists on: confirms the
  named patch appears in `kpatch list` AND that
  `/sys/kernel/livepatch/<name>/enabled` reads `1` — directly implementing
  Ch12's anti-pattern fix ("loaded" is not proof the fix is "active").

## Usage

```
sudo ./build-and-load.sh example-fix.patch
./verify-patch.sh kpatch-example-fix
```

## Notes on validation

`kpatch-build`/`kpatch` require a full kernel build toolchain, matching
kernel-devel/headers for the running kernel, and the `kpatch` package — none
of which are assumed present in a CI sandbox, matching Ch12's real-world
deployment model (most fleets consume vendor-prebuilt livepatches rather
than building their own). Both scripts were run in this sandbox: they
correctly detect the missing `kpatch-build`/`kpatch` binaries and exit with
a clear, actionable error rather than failing silently or crashing. Both
pass `bash -n` and are hand-reviewed for `shellcheck`-style cleanliness
(`set -euo pipefail`, quoted expansions, explicit failure messages).
`example-fix.patch` is a documentation/reference diff, not applied by CI.
