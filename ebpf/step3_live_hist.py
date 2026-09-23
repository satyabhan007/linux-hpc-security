#!/usr/bin/env python3
from bcc import BPF
from time import sleep

# The REAL eBPF C code
bpf_text = """
#include <uapi/linux/ptrace.h>

// 1. Hash map to store the start time of the read syscall (Key: TID, Value: timestamp)
BPF_HASH(start, u32, u64);

// 2. Histogram map to store the latency distribution
BPF_HISTOGRAM(dist);

// Triggered when a read() syscall begins
TRACEPOINT_PROBE(syscalls, sys_enter_read) {
    u64 ts = bpf_ktime_get_ns();
    u32 tid = bpf_get_current_pid_tgid();
    start.update(&tid, &ts); // Store the start time
    return 0;
}

// Triggered when a read() syscall finishes
TRACEPOINT_PROBE(syscalls, sys_exit_read) {
    u32 tid = bpf_get_current_pid_tgid();
    u64 *tsp = start.lookup(&tid); // Find the start time
    
    if (tsp != 0) {
        // Calculate latency in nanoseconds, convert to microseconds
        u64 delta = bpf_ktime_get_ns() - *tsp;
        u64 delta_us = delta / 1000;
        
        // Log base 2 bucket incrementing (the core of the histogram!)
        dist.increment(bpf_log2l(delta_us));
        
        start.delete(&tid); // Cleanup memory
    }
    return 0;
}
"""

print("Compiling eBPF C code into the kernel...")
b = BPF(text=bpf_text)

print("🚀 TRACING LIVE FILE I/O LATENCY (System-wide `read` syscalls)...")
print("Do some things on your laptop! Open a browser, read a file, etc.")
print("Tracing for exactly 10 seconds... Please wait.\n")

try:
    sleep(10)
finally:
    print("\n\n--- Live `read` Syscall Latency Histogram (microseconds) ---")
    b["dist"].print_log2_hist("usecs")
