#!/usr/bin/env python3
from bcc import BPF
import time
import sys

# 1. The XDP C Program
bpf_text = """
#include <uapi/linux/bpf.h>
in.h>/in.h>
in.h>/if_ether.h>
in.h>/ip.h>

// A hash map to keep a running tally of exactly how many packets we drop
BPF_HASH(drop_cnt, u32, u32);

int xdp_drop_icmp(struct xdp_md *ctx) {
    // xdp_md provides direct memory pointers to the raw packet bytes on the NIC
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    // 1. Parse the Ethernet Header
    struct ethhdr *eth = data;
    
    // THE VERIFIER: eBPF refuses to compile unless we prove we aren't reading out of bounds!
    if ((void *)(eth + 1) > data_end) {
        return XDP_PASS;
    }

    // 2. We only care about IPv4 packets (0x0800)
    if (eth->h_proto != bpf_htons(ETH_P_IP)) {
        return XDP_PASS;
    }

    // 3. Parse the IP Header
    struct iphdr *ip = (void *)(eth + 1);
    
    // Bounds check the IP header
    if ((void *)(ip + 1) > data_end) {
        return XDP_PASS;
    }

    // 4. Is this packet ICMP (Ping)? 
    if (ip->protocol == IPPROTO_ICMP) {
        // It's a ping! Increment our drop counter.
        u32 key = 0;
        u32 *val = drop_cnt.lookup(&key);
        if (val) {
            *val += 1;
        } else {
            u32 initial = 1;
            drop_cnt.update(&key, &initial);
        }
        
        // 💥 ANNIHILATE THE PACKET AT THE HARDWARE DRIVER LEVEL
        return XDP_DROP;
    }

    // Allow all other traffic (TCP, UDP, web browsers, SSH, etc.)
    return XDP_PASS;
}
"""

# 2. Compile and attach to the container's network interface
print("Compiling XDP program...")
b = BPF(text=bpf_text)

# The default network interface inside a Docker container is usually 'eth0'
interface = "eth0"

print(f"Attaching XDP firewall to {interface}...")
try:
    fn = b.load_func("xdp_drop_icmp", BPF.XDP)
    b.attach_xdp(interface, fn, 0)
except Exception as e:
    print(f"Failed to attach XDP. Ensure you are running in the privileged container. Error: {e}")
    sys.exit(1)

print("\n🚀 XDP FIREWALL ACTIVE! 🚀")
print("All incoming Ping (ICMP) packets will be dropped at the lowest network layer.")
print("\nTo test this, open a SECOND terminal window, enter the container, and run:")
print("    ping 8.8.8.8")
print("\nWaiting for packets... (Press Ctrl+C to stop and detach)\n")

drop_cnt = b.get_table("drop_cnt")

try:
    while True:
        time.sleep(1)
        for k, v in drop_cnt.items():
            print(f"🔥 Incoming Packets Annihilated (XDP_DROP): {v.value}")
            # Clear the counter so we only show active drops
            drop_cnt.clear()
except KeyboardInterrupt:
    print("\nRemoving XDP firewall...")
    b.remove_xdp(interface, 0)
    print("Detached. Normal traffic restored.")
