---
name: lab-shortcomings
description: Critical environmental fixes and boundaries for eBPF, Python, Kubernetes, and GitHub Pages in this repository.
---
# Critical Environment Constraints & Fixes

When working on labs, writing code, or generating terminal commands in this repository, you MUST adhere to the following constraints:

1. **eBPF XDP & Clang Compiler (`sizeof(struct filename)` bug)**: 
   - NEVER use `#include <linux/ip.h>`, `<linux/if_ether.h>`, or `<linux/fs.h>` for XDP packet filtering on modern Ubuntu host kernels.
   - ALWAYS manually define `struct ethhdr` and `struct iphdr` directly in the C code to ensure cross-kernel compilation.

2. **TypeSafe AI Packaging**: 
   - ALWAYS use `pip install typesafe-ai` (never `typesafe`).
   - ALWAYS use `from typesafe_sdk import TypeSafeClient`.

3. **Python PEP-668**: 
   - Ubuntu blocks global pip installs. Use `--break-system-packages` for quick host-level lab scripts, or instruct the user to use a `.venv`.

4. **KinD & Docker Socket Permissions**: 
   - NEVER run `sudo kind` to spin up a cluster (it breaks `.kube/config` ownership).
   - ALWAYS use `sudo chmod 666 /var/run/docker.sock` to quickly bypass permission denied errors for local labs.

5. **Go Modules**: 
   - ALWAYS run `go mod tidy` to fetch transitive dependencies before attempting to run or build any Go code.

6. **GitHub Pages Deployment**: 
   - Newly created markdown or HTML files in the root directory will throw a 404 ENOENT on the live site unless explicitly whitelisted in the `cp` command inside `.github/workflows/deploy-pages.yml`.
   - When instructing the user to view live changes, append `?v=latest` to the URL to bust the Fastly CDN cache.
