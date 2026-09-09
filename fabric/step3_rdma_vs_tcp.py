#!/usr/bin/env python3
"""
Fabric · Step 3 — RDMA vs the kernel TCP path, as a latency/bandwidth model.

Sending a message the normal way pays: 2 syscalls (mode switches), a
user->kernel copy on send and a kernel->user copy on recv, an interrupt
per packet on the receiver, and TCP/IP stack processing. RDMA
(kernel-bypass, zero-copy) skips all of it: the NIC DMAs straight
between registered user buffers.

Model per-message cost as fixed_overhead + size * per_byte, then sweep
message sizes and report half-round-trip latency and effective bandwidth.
"""

LINE_GBPS = 25.0
PER_BYTE = 1.0 / (LINE_GBPS * 1e9)      # s per byte at line rate

# fixed per-message overheads (seconds)
TCP = {
    "syscall_send": 0.30e-6, "syscall_recv": 0.30e-6,
    "copy_send_pb": 0.06e-9, "copy_recv_pb": 0.06e-9,   # per byte, memcpy ~16 GB/s
    "irq_per_pkt": 1.2e-6, "mtu": 1500, "stack": 0.8e-6,
}
RDMA = {
    "post_send": 0.10e-6, "poll_cqe": 0.10e-6,   # doorbell + completion poll
    "hca_lat": 0.6e-6,                             # wire + HCA pipeline
}


def tcp_latency(size):
    pkts = max(1, -(-size // TCP["mtu"]))          # ceil
    return (TCP["syscall_send"] + TCP["syscall_recv"] + TCP["stack"]
            + pkts * TCP["irq_per_pkt"]
            + size * (TCP["copy_send_pb"] + TCP["copy_recv_pb"])
            + size * PER_BYTE)


def rdma_latency(size):
    return (RDMA["post_send"] + RDMA["poll_cqe"] + RDMA["hca_lat"]
            + size * PER_BYTE)


def eff_bw(latency, size):
    return size / latency / 1e9      # GB/s


def main():
    print(f"{'size':>10}  {'TCP lat':>10}  {'RDMA lat':>10}  "
          f"{'TCP BW':>9}  {'RDMA BW':>9}  {'RDMA %line':>10}")
    small_speedup = big_rdma_pct = None
    for size in (8, 64, 1024, 65536, 1 << 20, 1 << 24):
        tl, rl = tcp_latency(size), rdma_latency(size)
        tb, rb = eff_bw(tl, size), eff_bw(rl, size)
        print(f"{size:>10}  {tl*1e6:>8.2f}us  {rl*1e6:>8.2f}us  "
              f"{tb:>7.2f}G  {rb:>7.2f}G  {100*rb/LINE_GBPS:>8.0f}%")
        if size == 8:
            small_speedup = tl / rl
        if size == (1 << 24):
            big_rdma_pct = 100 * rb / LINE_GBPS

    print(f"\n  8-byte message: RDMA is {small_speedup:.1f}x lower latency "
          f"(~{rdma_latency(8)*1e6:.1f} us vs ~{tcp_latency(8)*1e6:.1f} us)")
    print(f"  16 MiB message: RDMA reaches {big_rdma_pct:.0f}% of line rate")

    # tiny-message latency: RDMA should be several times faster
    assert small_speedup > 2.5
    assert rdma_latency(8) < 1.5e-6, "RDMA small-message half-RTT ~ 1 us"
    # large transfers: RDMA gets very close to line rate, TCP loses ground to
    # per-packet interrupts + copies
    assert big_rdma_pct > 90
    assert eff_bw(tcp_latency(1 << 24), 1 << 24) < eff_bw(rdma_latency(1 << 24), 1 << 24)

    # the crossover where the copy/irq overhead really bites is well below 64 KiB
    assert tcp_latency(65536) / rdma_latency(65536) > 2

    print("\nPASS — RDMA wins big at small sizes (latency) and reaches ~line rate at large sizes.")


if __name__ == "__main__":
    main()
