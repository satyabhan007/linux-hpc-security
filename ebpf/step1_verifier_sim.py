#!/usr/bin/env python3
"""
eBPF · Step 1 — why the verifier accepts or rejects a program.

Before the kernel runs an eBPF program it statically proves it is safe.
This models the checks that reject the most real-world programs:

  * unbounded loop (back-edge with no provable bound)
  * pointer dereference without a preceding NULL check
  * read of an uninitialised register / stack slot
  * total instruction count over the complexity limit
  * map value access past the map's value_size

Each "program" is a list of pseudo-instructions; the verifier walks them
and returns (accepted, reason).
"""

INSN_LIMIT = 1_000_000
MAP_VALUE_SIZE = 8


def verify(prog):
    initialised = {"r0", "r1"}          # r1 = ctx on entry, r0 scratch
    null_checked = set()
    seen_back_edge_bounds = []
    count = 0

    for i, insn in enumerate(prog):
        count += insn.get("weight", 1)
        op = insn["op"]

        if op == "mov":
            initialised.add(insn["dst"])

        elif op == "load_map_ptr":
            initialised.add(insn["dst"])
            # map lookup result MAY be NULL until checked
            null_checked.discard(insn["dst"])

        elif op == "null_check":
            null_checked.add(insn["reg"])

        elif op == "deref":
            r = insn["reg"]
            if r not in initialised:
                return False, f"insn {i}: deref of uninitialised {r}"
            if insn.get("may_be_null", True) and r not in null_checked:
                return False, f"insn {i}: deref of {r} without prior NULL check"
            off = insn.get("offset", 0)
            if off + insn.get("size", 8) > MAP_VALUE_SIZE and insn.get("into_map"):
                return False, (f"insn {i}: map value access off={off} size="
                               f"{insn.get('size',8)} exceeds value_size={MAP_VALUE_SIZE}")

        elif op == "alu":
            if insn["src"] not in initialised:
                return False, f"insn {i}: use of uninitialised {insn['src']}"
            initialised.add(insn["dst"])

        elif op == "loop":
            bound = insn.get("bound")
            if bound is None:
                return False, f"insn {i}: unbounded loop (no provable iteration bound)"
            seen_back_edge_bounds.append(bound)
            count += bound * insn.get("body_weight", 1)

        elif op == "exit":
            break

    if count > INSN_LIMIT:
        return False, f"complexity: {count} processed insns > {INSN_LIMIT} limit"
    return True, "accepted"


PROGRAMS = {
    "good: lookup + null check + bounded loop": [
        {"op": "load_map_ptr", "dst": "r6"},
        {"op": "null_check", "reg": "r6"},
        {"op": "deref", "reg": "r6", "offset": 0, "size": 8, "into_map": True, "may_be_null": True},
        {"op": "loop", "bound": 64, "body_weight": 3},
        {"op": "exit"},
    ],
    "reject: deref without null check": [
        {"op": "load_map_ptr", "dst": "r6"},
        {"op": "deref", "reg": "r6", "into_map": True},
        {"op": "exit"},
    ],
    "reject: unbounded loop": [
        {"op": "mov", "dst": "r2"},
        {"op": "loop"},                       # no bound
        {"op": "exit"},
    ],
    "reject: uninitialised register": [
        {"op": "alu", "dst": "r3", "src": "r9"},   # r9 never set
        {"op": "exit"},
    ],
    "reject: map value overflow": [
        {"op": "load_map_ptr", "dst": "r6"},
        {"op": "null_check", "reg": "r6"},
        {"op": "deref", "reg": "r6", "offset": 4, "size": 8, "into_map": True},  # 12 > 8
        {"op": "exit"},
    ],
    "reject: complexity blow-up": [
        {"op": "loop", "bound": 500_000, "body_weight": 4},
        {"op": "exit"},
    ],
}

EXPECT = {
    "good: lookup + null check + bounded loop": True,
    "reject: deref without null check": False,
    "reject: unbounded loop": False,
    "reject: uninitialised register": False,
    "reject: map value overflow": False,
    "reject: complexity blow-up": False,
}


def main():
    for name, prog in PROGRAMS.items():
        ok, reason = verify(prog)
        print(f"  {'LOAD ' if ok else 'REJECT'}  {name}")
        if not ok:
            print(f"          {reason}")
        assert ok == EXPECT[name], f"{name}: expected {EXPECT[name]}"

    print("\n  every rejection here is one a real developer hits in week one.")
    print("\nPASS — verifier accepts the safe program and rejects all five unsafe ones.")


if __name__ == "__main__":
    main()
