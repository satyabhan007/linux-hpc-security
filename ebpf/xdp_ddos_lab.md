# Lab: eBPF XDP - Defeating DDoS Attacks at 10 Million Packets/Sec

**Module:** Threat Detection & Network Defense  
**Difficulty:** Advanced (Level 3)  

## 📌 Overview
In this lab, we upgrade from eBPF *observability* (tracepoints) to eBPF *enforcement*. We use **XDP (eXpress Data Path)** to write a firewall that runs directly inside the Network Interface Card (NIC) driver. This allows us to annihilate malicious packets (like DDoS traffic) *before* the Linux kernel even allocates an `sk_buff` for them!

## 🛑 Critical Troubleshooting: The `sizeof(struct filename)` Error

When compiling XDP programs on modern kernels (like Ubuntu `7.0.x`), you may encounter this fatal Clang crash:

```text
error: static_assert failed due to requirement 'sizeof(struct filename) % 64 == 0'
```

**The Cause:** If you use `#include <linux/ip.h>` or `#include <linux/if_ether.h>`, the BCC compiler transitively pulls in deep internal kernel headers (like `fs.h`), causing alignment assertions to fail.

**The Fix:** For XDP packet parsing, **never use the internal `linux/` headers.** Always use the lightweight Userspace API (`uapi`) headers instead:

```c
// ❌ WRONG (Will crash on modern kernels)
#include <linux/in.h>
#include <linux/if_ether.h>
#include <linux/ip.h>

// ✅ RIGHT (Safe and lightweight)
#include <uapi/linux/in.h>
#include <uapi/linux/if_ether.h>
#include <uapi/linux/ip.h>
```

## 🚀 The XDP Ping of Death Firewall
Our `xdp_firewall.py` script intercepts all packets arriving at `eth0`. 
1. The **eBPF Verifier** mathematically forces us to write bounds-checks `if ((void *)(ip + 1) > data_end)` to prevent memory violations.
2. We identify `IPPROTO_ICMP` (Ping).
3. We execute `return XDP_DROP;` to vaporize the packet in hardware.
