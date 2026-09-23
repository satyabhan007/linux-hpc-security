# Lab: Real-Time Reverse Shell Detection & Systems Troubleshooting with eBPF

**Module:** Threat Detection & Systems Internals  
**Difficulty:** Advanced (Level 2)  
**Environment:** Privileged Docker Container (Ubuntu 22.04) on Modern Linux Hosts

## 📌 Overview

In this lab, you will write a custom **eBPF (Extended Berkeley Packet Filter)** program using **BCC (BPF Compiler Collection)** and Python. You will hook into the kernel's `execve` tracepoint to monitor process creation in real-time. 

More importantly, this lab mimics **real-world systems engineering**. You will encounter compiler mismatches, write C code to extract process trees from kernel memory, and analyze a real-world SOC (Security Operations Center) false positive.

---

## 🏗️ Architecture

```mermaid
sequenceDiagram
    participant Attacker (User Space)
    participant Kernel (VFS / Syscalls)
    participant eBPF Program (Kernel Space)
    participant Python Agent (User Space)

    Attacker (User Space)->>Kernel (VFS / Syscalls): Runs `nc -e /bin/bash` (execve syscall)
    Kernel (VFS / Syscalls)->>eBPF Program (Kernel Space): Tracepoint Triggered (sys_enter_execve)
    note right of eBPF Program (Kernel Space): eBPF extracts PID, PPID, Command, and Filename
    eBPF Program (Kernel Space)-->>Python Agent (User Space): Sends struct via BPF_PERF_OUTPUT buffer
    Python Agent (User Space)->>Python Agent (User Space): Evaluates heuristic ("is this netcat?")
    Python Agent (User Space)->>Attacker (User Space): Prints 🔴 ALERT to stdout / SIEM
```

---

## 🛠️ Phase 1: The Lab Environment

Because eBPF compiles C code dynamically against your host kernel, we must mount your host's kernel headers into the Docker container.

### 1. Create the `Dockerfile`

```dockerfile
FROM ubuntu:22.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    bpfcc-tools \
    python3-bpfcc \
    linux-headers-generic \
    netcat \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /lab
COPY detector.py .
CMD ["/bin/bash"]
```

### 2. Build and Run the Container
You **must** mount `/lib/modules` and `/usr/src` so the BCC compiler inside the container can see your laptop's kernel headers.

```bash
# Build the image
sudo docker build -t ebpf-lab .

# Run the privileged container (copy as a single block)
sudo docker run -it --rm --privileged \
  -v /sys/kernel/debug:/sys/kernel/debug:rw \
  -v /lib/modules:/lib/modules:ro \
  -v /usr/src:/usr/src:ro \
  ebpf-lab
```

---

## 💻 Phase 2: The eBPF Threat Detector (`detector.py`)

Inside the container, create `detector.py`. This script includes an **advanced tweak**: we reach directly into the kernel's `task_struct` to extract the **Parent PID (PPID)**. This allows us to see the process tree (e.g., did `nginx` spawn the shell, or did `bash`?).

```python
#!/usr/bin/env python3
from bcc import BPF

# 1. The eBPF C Program
bpf_text = """
#include <uapi/linux/ptrace.h>
#include <linux/sched.h>
// Note: <linux/fs.h> is intentionally omitted to prevent Clang static_assert errors on modern kernels

struct data_t {
    u32 pid;
    u32 ppid; // NEW: Parent Process ID
    char comm[TASK_COMM_LEN];
    char fname[256];
};

BPF_PERF_OUTPUT(events);

TRACEPOINT_PROBE(syscalls, sys_enter_execve) {
    struct data_t data = {};
    
    // Get current process task struct from the kernel
    struct task_struct *task = (struct task_struct *)bpf_get_current_task();
    
    // Extract PID and Parent PID (tgid)
    data.pid = bpf_get_current_pid_tgid() >> 32;
    data.ppid = task->real_parent->tgid; 
    
    bpf_get_current_comm(&data.comm, sizeof(data.comm));
    bpf_probe_read_user_str(&data.fname, sizeof(data.fname), args->filename);
    
    events.perf_submit(args, &data, sizeof(data));
    return 0;
}
"""

b = BPF(text=bpf_text)

print("🚀 ADVANCED eBPF Detector running... (Press Ctrl+C to stop)")
print(f"{'PID':<8} {'PPID':<8} {'CALLING COMM':<15} {'FILE EXECUTED'}")

def print_event(cpu, data, size):
    event = b["events"].event(data)
    fname = event.fname.decode('utf-8', 'replace')
    comm = event.comm.decode('utf-8', 'replace')
    
    # NAIVE Heuristic: Alert if the string 'nc' is found
    alert = "🔴 REVERSE SHELL THREAT!" if "nc" in comm or "nc" in fname else ""
    
    print(f"{event.pid:<8} {event.ppid:<8} {comm:<15} {fname:<30} {alert}")

b["events"].open_perf_buffer(print_event)

while True:
    try:
        b.perf_buffer_poll()
    except KeyboardInterrupt:
        print("\nExiting...")
        exit()
```

---

## 🛑 Phase 3: Real-World Troubleshooting

### The `<linux/fs.h>` Compilation Error
If you ever try to include `#include <linux/fs.h>` in the C code above, the Clang compiler might crash with an alignment mismatch on modern host kernels (e.g., Ubuntu 7.0+):
`error: static_assert failed due to requirement 'sizeof(struct filename) % 64 == 0'`

**The Fix:** eBPF is highly efficient. For `execve` tracing, we actually don't need the massive `fs.h` header! If you ever encounter this in older scripts, use this command to delete the include:
```bash
sed -i '/#include <linux\/fs.h>/d' detector.py
```

---

## 🎯 Phase 4: Execution and The "False Positive" Lesson

Start your detector in the background:
```bash
python3 detector.py &
```

Now, open a **brand new terminal window** on your host laptop. Look at the eBPF output in your container:

```text
PID      PPID     CALLING COMM    FILE EXECUTED
442332   329971   systemd-run     /usr/bin/bash                  
442341   442332   bash            /usr/bin/dircolors             
442343   442332   bash            /usr/libexec/vte-urlencode-cwd 🔴 REVERSE SHELL THREAT!
```

### The SOC Engineering Takeaway
Wait, why did `/usr/libexec/vte-urlencode-cwd` trigger the red threat alert?

Look at our Python heuristic: `if "nc" in comm or "nc" in fname`
Because we used a simple substring search, the letters `nc` inside the word `urle**nc**ode` triggered the alarm! 

This is a rite of passage for every SOC engineer: **The False Positive**. If deployed to production, this naive rule would flood your SIEM with thousands of fake alerts every time someone opened a terminal. 
*Fix:* In a real EDR, you must use exact string matching or regex boundaries (e.g., `comm == "nc"`).

### Triggering the Real Attack
Finally, in your new terminal window, simulate the actual attack:
```bash
nc -lvnp 4444 -e /bin/bash
```

Back in your eBPF logs, you will see the true threat intercepted deep in the kernel, complete with its Parent PID:
```text
442644   442332   bash            /usr/bin/nc                    🔴 REVERSE SHELL THREAT!
```

<!-- Mermaid JS for GitHub Pages -->
<script type="module">
  import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
  mermaid.initialize({ startOnLoad: false });
  document.addEventListener('DOMContentLoaded', async () => {
    const codeBlocks = document.querySelectorAll('code.language-mermaid');
    for (let block of codeBlocks) {
      const pre = block.parentElement;
      const mermaidDiv = document.createElement('div');
      mermaidDiv.className = 'mermaid';
      mermaidDiv.textContent = block.textContent;
      pre.replaceWith(mermaidDiv);
    }
    await mermaid.run();
  });
</script>
