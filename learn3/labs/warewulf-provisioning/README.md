# Warewulf node-set / overlay template example

Companion to Chapter 2 (`learn3/`). A realistic Warewulf 4 node definition
set (the YAML `wwctl` itself generates/consumes via `nodes.conf`) for a
"bignode" GPU-heavy node class, plus a runtime overlay template showing
Warewulf's Go-template substitution for per-node values.

## Files

- `nodes.conf.example.yaml` — a `nodeprofiles`/`nodes` definition in the
  shape Warewulf 4's `nodes.conf` uses, defining a `bignode` profile (8x
  GPU, RDMA-tuned memlock limits) and three concrete nodes assigned to it.
  This is what `wwctl node add`/`wwctl profile set` produce and consume —
  shown here directly for readability rather than as a sequence of CLI
  commands.
- `limits.conf.ww` — a runtime-overlay template (Warewulf's Go-template
  syntax) that renders a per-node `/etc/security/limits.conf` fragment
  from each node's `Tags`, giving RDMA-heavy "bignode" instances the
  higher `memlock` ulimit they need (Chapter 4's RDMA registration memory
  requirement) without hardcoding it per node.

## Try it

```bash
# once nodes.conf.example.yaml's content is merged into a real Warewulf
# /etc/warewulf/nodes.conf (or imported via `wwctl node add` per node):
wwctl overlay import limits.conf.ww bignode /etc/security/limits.conf.ww
wwctl overlay build bignode01
wwctl overlay show runtime bignode01 limits.conf | head
```

Read alongside [Chapter 2](../../#ch2) — the `Tags` block in
`nodes.conf.example.yaml` is exactly the data `{{ .Tags.memlock_kb }}` in
`limits.conf.ww` resolves at render time.
