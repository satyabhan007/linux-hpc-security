#!/usr/bin/env python3
"""
Warewulf · Step 2 — render a per-node overlay template.

Warewulf overlays are Go text/templates evaluated once per node with that
node's facts ({{ .Hostname }}, {{ .Ipaddr }}, {{ range .NetDevs }} ...).
One template file becomes N different rendered files, one per node.

This implements just enough of the template language — the "dot" context,
{{ .Field }}, {{ .A.B }}, {{ range .List }}..{{ end }}, {{ if .Flag }}..
{{ end }} — to render a real /etc/hosts and an ifcfg file.
"""
import re


def resolve(dot, path):
    """path like '.' or '.Field' or '.A.B' -> value from the current dot."""
    if path == ".":
        return dot
    cur = dot
    for part in path.strip(".").split("."):
        cur = cur.get(part) if isinstance(cur, dict) else getattr(cur, part, None)
    return cur


def render(tmpl, dot):
    # {{ range .X }} body {{ end }}  -> body rendered with dot = each item
    def do_range(m):
        seq = resolve(dot, m.group(1)) or []
        return "".join(render(m.group(2), item) for item in seq)

    tmpl = re.sub(r"\{\{\s*range\s+(\.[.\w]*)\s*\}\}(.*?)\{\{\s*end\s*\}\}",
                  do_range, tmpl, flags=re.S)

    # {{ if .X }} body {{ end }}
    def do_if(m):
        return m.group(2) if resolve(dot, m.group(1)) else ""

    tmpl = re.sub(r"\{\{\s*if\s+(\.[.\w]*)\s*\}\}(.*?)\{\{\s*end\s*\}\}",
                  do_if, tmpl, flags=re.S)

    # {{ .X }} scalar
    return re.sub(r"\{\{\s*(\.[.\w]*)\s*\}\}", lambda m: str(resolve(dot, m.group(1))), tmpl)


HOSTS_TMPL = """\
127.0.0.1   localhost
{{ range .Nodes }}{{ .ip }}\t{{ .name }}\t{{ .name }}.cluster
{{ end }}"""

IFCFG_TMPL = """\
# rendered for {{ .Hostname }}
DEVICE={{ .Dev }}
BOOTPROTO=none
IPADDR={{ .Ipaddr }}
PREFIX={{ .Prefix }}
GATEWAY={{ .Gateway }}
{{ if .Bonded }}BONDING_OPTS="mode=802.3ad miimon=100"
{{ end }}ONBOOT=yes
"""


def main():
    nodes = [
        {"name": "cpu001", "ip": "10.0.1.1"},
        {"name": "cpu002", "ip": "10.0.1.2"},
        {"name": "gpu001", "ip": "10.0.1.50"},
    ]

    hosts = render(HOSTS_TMPL, {"Nodes": nodes})
    print("=== /etc/hosts (one file, shared) ===")
    print(hosts)
    assert "10.0.1.1\tcpu001\tcpu001.cluster" in hosts
    assert hosts.count(".cluster") == 3
    assert "localhost" in hosts

    print("=== ifcfg-eth0 (rendered per node) ===")
    per_node = {}
    for n in nodes:
        dot = {"Hostname": n["name"], "Dev": "eth0", "Ipaddr": n["ip"],
               "Prefix": 24, "Gateway": "10.0.1.254",
               "Bonded": n["name"] == "gpu001"}
        out = render(IFCFG_TMPL, dot)
        per_node[n["name"]] = out
        print(f"--- {n['name']} ---\n{out}")

    ip_of = {n["name"]: n["ip"] for n in nodes}
    for name, txt in per_node.items():
        assert f"rendered for {name}" in txt
        assert f"IPADDR={ip_of[name]}" in txt

    assert "BONDING_OPTS" in per_node["gpu001"]
    assert "BONDING_OPTS" not in per_node["cpu001"]

    print("PASS — one template -> N node-specific files; range and if both evaluated.")


if __name__ == "__main__":
    main()
