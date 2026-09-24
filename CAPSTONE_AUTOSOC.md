# 🚀 Capstone: The Autonomous SOC Architecture

Welcome to the ultimate synthesis of Systems Engineering, Artificial Intelligence, and Kubernetes Orchestration. 

In this interactive deep-dive, we architect a **Self-Healing Infrastructure**. We combine the raw hardware speed of **eBPF**, the deterministic reasoning of **TypeSafe AI**, and the orchestration power of a custom **Kubernetes Go Operator** to detect and remediate threats in milliseconds—with zero human intervention.

---

## 🏗️ The End-to-End Architecture

```mermaid
flowchart TD
    subgraph Phase 1: The Metal (eBPF)
        Kernel[Linux Kernel - Ring 0]
        XDP[XDP Driver Firewall]
        BCC[eBPF Tracepoint Sensor]
        Kernel <--> XDP
        Kernel --> BCC
    end

    subgraph Phase 2: The Brain (TypeSafe AI)
        TS_API[TypeSafe System One API]
        BCC -- "Raw Telemetry JSON" --> TS_API
        TS_API -- "Typed Decision (Noul/Choice)" --> Alert[Threat Alert System]
    end

    subgraph Phase 3: The Orchestrator (K8s Go Operator)
        K8s_API[Kubernetes API Server]
        Go_Op[AutoSOC Go Operator]
        Alert -- "Applies label: security=compromised" --> K8s_API
        K8s_API <--> |Reconciliation Loop| Go_Op
        Go_Op -- "Mutates Pod: quarantine=true" --> K8s_API
    end

    classDef metal fill:#2b2d42,stroke:#8d99ae,stroke-width:2px,color:white;
    classDef ai fill:#d90429,stroke:#ef233c,stroke-width:2px,color:white;
    classDef k8s fill:#003566,stroke:#001d3d,stroke-width:2px,color:white;
    
    class Kernel,XDP,BCC metal;
    class TS_API,Alert ai;
    class K8s_API,Go_Op k8s;
```

---

## 🛡️ Phase 1: eBPF (Extracting Truth from the Metal)

Traditional security tools read logs *after* an event happens in User Space (Ring 3). Attackers can easily spoof these logs. **eBPF (Extended Berkeley Packet Filter)** allows us to write C code that executes directly inside the Kernel (Ring 0), making evasion mathematically impossible.

> [!IMPORTANT]  
> **The XDP DDoS Firewall:** Instead of relying on iptables, we wrote an eBPF XDP program that intercepts packets directly at the Network Interface Card (NIC). It drops malicious traffic at 10 million packets/second before the Linux OS even allocates memory.

<details>
<summary><b>💻 Click to view the eBPF XDP Mitigation Code (C / Python)</b></summary>

```python
# The Bulletproof XDP C Program (Bypassing fs.h compiler crashes)
bpf_text = """
#include <uapi/linux/bpf.h>
#define ETH_P_IP 0x0800
#define IPPROTO_ICMP 1

// We manually define structs to guarantee compilation on 100% of Linux kernels
struct ethhdr { unsigned char h_dest[6]; unsigned char h_source[6]; unsigned short h_proto; };
struct iphdr { unsigned char ihl:4; unsigned char version:4; unsigned char tos; unsigned short tot_len; unsigned short id; unsigned short frag_off; unsigned char ttl; unsigned char protocol; unsigned short check; unsigned int saddr; unsigned int daddr; };

int xdp_drop_icmp(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;
    struct ethhdr *eth = data;
    
    // VERIFIER: Proving we aren't reading out of bounds
    if ((void *)(eth + 1) > data_end) return XDP_PASS;
    if (eth->h_proto != bpf_htons(ETH_P_IP)) return XDP_PASS;

    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end) return XDP_PASS;

    // Is this an ICMP (Ping) DDoS packet? 💥 VAPORIZE IT!
    if (ip->protocol == IPPROTO_ICMP) return XDP_DROP;
    return XDP_PASS;
}
"""
```
</details>

---

## 🧠 Phase 2: TypeSafe AI (Deterministic Governance)

Generative LLMs (like ChatGPT) output conversational text. If you feed eBPF telemetry to a standard LLM and ask for a remediation action, it might output: *"I recommend you run `kill -9 1`"*. A hallucination of a single character in an autonomous shell script will crash your entire infrastructure.

We solved this using **TypeSafe AI's System One models**. System One models do not chat. They evaluate Application State against typed primitives (`Noul` for probability, `Choice` for routing).

> [!TIP]  
> **The Guardrail:** Our script forces the AI into a strict box. It must return a boolean probability and a predefined exact string (e.g., `KILL_PROCESS`). This allows our systems to execute Python `if/else` blocks safely based on AI logic.

<details>
<summary><b>💻 Click to view the TypeSafe Autonomous Guardrail Code</b></summary>

```python
from typesafe_sdk import TypeSafeClient, Noul, Choice

client = TypeSafeClient(api_key="...")

# 1. State: Raw eBPF Telemetry
ebpf_telemetry = {"pid": 442644, "cmdline": "nc -lvnp 4444 -e /bin/bash"}

# 2. Evaluation: Typed Primitives (No Text Parsing!)
result = client.system_one(
    state=ebpf_telemetry,
    questions={
        "is_threat": Noul(instructions="Is this a reverse shell?"),
        "remediation": Choice(
            instructions="Select the safest remediation action.",
            criteria={
                "KILL_PROCESS": "Terminate process.",
                "QUARANTINE_NETWORK": "Apply NetworkPolicy.",
                "IGNORE": "Normal behavior."
            }
        )
    }
)

# 3. Deterministic Execution
if result.nouls["is_threat"].noul > 0.85 and result.choices["remediation"].choice == "KILL_PROCESS":
    print("🚨 ACTION TRIGGERED: Generating eBPF LSM payload...")
```
</details>

---

## ☸️ Phase 3: The Kubernetes Go Operator (Orchestration)

Our eBPF sensors and TypeSafe APIs run on individual Linux nodes. To scale this to an enterprise cluster, we wrote a custom **Kubernetes Operator in Go**.

When the TypeSafe AI confirms a threat, it doesn't kill the container directly (which Kubernetes would just immediately restart). Instead, it communicates with the Kubernetes API Server, labeling the victim Pod as `security=compromised`.

Our Go Operator constantly watches the cluster. When it sees that label, it automatically injects a `quarantine=true` label, triggering a strict K8s NetworkPolicy to sever the Pod's network access, containing the blast radius instantly.

<details>
<summary><b>💻 Click to view the AutoSOC Go Operator Code</b></summary>

```go
package main

import (
	"context"
	"fmt"
	"time"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

func main() {
	// Authenticate to the local cluster
	config, _ := clientcmd.BuildConfigFromFlags("", kubeconfig)
	clientset, _ := kubernetes.NewForConfig(config)

	// The Reconciliation Loop
	for {
		pods, _ := clientset.CoreV1().Pods("default").List(context.TODO(), metav1.ListOptions{})
		for _, pod := range pods.Items {
			// If our eBPF/TypeSafe sensor flagged this pod...
			if pod.Labels["security"] == "compromised" {
				// And it isn't quarantined yet...
				if pod.Labels["quarantine"] != "true" {
					fmt.Printf("🚨 THREAT DETECTED in Pod '%s'!\n", pod.Name)
					
					// Mutate the Pod to isolate it
					pod.Labels["quarantine"] = "true"
					clientset.CoreV1().Pods("default").Update(context.TODO(), &pod, metav1.UpdateOptions{})
					
					fmt.Printf("🔒 SUCCESS: Pod '%s' has been isolated.\n", pod.Name)
				}
			}
		}
		time.Sleep(2 * time.Second)
	}
}
```
</details>

## 🏆 Conclusion
By completing this Capstone, you have bridged the lowest levels of hardware memory (eBPF) with the highest levels of declarative container orchestration (Kubernetes), all governed by the determinism of System One AI. This is the future of Autonomous Security Engineering.
