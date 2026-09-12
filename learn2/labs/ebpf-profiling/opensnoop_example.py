#!/usr/bin/env python3
"""opensnoop_example.py — a minimal BCC (BPF Compiler Collection) program
that traces file opens system-wide, optionally filtered to one command name.

Companion to Ch5 (perf/eBPF profiling) and Ch9 (syscall tracing & auditing):
this is the shape of a targeted eBPF trace when you already know the
question ("which files is this process opening, and did it succeed") and
don't need a full stack-sampling perf record pass.

Requires the `bcc` package (python3-bcc / bpfcc-tools) and a running Linux
kernel with BPF support — install per your distro's BCC packaging docs
(https://github.com/iovisor/bcc/blob/master/INSTALL.md). Not runnable in a
plain sandbox without BCC + kernel headers installed; read this as a
documented reference implementation, not something to execute here.

Usage:
    sudo python3 opensnoop_example.py            # trace every process
    sudo python3 opensnoop_example.py -n nginx   # trace only "nginx"
"""

import argparse
import ctypes as ct

from bcc import BPF

BPF_PROGRAM = r"""
#include <uapi/linux/limits.h>

struct data_t {
    u32 pid;
    u64 ts_ns;
    int ret;
    char comm[TASK_COMM_LEN];
    char fname[NAME_MAX];
};

BPF_PERF_OUTPUT(events);
BPF_HASH(start_ns, u32, u64);
BPF_HASH(fname_by_pid, u32, char[NAME_MAX]);

int trace_open_entry(struct pt_regs *ctx, const char __user *filename) {
    u32 pid = bpf_get_current_pid_tgid();
    u64 ts = bpf_ktime_get_ns();
    start_ns.update(&pid, &ts);

    char fname[NAME_MAX] = {};
    bpf_probe_read_user_str(&fname, sizeof(fname), filename);
    fname_by_pid.update(&pid, &fname);
    return 0;
}

int trace_open_return(struct pt_regs *ctx) {
    u32 pid = bpf_get_current_pid_tgid();
    u64 *tsp = start_ns.lookup(&pid);
    if (tsp == 0) {
        return 0;
    }

    struct data_t data = {};
    data.pid = pid;
    data.ts_ns = bpf_ktime_get_ns() - *tsp;
    data.ret = PT_REGS_RC(ctx);
    bpf_get_current_comm(&data.comm, sizeof(data.comm));

    char *fname = fname_by_pid.lookup(&pid);
    if (fname != 0) {
        __builtin_memcpy(&data.fname, fname, sizeof(data.fname));
    }

    events.perf_submit(ctx, &data, sizeof(data));
    start_ns.delete(&pid);
    fname_by_pid.delete(&pid);
    return 0;
}
"""


class OpenEvent(ct.Structure):
    _fields_ = [
        ("pid", ct.c_uint32),
        ("ts_ns", ct.c_uint64),
        ("ret", ct.c_int),
        ("comm", ct.c_char * 16),
        ("fname", ct.c_char * 255),
    ]


def print_event(name_filter, cpu, data, size):
    event = ct.cast(data, ct.POINTER(OpenEvent)).contents
    comm = event.comm.decode("utf-8", "replace")
    if name_filter and name_filter not in comm:
        return
    fname = event.fname.decode("utf-8", "replace")
    status = "OK" if event.ret >= 0 else f"ERR({event.ret})"
    print(f"{event.pid:>7} {comm:<16} {event.ts_ns / 1000:>10.1f}us  {status:<10} {fname}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-n", "--name", help="only show opens from processes matching this comm substring")
    args = parser.parse_args()

    bpf = BPF(text=BPF_PROGRAM)
    bpf.attach_kprobe(event=bpf.get_syscall_fnname("openat"), fn_name="trace_open_entry")
    bpf.attach_kretprobe(event=bpf.get_syscall_fnname("openat"), fn_name="trace_open_return")

    print(f"{'PID':>7} {'COMM':<16} {'LATENCY':>12}  {'STATUS':<10} FILE")
    bpf["events"].open_perf_buffer(lambda cpu, data, size: print_event(args.name, cpu, data, size))

    try:
        while True:
            bpf.perf_buffer_poll()
    except KeyboardInterrupt:
        print("\ndetaching, exiting.")


if __name__ == "__main__":
    main()
