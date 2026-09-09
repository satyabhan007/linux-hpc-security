#!/usr/bin/env python3
"""
Linux Security · Step 3 — SELinux type enforcement + domain transition.

SELinux is mandatory access control: every process has a *domain*
(a type like httpd_t), every file/socket/port an object *type*
(httpd_sys_content_t, shadow_t, http_port_t). Access is DENIED unless a
policy `allow` rule explicitly permits:

    allow  SUBJECT_TYPE  OBJECT_TYPE : CLASS  { PERMISSIONS };

DAC (the rwx bits) is checked first; SELinux is checked *after* and can
only *further* restrict. So even root (uid 0) running in a confined
domain cannot touch what the policy doesn't allow — that's the point.

We also model the *domain transition* on execve: httpd (init_t) execs
/usr/sbin/httpd (httpd_exec_t) and the new process runs as httpd_t, not
init_t. This is what confines a service the moment it starts.
"""

# A tiny slice of a real targeted policy.
ALLOW_RULES = {
    # (subject, object, class): {perms}
    ("httpd_t", "httpd_sys_content_t", "file"): {"read", "getattr", "open"},
    ("httpd_t", "httpd_log_t", "file"): {"read", "write", "append", "open", "create"},
    ("httpd_t", "http_port_t", "tcp_socket"): {"name_bind", "listen", "accept"},
    ("httpd_t", "httpd_t", "process"): {"fork", "signal", "sigchld"},
    ("init_t", "httpd_exec_t", "file"): {"read", "execute", "open"},
    ("sshd_t", "sshd_key_t", "file"): {"read", "getattr", "open"},
    ("sshd_t", "shadow_t", "file"): {"read", "getattr", "open"},
    ("user_t", "user_home_t", "file"): {"read", "write", "open", "getattr", "create"},
}

# domain transitions: (current_domain, entrypoint_type) -> new_domain
TYPE_TRANSITIONS = {
    ("init_t", "httpd_exec_t"): "httpd_t",
    ("init_t", "sshd_exec_t"): "sshd_t",
    ("sshd_t", "shell_exec_t"): "user_t",     # login shell drops to user_t
}


def av_decide(subject, obj, cls, perm, enforcing=True):
    """Access Vector decision. Returns (allowed, reason)."""
    rule = ALLOW_RULES.get((subject, obj, cls), set())
    if perm in rule:
        return True, "allow rule matched"
    reason = f"no allow {subject} {obj}:{cls} {{ {perm} }};"
    if not enforcing:
        return True, "PERMISSIVE (would deny) -> AVC logged only"
    return False, reason


def transition_on_exec(current_domain, entrypoint_type):
    return TYPE_TRANSITIONS.get((current_domain, entrypoint_type), current_domain)


def main():
    # 1. domain transition: systemd(init_t) starts the web server
    d = transition_on_exec("init_t", "httpd_exec_t")
    print(f"init_t execs httpd_exec_t  ->  runs as {d}")
    assert d == "httpd_t", d

    # 2. what httpd_t may and may not do
    checks = [
        ("httpd_t", "httpd_sys_content_t", "file", "read", True),    # serve the site
        ("httpd_t", "http_port_t", "tcp_socket", "name_bind", True), # bind :80/:443
        ("httpd_t", "shadow_t", "file", "read", False),              # DENY: read /etc/shadow
        ("httpd_t", "sshd_key_t", "file", "read", False),            # DENY: steal host keys
        ("httpd_t", "user_home_t", "file", "write", False),          # DENY: write user homes
    ]
    print(f"\n{'subject':>9} {'->':^2} {'object':>22} {'class':>11}  {'perm':>10}  {'result':>7}")
    for subj, obj, cls, perm, expect in checks:
        ok, reason = av_decide(subj, obj, cls, perm)
        print(f"{subj:>9} {'->':^2} {obj:>22} {cls:>11}  {perm:>10}  "
              f"{'ALLOW' if ok else 'DENY':>7}   {'' if ok else reason}")
        assert ok == expect, (subj, obj, perm, ok, expect)

    # 3. the classic web-defacement / LFI containment:
    #    attacker has RCE as the apache user (uid=apache) but domain httpd_t.
    #    DAC would let 'apache' read any world-readable file; SELinux won't.
    print("\nAttacker has code-exec as the apache user, domain httpd_t:")
    for target, obj_t in [("/etc/passwd", "passwd_file_t"),
                          ("/etc/shadow", "shadow_t"),
                          ("/root/.ssh/id_rsa", "ssh_home_t"),
                          ("/var/www/html/index.html", "httpd_sys_content_t")]:
        ok, _ = av_decide("httpd_t", obj_t, "file", "read")
        print(f"  read {target:<26} ({obj_t}) -> {'ALLOW' if ok else 'DENY'}")
    assert not av_decide("httpd_t", "shadow_t", "file", "read")[0]
    assert av_decide("httpd_t", "httpd_sys_content_t", "file", "read")[0]

    # 4. enforcing vs permissive
    ok_enf, _ = av_decide("httpd_t", "shadow_t", "file", "read", enforcing=True)
    ok_perm, why = av_decide("httpd_t", "shadow_t", "file", "read", enforcing=False)
    assert ok_enf is False and ok_perm is True
    print(f"\n  enforcing: DENY   |   permissive: {why}")
    print("  (permissive is for building/debugging policy, NOT a run state)")

    # 5. why 'setenforce 0' is a finding: it disables ALL of the above at once
    print("\n  `setenforce 0` turns every DENY above into ALLOW-with-a-log.")
    print("  A confined-root exploit that was contained now walks straight out.")

    print("\nPASS — domain transition confines the service; type enforcement denies"
          " shadow/keys/homes even to a compromised, uid-privileged process.")


if __name__ == "__main__":
    main()
