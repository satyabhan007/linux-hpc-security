#!/usr/bin/env python3
"""
STIGs · Step 3 — simulate an OVAL definition evaluation.

XCCDF says "check rule X"; the actual pass/fail is decided by an OVAL
*definition*: a boolean tree (criteria: operator AND/OR + negate) over
*tests*; each test binds an *object* (what to look at on the system) to
a *state* (what it must be), with a check like "all" / "at least one".

This implements a tiny OVAL engine with three object types
(textfilecontent54, sysctl, rpminfo) and evaluates real-looking
definitions against a mock system.
"""
import re

# ---- mock system under test -------------------------------------------------
SYSTEM = {
    "files": {
        "/etc/ssh/sshd_config": "Port 22\nPermitRootLogin no\nClientAliveInterval 0\n",
        "/etc/login.defs": "PASS_MAX_DAYS 60\nUMASK 077\n",
    },
    "sysctl": {
        "net.ipv4.ip_forward": 0,
        "kernel.randomize_va_space": 2,
    },
    "rpm": {"audit": "3.1.2", "openssh-server": "8.7p1"},   # telnet-server absent
}


# ---- object collectors ----------------------------------------------------
def collect(obj):
    kind = obj["type"]
    if kind == "textfilecontent54":
        text = SYSTEM["files"].get(obj["path"], "")
        return re.findall(obj["pattern"], text, re.M)      # list of captures
    if kind == "sysctl":
        v = SYSTEM["sysctl"].get(obj["name"])
        return [] if v is None else [str(v)]
    if kind == "rpminfo":
        v = SYSTEM["rpm"].get(obj["name"])
        return [] if v is None else [v]
    raise ValueError(kind)


def eval_test(test):
    items = collect(test["object"])
    state = test.get("state")           # None => existence test only
    exists_ok = {
        "at_least_one_exists": len(items) >= 1,
        "none_exist": len(items) == 0,
        "all_exist": len(items) >= 1,
    }[test.get("check_existence", "at_least_one_exists")]
    if state is None:
        return exists_ok
    if not items:
        return exists_ok and state is None
    matches = [state["op"](x) for x in items]
    check = test.get("check", "all")
    ok = all(matches) if check == "all" else any(matches)
    return exists_ok and ok


def eval_criteria(node):
    if "test" in node:
        r = eval_test(node["test"])
    else:
        results = [eval_criteria(c) for c in node["criteria"]]
        r = all(results) if node["operator"] == "AND" else any(results)
    return (not r) if node.get("negate") else r


# ---- definitions ---------------------------------------------------------
DEFINITIONS = {
    "oval:ssg:def:1  sshd PermitRootLogin no": {
        "test": {
            "object": {"type": "textfilecontent54",
                       "path": "/etc/ssh/sshd_config",
                       "pattern": r"^\s*PermitRootLogin\s+(\S+)"},
            "state": {"op": lambda v: v.lower() == "no"},
            "check": "all",
        }
    },
    "oval:ssg:def:2  sshd ClientAliveInterval > 0": {
        "test": {
            "object": {"type": "textfilecontent54",
                       "path": "/etc/ssh/sshd_config",
                       "pattern": r"^\s*ClientAliveInterval\s+(\d+)"},
            "state": {"op": lambda v: int(v) > 0},
        }
    },
    "oval:ssg:def:3  telnet-server not installed": {
        "test": {
            "object": {"type": "rpminfo", "name": "telnet-server"},
            "check_existence": "none_exist",
        }
    },
    "oval:ssg:def:4  hardened: ip_forward=0 AND aslr=2 AND audit installed": {
        "operator": "AND",
        "criteria": [
            {"test": {"object": {"type": "sysctl", "name": "net.ipv4.ip_forward"},
                      "state": {"op": lambda v: v == "0"}}},
            {"test": {"object": {"type": "sysctl", "name": "kernel.randomize_va_space"},
                      "state": {"op": lambda v: v == "2"}}},
            {"test": {"object": {"type": "rpminfo", "name": "audit"},
                      "check_existence": "at_least_one_exists"}},
        ],
    },
}

EXPECTED = {
    "oval:ssg:def:1  sshd PermitRootLogin no": True,
    "oval:ssg:def:2  sshd ClientAliveInterval > 0": False,   # config has 0
    "oval:ssg:def:3  telnet-server not installed": True,
    "oval:ssg:def:4  hardened: ip_forward=0 AND aslr=2 AND audit installed": True,
}


def main():
    print(f"{'result':>6}  definition")
    for name, defn in DEFINITIONS.items():
        got = eval_criteria(defn)
        flag = "PASS" if got else "FAIL"
        print(f"{flag:>6}  {name}")
        assert got == EXPECTED[name], f"{name}: expected {EXPECTED[name]} got {got}"

    # flip the system: set ClientAliveInterval, def:2 should now pass
    SYSTEM["files"]["/etc/ssh/sshd_config"] = \
        SYSTEM["files"]["/etc/ssh/sshd_config"].replace("ClientAliveInterval 0",
                                                        "ClientAliveInterval 600")
    assert eval_criteria(DEFINITIONS["oval:ssg:def:2  sshd ClientAliveInterval > 0"]) is True

    # install telnet-server: def:3 (none_exist) should now fail
    SYSTEM["rpm"]["telnet-server"] = "0.17"
    assert eval_criteria(DEFINITIONS["oval:ssg:def:3  telnet-server not installed"]) is False

    print("\n  the boolean tree + object/state binding IS the whole OVAL model.")
    print("\nPASS — OVAL definitions evaluate correctly, and re-evaluate when the system changes.")


if __name__ == "__main__":
    main()
