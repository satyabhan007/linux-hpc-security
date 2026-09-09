# Networking & RDMA Fabric — Interview Q&A

---

## RDMA fundamentals

**Q: What makes RDMA faster than kernel TCP for MPI?**
Kernel bypass + zero-copy: the NIC transfers data directly between
registered user buffers with no syscall, no memory copies, no per-packet
interrupt, and transport handled in hardware. ~1 µs half-RTT, CPU nearly
idle.

**Q: What is memory registration and why is it required?**
The application pins a buffer and tells the NIC its virtual→physical
mapping and access rights, producing a local key (lkey) and remote key
(rkey). The NIC can then DMA to/from it safely without the kernel in the
path. Registration is expensive, so buffers are reused / pre-registered.

**Q: RDMA verbs — Send/Recv vs Write/Read?**
Send/Recv (two-sided): both sides post work requests, like a mailbox.
Write/Read (one-sided): the initiator reads or writes remote memory
directly using the rkey; the remote CPU isn't involved. One-sided is the
lowest latency and underpins fast collectives.

**Q: What is a completion queue (CQ)?**
Where the NIC posts completion events for finished work requests. The
app **polls** it (busy-wait) for lowest latency, or arms an interrupt
for lower CPU use.

---

## InfiniBand vs RoCE

**Q: InfiniBand vs RoCEv2 — the core trade-off?**
IB: purpose-built, lossless by design (credit flow control), needs a
subnet manager, more expensive. RoCEv2: RDMA over standard Ethernet
(UDP/IP), cheaper and familiar, but requires carefully configured
lossless Ethernet (PFC + ECN/DCQCN) or it collapses under congestion.

**Q: Why does RoCE need PFC *and* ECN, not just PFC?**
PFC alone stops packet loss but its pause frames propagate backward,
causing head-of-line blocking and potential PFC deadlock/storms.
ECN + DCQCN makes senders reduce rate *before* PFC has to pause, keeping
the fabric flowing.

**Q: IB link speeds — name a few.**
EDR 100 Gb/s, HDR 200, NDR 400, XDR 800 (per port, 4x lanes). An HDR
port that shows EDR in `ibstat` has a bad cable/transceiver or a lane
down.

**Q: What is a LID?**
Local Identifier — a 16-bit address the subnet manager assigns to each
IB port; switches forward on LIDs. (GIDs are the 128-bit
InfiniBand/RoCE addresses used for routing between subnets.)

---

## Subnet manager

**Q: What does the InfiniBand Subnet Manager do?**
Discovers the topology, assigns LIDs, computes routes and programs every
switch's forwarding table, manages partitions (pkeys). IB has no
distributed routing protocol, so the SM is mandatory.

**Q: Why run a redundant SM?**
If the only SM dies, established traffic continues but nothing new comes
up — a rebooted node can't get a LID. Standbys take over by priority.
Alert on zero or multiple masters.

**Q: What is SHARP?**
Scalable Hierarchical Aggregation and Reduction Protocol — NVIDIA
switches perform `MPI_Allreduce`/`MPI_Reduce` aggregation *in the
network*, so the reduction doesn't traverse every host link. Big win for
collective-heavy jobs.

**Q: Adaptive routing — what and why?**
The fabric dynamically spreads flows across multiple equal-cost spine
links based on congestion, instead of static hashing. Improves all-to
-all throughput and routes around a congested/marginal link.

---

## Topology

**Q: What is a fat-tree / folded Clos?**
A multi-tier topology (leaf/spine, sometimes core) with increasing
aggregate bandwidth toward the root so any node can reach any node at
(near) full rate. "Fat" = upper links are fatter/more numerous.

**Q: Define bisection bandwidth.**
Split the network into two equal halves by the worst-case cut; the total
bandwidth crossing that cut is the bisection bandwidth. It bounds
all-to-all performance.

**Q: 1:1 vs 2:1 vs 3:1 oversubscription — what does the ratio mean?**
Leaf **downlinks : uplinks**. 1:1 (non-blocking): every node can use a
full link across the fabric. 3:1: three node-links share one uplink —
fine if traffic is local, a bottleneck for global collectives.

**Q: How do you size a 36-port leaf for 2:1?**
24 ports down to nodes, 12 ports up to spines (24:12 = 2:1). For 1:1 it
would be 18:18.

**Q: When is oversubscription acceptable?**
When the scheduler enforces topology-aware placement so jobs stay within
a rack/leaf group, and the workload isn't dominated by whole-machine
all-to-all. It's a bet on locality.

---

## Diagnostics & IP

**Q: `ibstat` shows `State: Active`, `Rate: 100` on an HDR fabric.
Problem?**
Yes — HDR is 200 Gb/s. The link renegotiated to EDR: bad cable,
dirty/failing transceiver, or a lane down. Reseat/replace and recheck.

**Q: Which counters indicate fabric congestion vs a bad link?**
Congestion: `PortXmitWait`, `PortXmitDiscards` rising under load.
Bad link/physical: `SymbolErrors`, `LinkErrorRecovery`, `LinkDowned`,
`PortRcvErrors` accumulating over time.

**Q: Tools to validate a fabric at acceptance?**
`ibdiagnet` (topology + errors + BER), `iblinkinfo` (every link's
speed/width), `ibqueryerrors` (baseline counters), then OSU/IMB
latency+bandwidth matrices across rack pairs, and `ib_write_bw` per
node.

**Q: How many usable hosts in a /22? A /26?**
/22 = 1022 (2¹⁰ − 2). /26 = 62 (2⁶ − 2). /24 = 254.

**Q: Why give storage its own network or QoS class?**
A parallel-I/O burst (checkpoint, IOR) can saturate shared links and
inject latency into MPI collectives. Separating them (physical fabric or
traffic classes) isolates the two.

**Q: What's `MEMLOCK`/`ulimit -l` got to do with RDMA?**
RDMA pins (locks) memory for registration. If `RLIMIT_MEMLOCK` is too
low, registration fails and MPI silently falls back to TCP. Set it
`unlimited` in `limits.d` and the relevant systemd units.
