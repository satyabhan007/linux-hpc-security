#!/usr/bin/env python3
"""
Ansible · Step 2 — what "idempotent" actually requires of a task.

A task is idempotent if the second run makes no change and reports `ok`,
not `changed`. State-modelled modules (package, copy, lineinfile,
service) check current state first. `command`/`shell` do not — they run
unconditionally and report `changed` every time unless you add a guard
(`creates:`, `removes:`, a `when:` on a registered check, or
`changed_when:`).

We model a tiny system and a handful of tasks, run the play TWICE, and
show which tasks converge.
"""


class System:
    def __init__(self):
        self.packages = {"vim"}
        self.files = {}                      # path -> content
        self.services = {}                   # name -> "running"/"stopped"
        self.ran = []                        # side-effect log for command tasks


def task_package(sys, name):
    if name in sys.packages:
        return "ok"
    sys.packages.add(name)
    return "changed"


def task_copy(sys, path, content):
    if sys.files.get(path) == content:
        return "ok"
    sys.files[path] = content
    return "changed"


def task_service(sys, name, state):
    if sys.services.get(name) == state:
        return "ok"
    sys.services[name] = state
    return "changed"


def task_command(sys, cmd, creates=None):
    if creates is not None and creates in sys.files:
        return "ok"                          # guard: skip, already done
    sys.ran.append(cmd)
    if creates is not None:
        sys.files[creates] = "<produced by %s>" % cmd
    return "changed"


PLAY = [
    ("package: git",              lambda s: task_package(s, "git")),
    ("copy: /etc/motd",           lambda s: task_copy(s, "/etc/motd", "welcome\n")),
    ("service: sshd running",     lambda s: task_service(s, "sshd", "running")),
    ("command: db-init (NO guard)", lambda s: task_command(s, "/opt/app/db-init")),
    ("command: cache-warm (creates:)", lambda s: task_command(s, "/opt/app/cache-warm",
                                                             creates="/var/lib/app/.warmed")),
]


def run_play(sys):
    return [(name, fn(sys)) for name, fn in PLAY]


def main():
    sys = System()
    r1 = run_play(sys)
    r2 = run_play(sys)

    print(f"{'task':>30}  {'run 1':>7}  {'run 2':>7}")
    for (name, s1), (_, s2) in zip(r1, r2):
        conv = "" if s2 == "ok" else "   <-- NOT idempotent"
        print(f"{name:>30}  {s1:>7}  {s2:>7}{conv}")

    d = dict((n, s) for n, s in r2)
    # state-modelled modules converge on run 2
    assert d["package: git"] == "ok"
    assert d["copy: /etc/motd"] == "ok"
    assert d["service: sshd running"] == "ok"
    # bare command runs again -> still 'changed', and it executed twice
    assert d["command: db-init (NO guard)"] == "changed"
    assert sys.ran.count("/opt/app/db-init") == 2
    # guarded command ran once, then the creates: file made run 2 a no-op
    assert d["command: cache-warm (creates:)"] == "ok"

    print("\n  the fix for a non-idempotent shell task is a guard, never ignore_errors.")
    print("\nPASS — state modules converge; bare command does not; creates: makes it converge.")


if __name__ == "__main__":
    main()
