/* linux-hpc-security Learn — Part 4 · Chapter 11: Network Segmentation & Micro-Segmentation for Bare Metal */
window.CH[11] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>The fleet is "segmented" because there is a firewall at the datacenter perimeter and a couple of VLANs for prod vs. dev. ' +
      'Inside the "prod" VLAN, every one of five thousand nodes can reach every other node on every port — so the moment one web server ' +
      'gets compromised, the attacker has an unobstructed path to the database tier, the build servers, and the internal admin panel, ' +
      'all on the same flat network.</p>' +
      '<pre><code>Perimeter firewall + a couple of flat VLANs   →   Micro-segmentation: a compromised node can only\n' +
      '  (compromise one node, reach everything)            reach the specific hosts/ports its role requires</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A building with one locked front door but no locks on any interior ' +
      'office vs. a building where each office needs its own badge.</b> Once anyone gets past the front door, a flat interior means they ' +
      'can walk into the CFO\'s office as easily as the break room. Interior locks mean getting past the front door buys almost nothing.</p></div>',
      try: [
        ['📖 NIST — Zero Trust Architecture (SP 800-207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 10 — privileged access management & just-in-time access', '#ch10', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>On bare metal (no cloud-native security groups to lean on), micro-segmentation is enforced with host-level firewalling ' +
      '(<b>nftables</b>) applied consistently by role, plus VLANs for coarse east-west boundaries between tiers:</p>' +
      '<pre><code># nftables: default-deny, then explicitly allow only what a role needs\n' +
      '$ nft add table inet filter\n' +
      '$ nft add chain inet filter input { type filter hook input priority 0 \\; policy drop \\; }\n' +
      '$ nft add rule inet filter input ip saddr 10.10.20.0/24 tcp dport 5432 accept   # app tier -> db port only\n' +
      '$ nft add rule inet filter input ct state established,related accept\n' +
      '$ nft add rule inet filter input iif lo accept\n\n' +
      '# apply the same role-based ruleset via config management, not by hand per-host\n' +
      '$ ansible-playbook segmentation.yml -i inventory.ini --limit db_tier --check\n\n' +
      '# verify from a would-be attacker\'s vantage point: confirm the app tier truly cannot reach the admin VLAN\n' +
      '$ nmap -p- 10.10.30.5 --source-port 53</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard pattern is <b>default-deny <code>nftables</code></b> ' +
      'policy per host role, generated from a declarative, version-controlled model (which tier may talk to which tier, on which ports) ' +
      'and applied consistently by config management — with periodic, automated <b>reachability testing</b> (not just rule review) to ' +
      'confirm the enforced state actually matches the intended policy.</p></div>',
      try: [
        ['📖 nftables — wiki & documentation', 'https://wiki.nftables.org/wiki-nftables/index.php/Main_Page', 'o'],
        ['📖 NIST — microsegmentation guidance (SP 800-215/207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The segmentation policy nobody could actually verify.</b> A ' +
      'team writes a thorough micro-segmentation policy document and applies nftables rules by hand across the fleet — six months later ' +
      'a security review finds a third of hosts have drifted from the documented policy because of ad hoc changes during incidents that ' +
      'never got reconciled. Fix: segmentation policy has to be declarative and continuously reconciled/re-applied (config management, ' +
      'Ch 1-style drift detection) — a policy document describing rules that may or may not match reality is worse than no document.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>The "how far could a compromised node reach" tabletop that ' +
      'found a flat path.</b> A tabletop exercise walks through a hypothetical compromised build-agent node and discovers it can reach ' +
      'the entire database tier directly — because build agents were granted broad access years ago to simplify a one-time migration ' +
      'that never got scoped back down. Fix: run this exact exercise periodically as a standing practice (tie it to Ch 14\'s red/blue ' +
      'exercises) — segmentation gaps accumulate from one-time exceptions that outlive their original justification.</p></div>' +
      '<p><b>East-west matters more than north-south at fleet scale:</b> most real damage after an initial compromise comes from lateral ' +
      'movement between internal hosts, not from the perimeter being breached again — segmentation effort should be weighted accordingly.</p>',
      try: [
        ['📖 CISA — zero trust maturity model', 'https://www.cisa.gov/zero-trust-maturity-model', 'o'],
        ['🛡️ Ch 14 — red team / blue team exercise design', '#ch14', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'Perimeter firewall + flat internal VLANs    Default-deny host-level firewalling (nftables) scoped per role, so a\n' +
      '  ("segmented" in name only)                   compromised node can only reach what its role explicitly requires.\n' +
      'Segmentation rules applied by hand,          Declarative, version-controlled policy applied by config management,\n' +
      '  drift from documented policy over time        with continuous drift detection like any other compliance control.\n' +
      'Broad access granted for a one-time          Time-box and scope-limit exceptions; review and revoke them once\n' +
      '  migration/project, never scoped back down     the original justification (the migration, the project) is over.\n' +
      'Segmentation policy reviewed on paper only   Periodically test actual reachability (e.g. scan from inside a tier)\n' +
      '  (rule review, not reachability testing)       to confirm enforced state matches intended policy, not just on paper.\n' +
      'Segmentation treated as a one-time project    Tie it to a recurring practice — a "how far could a compromised node\n' +
      '  with no ongoing verification                  reach" tabletop (Ch 14) run on a schedule, not once.\n' +
      'All internal traffic treated as equally       Prioritize segmentation around the highest-value lateral-movement\n' +
      '  trusted regardless of tier sensitivity         paths first (e.g. app tier -> database tier, build -> secrets).</code></pre>' +
      '<p><b>The real test:</b> pick any two hosts in different tiers at random. Can you state, without checking a firewall rule, ' +
      'exactly which ports (if any) one is allowed to reach on the other — and would a live scan confirm you\'re right?</p>',
      try: [
        ['📖 NIST — SP 800-215 (microsegmentation planning)', 'https://csrc.nist.gov/pubs/sp/800/215/final', 'o'],
        ['🛡️ Ch 1 — DISA STIG automation at fleet scale', '#ch1', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, micro-segmentation is about bounding <b>blast radius</b> under the assumption that some node WILL be ' +
      'compromised eventually — the perimeter is not the last line of defense, it is one of many, and internal network policy has to ' +
      'assume an attacker is already inside. The goal is not "no compromise ever happens" (unrealistic at fleet scale) but "a ' +
      'compromise of one node cannot silently become a compromise of the whole fleet" because the network itself refuses the lateral hop.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: Why is a perimeter firewall plus a couple of flat internal VLANs not real segmentation at fleet scale?\n' +
      'A: Once any single node inside the flat internal network is compromised, it can reach every other node\n' +
      '   on every port with no further obstruction — the perimeter only stops the FIRST hop, not lateral\n' +
      '   movement once an attacker is already inside.\n\n' +
      'Q: Why must segmentation policy be declarative and continuously reconciled, rather than applied by hand\n' +
      '   once?\n' +
      'A: Ad hoc changes during incidents and one-off exceptions accumulate drift over time; without\n' +
      '   continuous reconciliation, the documented policy stops matching the actual enforced state, and\n' +
      '   nobody notices until an incident or audit exposes the gap.\n\n' +
      'Q: A tabletop exercise reveals a build-agent node can reach the entire database tier directly. What\n' +
      '   does this usually indicate?\n' +
      'A: A broad access grant made for a past one-time project (e.g. a migration) that was never scoped back\n' +
      "   down after the original justification expired — a common source of segmentation gaps.\n\n" +
      'Q: Why is testing actual network reachability more meaningful than reviewing firewall rule\n' +
      '   configuration on paper?\n' +
      'A: A rule review only confirms what SHOULD be true according to the config; a live reachability test\n' +
      '   confirms what IS actually enforced — the two can diverge due to rule ordering, drift, or errors\n' +
      '   invisible in a static review.\n\n' +
      'Q: Why should segmentation effort be weighted toward east-west (internal, lateral) traffic rather than\n' +
      '   only hardening north-south (perimeter) traffic?\n' +
      'A: Most damage after an initial breach comes from lateral movement between internal hosts, not repeated\n' +
      '   perimeter breaches — segmentation that only guards the edge leaves the highest-impact attack path\n' +
      '   (movement toward high-value internal tiers) largely open.</code></pre>',
      try: [
        ['📖 NIST — Zero Trust Architecture (SP 800-207)', 'https://csrc.nist.gov/pubs/sp/800/207/final', 'o'],
        ['🛡️ Ch 16 — the compliance-as-code security platform reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why is a perimeter firewall combined with a couple of flat internal VLANs not considered real network segmentation at fleet scale?',
      opts: [
        'Perimeter firewalls provide no security value whatsoever',
        'Once any node inside the flat internal network is compromised, it can reach every other node on every port, so the perimeter only blocks the first hop, not lateral movement',
        'VLANs cannot be configured on bare-metal hardware',
        'Flat networks are actually more secure than segmented ones'],
      ok: 1,
      why: 'Real segmentation must bound lateral (east-west) movement between internal hosts, which a flat internal network with only a perimeter firewall does not do.' },
    { q: 'Why must micro-segmentation policy be declarative and continuously reconciled rather than applied manually once?',
      opts: [
        'Manual application is always faster and equally reliable',
        'Ad hoc incident-time changes and one-off exceptions accumulate drift, causing the documented policy to diverge from the actually-enforced state over time',
        'nftables rules automatically expire after 30 days',
        'Declarative policy is required by nftables syntax'],
      ok: 1,
      why: 'Without continuous reconciliation (similar to compliance drift detection elsewhere in this course), enforced firewall state silently drifts from documented intent.' },
    { q: 'What does a "how far could a compromised node reach" tabletop exercise typically reveal about segmentation gaps?',
      opts: [
        'That segmentation gaps are purely theoretical and never occur in practice',
        'Broad access grants made for a past one-time project or migration that were never scoped back down after their original justification ended',
        'That nftables is fundamentally incapable of enforcing segmentation',
        'That segmentation gaps only ever originate from the perimeter firewall'],
      ok: 1,
      why: 'These tabletop exercises commonly surface stale, overly broad access left over from past projects — a frequent, accumulating source of segmentation weakness.' }
  ]
};
