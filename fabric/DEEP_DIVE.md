# Networking & RDMA Fabric — Deep Dive: Production Scenarios

---

## Scenario 1 — "The job is slow on some days, fine on others"

**Symptom.** A 512-rank job's wall time swings 1.5–3× with no code
change. Slow runs correlate with nothing obvious.

**Diagnose.**
```bash
# fabric-wide error sweep (run from a node with IB tools)
ibqueryerrors -s SymbolErrorCounter,LinkErrorRecoveryCounter,PortXmitDiscards,PortRcvErrors
ibdiagnet -r --get_phy_info                 # per-link BER, cable info
# check for a link that renegotiated below spec
iblinkinfo | grep -vE 'HDR|NDR'            # any EDR/FDR links in an HDR fabric?
# on the run: which spine links did it use?
```

**Root cause.** One marginal cable/transceiver on a spine link with a
rising bit-error rate. **Adaptive routing** spreads flows across all
spine links, so runs that happen to route heavy collective traffic over
the bad link are slow; runs that don't are fine. `SymbolErrors` on that
port climbs over days.

**Fix.** Identify the port (`ibdiagnet` names it), replace the
cable/transceiver, `ibclearcounters`, re-baseline with OSU. Consider
`opensm` routing weights to avoid a known-bad link until the part
arrives.

---

## Scenario 2 — MPI fell back to TCP (10× slow)

**Symptom.** `osu_latency` between two nodes reads ~25 µs instead of
~1 µs. Bandwidth is ~2 GB/s not ~24.

**Check.**
```bash
ibstat                                   # State: Active? Rate: as expected?
ibv_devinfo                              # HCA present, port active
# which transport did MPI pick?
export UCX_LOG_LEVEL=info                # or OMPI_MCA_pml_ucx_verbose
mpirun -np 2 ... ./osu_latency 2>&1 | grep -i 'transport\|rc\|dc\|tcp'
ucx_info -d | grep -E 'Transport|Device'
```

**Causes.**
- HCA link down / cable out — `ibstat` `State: Down`.
- Wrong UCX/OMPI config: `UCX_TLS` excludes `rc`/`dc`, or `btl` set to
  `tcp,self`.
- `rdma-core` / OFED not installed in the (container?) image (Module
  11).
- `MEMLOCK` ulimit too low → RDMA can't pin memory → falls back.
  (`ulimit -l unlimited` in `limits.d` + the systemd unit.)
- The subnet manager isn't running, so the port never went `Active`.

---

## Scenario 3 — RoCE: PFC misconfigured, everything stalls

**Symptom.** A RoCEv2 cluster: bandwidth is fine at low load, but under
all-to-all the whole fabric collapses — huge latency, timeouts.

**Why.** RoCEv2 needs a **lossless** Ethernet. Without **PFC**
(Priority Flow Control) on the RoCE traffic class, congestion drops
packets; RDMA's go-back-N recovery on loss is catastrophic. With PFC but
**no ECN/DCQCN**, PFC pause frames propagate backward and cause
**head-of-line blocking** and **PFC storms** / deadlock.

**Fix (must be end-to-end, host + every switch):**
- DSCP-mark RoCE traffic to a dedicated priority (e.g. 3), CNP to
  another.
- Enable **PFC** only on the RoCE priority (not "all").
- Enable **ECN** marking + **DCQCN** (host congestion control) so
  senders slow down *before* PFC pauses.
- Buffer/headroom tuning per switch model.
- Verify with `ethtool -S` (pause frames), `mlnx_qos`, and a sustained
  incast test.

This is why IB is often chosen despite the cost: lossless is built in.

---

## Scenario 4 — Subnet Manager failover didn't happen

**Symptom.** After a controller reboot, new nodes can't join the fabric;
`ibstat` on a rebooted node shows `Initializing`, never `Active`.

**Check.**
```bash
sminfo                       # who is the master SM? priority?
systemctl status opensm      # on all SM candidates
ibdiagnet | grep -i 'SM '    # SM state across the fabric
```

**Cause.** The standby `opensm` had a lower priority but also crashed,
or `opensm` was only running on the one rebooted host, or two SMs with
equal priority are fighting.

**Fix.** Run `opensm` on ≥ 2 stable hosts (not compute nodes that
reboot) with distinct `priority` values, `--daemon`, and monitoring that
alerts if there's **no** master or **more than one**. Switch-embedded SM
is an option on smaller fabrics.

---

## Scenario 5 — Designing the fabric for a new 400-node cluster

**Questions to answer.**
- **Workload mix.** Mostly single-node / embarrassingly parallel →
  2:1 or 3:1 is fine. Heavy global collectives / all-to-all (CFD,
  spectral, large training) → go 1:1, at least within a rack group.
- **Rack grouping.** Keep a job's nodes under one leaf when possible
  (Slurm `topology/tree`, Module 8); size leaf groups to your typical
  job size.
- **Storage traffic.** Separate the storage fabric (or QoS classes) so
  IOR bursts don't starve MPI.
- **SM placement.** 2–3 dedicated management hosts.
- **Cabling plan + labelling.** `ibdiagnet` topology file checked into
  git; every cable labelled `leafNN-portPP ↔ spineMM-portQQ`.
- **Acceptance.** Full-fabric `ibdiagnet` clean, OSU latency/bandwidth
  matrix within spec on every pair-of-racks, `ib_write_bw` per node
  ≥ threshold.

**Rule of thumb:** oversubscription is a bet on locality. If your
scheduler enforces topology-aware placement and jobs fit in a rack
group, 2:1 saves real money with little risk. If jobs routinely span the
whole machine with all-to-all, pay for 1:1.
