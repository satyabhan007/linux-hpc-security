# Node Health Check (NHC) rule set — GPU Xid errors

Companion to Chapter 9 (`learn3/`). A drop-in `nhc.conf` rule set that
catches NVIDIA Xid errors in the kernel ring buffer and automatically
drains (or, for the most severe codes, downs) the node — the automated
remediation Chapter 9 describes, rather than waiting for a pattern of
mysterious job failures to be noticed manually.

## Files

- `nhc.conf` — NHC rules using the built-in `check_dmesg` and
  `check_hw_gpu` checks. Distinguishes "drain and let running jobs
  finish" Xid codes (recoverable/soft) from "down immediately" codes
  (actively corrupting, e.g. Xid 79 — GPU fallen off the bus).

## Try it

```bash
# on a real compute node with NHC installed:
sudo cp nhc.conf /etc/nhc/nhc.conf
sudo nhc -c /etc/nhc/nhc.conf -d   # -d = debug/dry-run, prints what it would do

# wire it into Slurm (see Chapter 9's slurm.conf HealthCheckProgram lines):
#   HealthCheckProgram=/usr/sbin/nhc
#   HealthCheckInterval=300
#   HealthCheckNodeState=ANY
```

Read alongside [Chapter 9](../../#ch9) for why severity should decide
DRAIN vs. DOWN, and [Chapter 6](../../#ch6) for what Xid errors mean in
the context of MIG/GRES-scheduled GPUs.
