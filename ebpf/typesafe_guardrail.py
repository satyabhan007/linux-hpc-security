#!/usr/bin/env python3
import os
import json
from typesafe_sdk import TypeSafeClient, Noul, Choice

# Initialize the TypeSafe client
try:
    client = TypeSafeClient(api_key=os.environ.get("TYPESAFE_API_KEY", "YOUR_API_KEY_HERE"))
except Exception as e:
    print("Please install the SDK: pip install typesafe-sdk")
    exit(1)

# 1. THE STATE: This is raw telemetry streamed from our eBPF sensor (detector.py)
ebpf_telemetry = {
    "pid": 442644,
    "ppid": 442332,
    "comm": "nc",
    "fname": "/usr/bin/nc",
    "cmdline": "nc -lvnp 4444 -e /bin/bash",
    "user": "www-data",
    "parent_comm": "node"
}

print("🛡️ TypeSafe Autonomous Guardrail Initiated")
print(f"Analyzing eBPF Telemetry for PID {ebpf_telemetry['pid']}...\n")

# 2. THE AI EVALUATION: We don't ask for text. We ask for typed Primitives.
result = client.system_one(
    state=ebpf_telemetry,
    questions={
        # Noul (Boolean Probability): Does this look like an attack?
        "is_threat": Noul(
            instructions="Does this process execution resemble a malicious reverse shell, supply chain exploit, or unauthorized command-and-control behavior?"
        ),
        
        # Choice: Force the AI into strict, predefined operational bounds
        "remediation": Choice(
            instructions="Based on the severity of the execution, what is the safest autonomous remediation action?",
            criteria={
                "KILL_PROCESS": "Terminate the specific process via eBPF LSM immediately to stop the shell.",
                "QUARANTINE_NETWORK": "Deploy an eBPF XDP filter to block all inbound/outbound traffic on the host.",
                "IGNORE": "This represents normal, safe system behavior. Take no action."
            }
        )
    }
)

# 3. DETERMINISTIC EXECUTION
# Because TypeSafe returns typed objects, our Python script doesn't have to parse text or worry about hallucinations.
is_threat = result.nouls["is_threat"]
action = result.choices["remediation"]

print("--- AI SWARM VERDICT ---")
print(f"Threat Probability : {is_threat.noul * 100:.2f}%")
print(f"Selected Action    : {action.choice}")
print(f"Action Confidence  : {action.confidence * 100:.2f}%\n")

# Safe Execution Logic
if is_threat.noul > 0.85 and action.choice == "KILL_PROCESS":
    print(f"🚨 ACTION TRIGGERED: Generating eBPF LSM payload to terminate PID {ebpf_telemetry['pid']}")
    # Here is where we would inject the eBPF C code!
elif action.choice == "IGNORE":
    print("✅ SYSTEM SAFE: No action taken.")
else:
    print("⚠️ THREAT UNCERTAIN: Routing to Human-in-the-Loop (HITL) for manual review.")
