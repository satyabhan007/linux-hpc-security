# Part 3 · labs — runnable configs

> Standard tools, at production depth. Every file here is validated in CI
> (`.github/workflows/lab-tests.yml`).

Five subdirectories, each pairing a real, production-shaped config with
its own README tying it back to the chapter it illustrates:

- [`slurm-policy/`](slurm-policy/) — a Slurm partition/QOS/fairshare config
  example (`slurm.conf` fragment + `sacctmgr` seed script). Chapters 1, 8, 11.
- [`warewulf-provisioning/`](warewulf-provisioning/) — a Warewulf
  node-set/overlay template for a GPU-heavy "bignode" class. Chapters 2, 4.
- [`mpi-placement/`](mpi-placement/) — an MPI placement benchmark script
  sweeping `--cpu-bind`/`--distribution` combinations. Chapter 3.
- [`node-health-nhc/`](node-health-nhc/) — a Node Health Check (NHC) rule
  set catching GPU Xid errors and draining/downing by severity. Chapters 6, 9.
- [`monitoring-exporter/`](monitoring-exporter/) — a Prometheus scrape
  config + alerting rules for Slurm job efficiency, GPU utilization, fabric
  health, and controller-dispatch-stall detection. Chapters 4, 13, 15.
