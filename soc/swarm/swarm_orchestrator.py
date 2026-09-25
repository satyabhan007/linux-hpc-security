import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
from typing import TypedDict, Dict, Any
from langgraph.graph import StateGraph, END
from typesafe_sdk import TypeSafeClient, Noul, Choice
from neo4j import GraphDatabase
from kubernetes import client, config

# 1. Define the Global State of our Swarm
class SIEMState(TypedDict):
    telemetry: Dict[str, Any]
    context: str
    threat_score: float
    action: str
    status: str

# 2. Node 1: Real Neo4j Context Enrichment
def enrich_context(state: SIEMState):
    print("\n[Node 1: Neo4j Graph DB] Querying cluster context for blast radius...")
    
    target_pid = state["telemetry"]["pid"]
    URI = "bolt://localhost:7687"
    AUTH = ("neo4j", "password123")
    
    try:
        with GraphDatabase.driver(URI, auth=AUTH) as driver:
            with driver.session() as session:
                # Ask the graph: "Find the pod running this PID, and tell me what IAM roles or Secrets it can access."
                query = """
                MATCH (p:Pod {pid: $pid})-[r]->(asset)
                RETURN p.name AS pod, type(r) AS relation, asset.name AS asset_name
                """
                results = session.run(query, pid=target_pid)
                
                context_strings = []
                pod_name = "unknown"
                for record in results:
                    pod_name = record["pod"]
                    context_strings.append(f"{record['relation']} {record['asset_name']}")
                
                if context_strings:
                    blast_radius = f"Pod '{pod_name}' context: " + ", ".join(context_strings)
                    print(f"   -> Graph Result: {blast_radius}")
                    return {"context": blast_radius}
                else:
                    return {"context": "No elevated infrastructure context found."}
    except Exception as e:
        print(f"   -> Neo4j Error: Is Docker running? ({e})")
        return {"context": "Graph DB Unreachable"}

# 3. Node 2: TypeSafe AI Governor
def evaluate_threat(state: SIEMState):
    print("\n[Node 2: TypeSafe AI] Evaluating eBPF telemetry + Neo4j context...")
    
    ts_client = TypeSafeClient()
    
    combined_state = {
        "ebpf_telemetry": state["telemetry"],
        "infrastructure_context": state.get("context", "")
    }
    
    result = ts_client.system_one(
        state=combined_state,
        questions={
            "is_threat": Noul(instructions="Based on the telemetry and IAM context, is this a critical data exfiltration threat?"),
            "remediation": Choice(
                instructions="Select the safest remediation action.",
                criteria={
                    "QUARANTINE_POD": "Isolate the container immediately.",
                    "ALERT_ONLY": "Send to a human SOC analyst.",
                    "IGNORE": "Normal behavior."
                }
            )
        }
    )
    
    threat_score = result.nouls["is_threat"].noul
    action = result.choices["remediation"].choice
    
    print(f"   -> Threat Probability: {threat_score * 100:.1f}%")
    print(f"   -> Chosen Action: {action}")
    return {"threat_score": threat_score, "action": action}

def route_action(state: SIEMState):
    if state.get("action") == "QUARANTINE_POD":
        return "execute_remediation"
    return "end"

# 4. Node 3: Real Kubernetes API Execution
def execute_remediation(state: SIEMState):
    print("\n[Node 3: K8s Python Client] Triggering AutoSOC Go Operator...")
    try:
        config.load_kube_config()
        v1 = client.CoreV1Api()
        
        # We assume the pod name is victim-pod for the lab
        pod_name = "victim-pod"
        namespace = "default"
        
        print(f"   -> Patching Kubernetes API: Labeling '{pod_name}' with 'security=compromised'")
        body = {"metadata": {"labels": {"security": "compromised"}}}
        
        v1.patch_namespaced_pod(name=pod_name, namespace=namespace, body=body)
        print("   -> Success! The Kubernetes Go Operator will now detect this label and sever network access.")
        return {"status": "K8S_API_MUTATED"}
        
    except Exception as e:
        print(f"   -> Kubernetes API Error: {e}")
        return {"status": "K8S_ERROR"}


# --- Build the LangGraph State Machine ---
workflow = StateGraph(SIEMState)

workflow.add_node("enrich_context", enrich_context)
workflow.add_node("evaluate_threat", evaluate_threat)
workflow.add_node("execute_remediation", execute_remediation)

workflow.set_entry_point("enrich_context")
workflow.add_edge("enrich_context", "evaluate_threat")
workflow.add_conditional_edges("evaluate_threat", route_action, {"execute_remediation": "execute_remediation", "end": END})
workflow.add_edge("execute_remediation", END)

app = workflow.compile()

if __name__ == "__main__":
    print("🚀 Initiating LangGraph Autonomous SIEM Swarm...\n")
    initial_state = {
        "telemetry": {"pid": 442644, "cmdline": "nc -e /bin/bash"},
        "context": "", "threat_score": 0.0, "action": "", "status": "DETECTED"
    }
    final_state = app.invoke(initial_state)
    print("\n🏁 Swarm Execution Complete!")
    print(f"Final Status of Infrastructure: {final_state['status']}")
