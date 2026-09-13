# Custom SELinux policy module + audit2allow workflow

Companion lab to Chapter 3 (SELinux & AppArmor policy authoring). Shows the
real, defensive workflow for confining an application with a custom SELinux
policy module: write a minimal type-enforcement source file, compile it,
package it, load it — and separately, the `audit2allow` workflow for turning
real AVC denials into a **reviewed, narrowed** policy addition (never loaded
unread).

## Files

- `webapp.te` — a minimal type-enforcement policy source confining an
  illustrative `webapp_t` domain: it may bind to its own port, read its own
  content, and write only to its own log directory. Everything else is
  denied by default (SELinux confinement is default-deny).
- `build-and-load.sh` — compiles `webapp.te` into a loadable policy module
  using the real toolchain (`checkmodule` + `semodule_package`) and loads it
  with `semodule`. Defaults to a **dry run** that only builds and prints
  what would be loaded; `--load` actually calls `semodule -i`.
- `audit2allow-workflow.sh` — takes a sample AVC denial log
  (`sample-avc.log`, included) and shows the real `audit2allow` command that
  would draft a policy module from it, then prints the draft **for review**
  — it never loads a generated module automatically, because generated
  rules must always be read and narrowed by a human first (Chapter 3, L4).
- `sample-avc.log` — a realistic, synthetic AVC denial (not from a real
  incident) used as `audit2allow-workflow.sh`'s input.

## Real workflow this lab mirrors

```bash
# Compile and load a custom policy module:
checkmodule -M -m -o webapp.mod webapp.te
semodule_package -o webapp.pp -m webapp.mod
sudo semodule -i webapp.pp

# Turn real AVC denials into a reviewable draft (never load unread):
ausearch -m avc -ts recent | audit2allow -m webapp_extra > webapp_extra.te
#  ... read every line of webapp_extra.te, narrow overly broad rules ...
checkmodule -M -m -o webapp_extra.mod webapp_extra.te
semodule_package -o webapp_extra.pp -m webapp_extra.mod
sudo semodule -i webapp_extra.pp
```

## Safety

- `build-and-load.sh` defaults to dry-run (build only); `--load` is required
  to actually call `semodule -i`, and the script exits cleanly if the
  SELinux userspace tools (`checkmodule`, `semodule_package`, `semodule`)
  are not installed, rather than failing noisily — this lab is meant to be
  readable and safe to run on a non-SELinux workstation too.
- `audit2allow-workflow.sh` never auto-loads a generated module — it always
  stops after printing the draft for human review, matching the anti-pattern
  fix in Chapter 3 ("read every generated rule before loading it").
