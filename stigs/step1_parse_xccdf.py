#!/usr/bin/env python3
"""
STIGs · Step 1 — parse an XCCDF benchmark the way `oscap` does.

XCCDF is the checklist language: <Benchmark> contains <Group>s and
<Rule>s; each Rule has a severity, an <ident> (CCI / NIST mapping), a
<fix>, and a <check> that points at an OVAL definition. A <Profile>
selects which rules apply for a context (e.g. "stig").

This parses a compact but structurally real XCCDF document with the
stdlib XML parser and reproduces what a scanner extracts.
"""
import xml.etree.ElementTree as ET

XCCDF = """\
<Benchmark id="xccdf_org.ssgproject.content_benchmark_RHEL-9" xmlns="x">
  <Profile id="xccdf_org.ssgproject.content_profile_stig">
    <select idref="xccdf_..._sshd_disable_root_login" selected="true"/>
    <select idref="xccdf_..._sshd_set_idle_timeout" selected="true"/>
    <select idref="xccdf_..._package_telnet_removed" selected="true"/>
    <select idref="xccdf_..._banner_etc_issue" selected="false"/>
  </Profile>
  <Group id="xccdf_..._group_ssh">
    <title>SSH Server</title>
    <Rule id="xccdf_..._sshd_disable_root_login" severity="medium">
      <title>Disable SSH root login</title>
      <ident system="https://public.cyber.mil/stigs/cci/">CCI-000770</ident>
      <fix system="urn:xccdf:fix:script:ansible">name: sshd\n  lineinfile: ...</fix>
      <check system="http://oval.mitre.org/XMLSchema/oval-definitions-5">
        <check-content-ref href="ssg-rhel9-oval.xml" name="oval:ssg:def:1"/>
      </check>
    </Rule>
    <Rule id="xccdf_..._sshd_set_idle_timeout" severity="medium">
      <title>Set SSH idle timeout</title>
      <ident system="cci">CCI-001133</ident>
      <check system="oval"><check-content-ref href="x" name="oval:ssg:def:2"/></check>
    </Rule>
  </Group>
  <Group id="xccdf_..._group_pkg">
    <title>Software</title>
    <Rule id="xccdf_..._package_telnet_removed" severity="high">
      <title>Remove telnet server</title>
      <ident system="cci">CCI-000381</ident>
      <check system="oval"><check-content-ref href="x" name="oval:ssg:def:3"/></check>
    </Rule>
    <Rule id="xccdf_..._banner_etc_issue" severity="low">
      <title>Login banner text</title>
      <ident system="cci">CCI-000048</ident>
      <check system="oval"><check-content-ref href="x" name="oval:ssg:def:4"/></check>
    </Rule>
  </Group>
</Benchmark>
"""

SEV_TO_CAT = {"high": "CAT I", "medium": "CAT II", "low": "CAT III"}
NS = "{x}"


def parse(xml_text):
    root = ET.fromstring(xml_text)

    selected = set()
    prof = root.find(f"{NS}Profile")
    for sel in prof.findall(f"{NS}select"):
        if sel.get("selected") == "true":
            selected.add(sel.get("idref"))

    rules = []
    for grp in root.findall(f"{NS}Group"):
        gtitle = grp.findtext(f"{NS}title")
        for rule in grp.findall(f"{NS}Rule"):
            rid = rule.get("id")
            rules.append({
                "id": rid,
                "group": gtitle,
                "title": rule.findtext(f"{NS}title"),
                "severity": rule.get("severity"),
                "cat": SEV_TO_CAT[rule.get("severity")],
                "cci": rule.findtext(f"{NS}ident"),
                "oval": rule.find(f"{NS}check/{NS}check-content-ref").get("name"),
                "has_fix": rule.find(f"{NS}fix") is not None,
                "selected": rid in selected,
            })
    return rules, selected


def main():
    rules, selected = parse(XCCDF)

    print(f"{'sev':>6}  {'cat':>6}  fix  sel  cci           title")
    for r in rules:
        print(f"{r['severity']:>6}  {r['cat']:>6}  "
              f"{'Y' if r['has_fix'] else '-'}    {'Y' if r['selected'] else '-'}    "
              f"{r['cci']:<12}  {r['title']}")

    active = [r for r in rules if r["selected"]]
    by_cat = {}
    for r in active:
        by_cat.setdefault(r["cat"], []).append(r)

    print(f"\n  profile 'stig' selects {len(active)}/{len(rules)} rules")
    for cat in ("CAT I", "CAT II", "CAT III"):
        print(f"    {cat}: {len(by_cat.get(cat, []))}")

    assert len(rules) == 4
    assert len(active) == 3                       # banner rule is selected=false
    assert by_cat["CAT I"][0]["title"] == "Remove telnet server"
    assert all(r["oval"].startswith("oval:") for r in rules)
    # only the root-login rule shipped an Ansible fix in this sample
    assert sum(r["has_fix"] for r in rules) == 1
    print("\nPASS — rules, severities->CAT, CCI idents, OVAL refs and profile selection extracted.")


if __name__ == "__main__":
    main()
