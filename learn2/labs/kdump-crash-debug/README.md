# kdump / crash — panic capture and analysis

Companion lab for Ch11 (debugging production kernel panics & oopses).

## Files

- **`configure-kdump.sh`** — read-only readiness check by default: confirms
  a `crashkernel=` reservation is present on the kernel command line, checks
  whether the `kdump` service is enabled/active, and lists any vmcores
  already captured under `/var/crash`. Pass `--enable` (as root) to also
  enable the kdump service. This operationalizes Ch11's central lesson:
  kdump must be enabled **before** a panic, not after — this script makes
  that a checkable, scriptable fact instead of tribal knowledge.
- **`crash-session-example.txt`** — an annotated, documented transcript of a
  real `crash` utility investigation: locating the vmcore, reading the
  captured dmesg, opening the vmcore with matching debug symbols, and the
  standard first commands (`sys`, `log`, `bt`, `bt -a`, `ps`, `mod`, `dis`).
  This is documentation, not a script — `crash` requires an actual vmcore
  and exactly-matching kernel debug symbols to run, which no sandbox has by
  construction (see Ch11's anti-pattern table on symbol mismatches).

## Usage

```
./configure-kdump.sh              # report readiness (safe, read-only)
sudo ./configure-kdump.sh --enable
```

## Notes on validation

`configure-kdump.sh` was run in this sandbox and functions correctly
(reports the real `crashkernel=` reservation present in `/proc/cmdline`,
correctly reports the `kdump` service as not present/inactive here, and
correctly reports no captured vmcores). It passes `bash -n` and is
hand-reviewed for `shellcheck`-style cleanliness. `crash-session-example.txt`
is plain documentation and is not executed by CI.
