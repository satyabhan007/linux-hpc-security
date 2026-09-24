#!/usr/bin/env python3
from bcc import BPF
import time
import sys

# 1. The Bulletproof XDP C Program
# We manually define the headers to guarantee 100% portability and bypass the Clang fs.h bug!
bpf_text = """
#include <uapi/linux/bpf.h>

#define ETH_P_IP 0x0800
#define IPPROTO_ICMP 1

// Manually define the Ethernet Header (14 bytes)
struct ethhdr {
    unsigned char h_dest[6];
    unsigned char h_source[6];
    unsigned short h_proto;
};

// Manually define the IPv4 Header (20 bytes)
struct iphdr {
    unsigned char ihl:4;
    unsigned char version:4;
    unsigned char tos;
    unsigned short tot_len;
    unsigned short id;
    unsigned short frag_off;
    unsigned char ttl;
    unsigned char protocol;
    unsigned short check;
    unsigned int saddr;
    unsigned int daddr;
};

// A hash map to keep a running tally of exactly how many packets we drop
BPF_HASH(drop_cnt, u32, u32);

int xdp_drop_icmp(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    struct ethhdr *eth = data;
    
    // VERIFIER: Proving we aren't reading out of bounds
    if ((void *)(eth + 1) > data_end) {
        return XDP_PASS;
    }

    // Only inspect IPv4
    if (eth->h_proto != bpf_htons(ETH_P_IP)) {
        return XDP_PASS;
    }

    struct iphdr *ip = (void *)(eth + 1);
    
    // VERIFIER: Proving the IP header fits in memory
    if ((void *)(ip + 1) > data_end) {
        return XDP_PASS;
    }

    // Is this an ICMP (Ping) packet?
    if (ip->protocol == IPPROTO_ICMP) {
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

    return XDP_PASS;
}
"""

print("Compiling bulletproof XDP program...")
b = BPF(text=bpf_text)

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
            drop_cnt.clear()
except KeyboardInterrupt:
    print("\nRemoving XDP firewall...")
    b.remove_xdp(interface, 0)
    print("Detached. Normal traffic restored.")
