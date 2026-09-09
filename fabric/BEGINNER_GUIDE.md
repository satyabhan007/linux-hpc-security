# Networking & RDMA Fabric — The Amateur's Guide

> Kernel TCP is posting a letter: envelope, sorting office, postman,
> recipient opens it. RDMA is a pneumatic tube that drops the message
> straight onto the recipient's desk while they keep working. Same
> building, wildly different latency.

---

## 1. Why HPC needs a special network

A tightly-coupled MPI job does an `MPI_Allreduce` after every timestep.
If each one costs 30 µs instead of 1 µs, and you do millions of them,
the network *is* your runtime. Ordinary Ethernet + TCP can't do 1 µs.

**RDMA** (Remote Direct Memory Access) can, by removing the overhead:

| Normal (kernel TCP) path | RDMA path |
|---|---|
| `send()` syscall (mode switch) | post a work request to the NIC (no syscall) |
| copy user buffer → kernel | **zero copy** — NIC DMAs the registered buffer |
| TCP/IP stack processing | NIC handles transport in hardware |
| interrupt per packet on receive | poll a completion queue (or one interrupt) |
| copy kernel → user on receive | data already in the target's registered buffer |

Result: ~1 µs half-round-trip and near-line-rate bandwidth with the CPU
almost idle. (Lab: `step3_rdma_vs_tcp.py`.)

---

## 2. Two flavours: InfiniBand vs RoCE

- **InfiniBand (IB)** — a purpose-built fabric with its own physical
  layer, link layer, and addressing. Lossless by design (credit-based
  flow control). Speeds: EDR 100G, HDR 200G, NDR 400G, XDR 800G (per
  port). Needs a **Subnet Manager**.
- **RoCEv2** — "RDMA over Converged Ethernet": RDMA packets inside
  UDP/IP on standard Ethernet switches. Cheaper, reuses Ethernet skills,
  but needs a carefully configured **lossless** Ethernet (PFC +
  ECN/DCQCN) or performance collapses.
- **Omni-Path** (Intel/Cornelis), **Slingshot** (HPE/Cray) — other
  purpose-built fabrics with similar goals.

---

## 3. Fat-tree topology and bisection bandwidth

Big clusters wire nodes in a **fat-tree** (folded Clos): **leaf**
switches at the racks, **spine** switches above, with more bandwidth
going up so any node can reach any node at near full rate.

The key number is **bisection bandwidth**: cut the machine in half — how
much bandwidth crosses the cut? A **full (1:1, non-blocking)** fat-tree
lets every node use a full link across the cut. Most clusters are
**oversubscribed** (2:1 or 3:1 at the leaf) to save switch ports and
money, betting that not everyone crosses the cut at once.

```
36-port leaf switch, 16 leaves:
  1:1  →  18 down : 18 up     non-blocking, most expensive
  2:1  →  24 down : 12 up     cheaper, fine for many workloads
  3:1  →  27 down :  9 up     risky for global all-to-all / large Allreduce
```

**Analogy — a motorway.** Local roads (leaf) feed on-ramps to the
highway (spine). 1:1 means every car can be on the highway at once; 3:1
means rush hour is fine only if most trips stay local.

(Lab: `step2_fat_tree_bisection.py`.)

---

## 4. The Subnet Manager (InfiniBand)

IB has **no distributed routing protocol**. A **Subnet Manager** (SM:
`opensm` or a switch-embedded one) discovers the whole topology,
assigns **LIDs** (local IDs) to every port, and programs every switch's
forwarding tables. One SM is active, others standby.

It also handles **partitions** (pkeys — like VLANs), and, with capable
hardware, **adaptive routing** (spread flows across spine links to dodge
congestion) and **SHARP** (do the reduction for `MPI_Allreduce` *inside
the switch*, cutting collective latency).

> If the SM dies with no standby: existing routes keep working, but a
> rebooted node can't get a LID and can't join. **Always run a redundant
> SM** and monitor which is master (`sminfo`).

---

## 5. The other networks

A cluster has several IP networks besides the fabric: **provisioning**
(Module 7), **IPMI/BMC** (out-of-band management), **in-band
management**, **storage**, and sometimes **IPoIB**. Plan them as
non-overlapping subnets with a scheme that encodes rack and node:

```
10.<role>.<rack>.<node>
10.10.0.0/16  provisioning     10.20.0.0/16  IPMI
10.30.0.0/16  in-band mgmt     10.40.0.0/16  storage
```

CIDR you should know cold: `/24` = 254 hosts, `/22` = 1022, `/26` = 62.
(Lab: `step1_subnet_plan.py`.)

---

## 6. Reading the fabric

| Command | Shows |
|---|---|
| `ibstat` / `ibstatus` | link state, rate (HDR? dropped to EDR = bad cable), LID |
| `iblinkinfo` | the whole topology, port by port |
| `ibdiagnet` | topology, credit loops, bad SLs, errors, a full health report |
| `perfquery` / `ibqueryerrors` | `SymbolErrors`, `PortXmitDiscards` (congestion), `LinkDowned` |
| `ib_write_lat` / `ib_write_bw` | point-to-point RDMA latency / bandwidth (the perftest suite) |
| OSU / IMB | end-to-end MPI latency and bandwidth |

A HDR link that negotiated down to EDR is a bad cable or transceiver.
Rising `SymbolErrors` on one link, with adaptive routing steering some
flows over it, is the classic "job is 3× slower on some days" bug.
(Lab: `step3_rdma_vs_tcp.py`.)

---

## 7. Run the labs

```bash
python3 fabric/step1_subnet_plan.py          # carve non-overlapping cluster subnets
python3 fabric/step2_fat_tree_bisection.py    # bisection bandwidth vs oversubscription
python3 fabric/step3_rdma_vs_tcp.py           # RDMA vs kernel TCP: latency & bandwidth model
```

Next: **`storage/`** — feeding thousands of ranks from one filesystem.
