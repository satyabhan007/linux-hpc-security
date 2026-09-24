package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/clientcmd"
)

func main() {
	fmt.Println("🛡️  AutoSOC Kubernetes Operator Starting...")

	// 1. Authenticate to the local Kind cluster using your ~/.kube/config
	kubeconfig := filepath.Join(os.Getenv("HOME"), ".kube", "config")
	config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
	if err != nil {
		fmt.Printf("Error loading kubeconfig: %v\n", err)
		os.Exit(1)
	}
	
	clientset, err := kubernetes.NewForConfig(config)
	if err != nil {
		panic(err.Error())
	}

	fmt.Println("✅ Connected to cluster. Watching for compromised pods...")

	// 2. The Reconciliation Loop (Watching for threats)
	for {
		// Fetch all pods in the default namespace
		pods, err := clientset.CoreV1().Pods("default").List(context.TODO(), metav1.ListOptions{})
		if err != nil {
			panic(err.Error())
		}

		for _, pod := range pods.Items {
			// In a real system, your eBPF sensor (or TypeSafe AI) would apply this label 
			// when it detects a reverse shell inside a specific container.
			if pod.Labels["security"] == "compromised" {
				
				// Check if we have already quarantined this pod
				if pod.Labels["quarantine"] != "true" {
					fmt.Printf("\n🚨 THREAT DETECTED: Pod '%s' has been flagged!\n", pod.Name)
					fmt.Println("⚡ Taking automated remediation action...")

					// 3. Autonomous Remediation: Quarantine the Pod
					pod.Labels["quarantine"] = "true"
					
					// Push the update back to the Kubernetes API
					_, err := clientset.CoreV1().Pods("default").Update(context.TODO(), &pod, metav1.UpdateOptions{})
					if err != nil {
						fmt.Printf("❌ Failed to quarantine pod: %v\n", err)
					} else {
						fmt.Printf("🔒 SUCCESS: Pod '%s' has been isolated.\n", pod.Name)
					}
				}
			}
		}
		// Poll every 2 seconds (simplified for lab purposes)
		time.Sleep(2 * time.Second)
	}
}
