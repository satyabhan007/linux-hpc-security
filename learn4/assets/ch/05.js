/* linux-hpc-security Learn — Part 4 · Chapter 5: Supply-Chain Security — SBOM & Image Signing */
window.CH[5] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html:
      '<p>A critical CVE drops in a widely-used compression library. The question "which of our five thousand running containers ' +
      'actually contain that library, and at what version?" takes three days of grepping package manifests to answer — by which point ' +
      'the exploit is already public. Not knowing what is inside your own images is not a paperwork gap; it is the reason incident ' +
      'response takes days instead of minutes.</p>' +
      '<pre><code>"grep through images when a CVE drops"    →    Query a generated SBOM: "show every image containing\n' +
      '  (days, incomplete, reactive)                    libfoo < 1.2.4" — answered in seconds, every time</code></pre>' +
      '<div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>A grocery store ingredient label vs. a sealed can with no label.</b> ' +
      'When a recall hits one ingredient, a store with labels on every product pulls the exact affected items off the shelf in minutes. A ' +
      'store with unlabeled cans has to test every can in the building, or pull everything, just in case.</p></div>',
      try: [
        ['📖 CISA — Software Bill of Materials (SBOM)', 'https://www.cisa.gov/sbom', 'o'],
        ['📖 Sigstore — supply-chain signing project', 'https://www.sigstore.dev/', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html:
      '<p>An <b>SBOM</b> (Software Bill of Materials, typically in <b>SPDX</b> or <b>CycloneDX</b> format) is a machine-readable ' +
      'manifest of every package, library, and version inside an image or artifact. <b>Image signing</b> cryptographically attests that ' +
      'an image is exactly what a trusted build pipeline produced, unmodified since:</p>' +
      '<pre><code># generate an SPDX SBOM for a container image with Syft\n' +
      '$ syft packages docker:myregistry.io/app:1.4.2 -o spdx-json > app-1.4.2.sbom.json\n\n' +
      '# scan the SBOM against a vulnerability database\n' +
      '$ grype sbom:app-1.4.2.sbom.json\n\n' +
      '# sign the image (keyless, via OIDC identity) and attach the SBOM as an attestation\n' +
      '$ cosign sign myregistry.io/app:1.4.2\n' +
      '$ cosign attest --predicate app-1.4.2.sbom.json --type spdx myregistry.io/app:1.4.2\n\n' +
      '# at deploy time, verify the signature AND policy before admitting the image\n' +
      '$ cosign verify --certificate-identity-regexp ".*@ci\\.mycorp\\.com" myregistry.io/app:1.4.2</code></pre>' +
      '<div class="standard"><span class="lbl">🔧 Standard</span><p>The standard toolchain is <b><code>Syft</code></b>/<b>Grype</b> ' +
      '(Anchore) or equivalent for SBOM generation and scanning, and <b><code>cosign</code></b> (part of the <b>Sigstore</b> project, ' +
      'using keyless signing via OIDC where possible) for signing and attestation, enforced by an admission controller ' +
      '(e.g. <b>Kyverno</b> or <b>Gatekeeper</b> in Kubernetes) that rejects unsigned or unattested images at deploy time.</p></div>',
      try: [
        ['📖 Sigstore — cosign documentation', 'https://docs.sigstore.dev/cosign/overview/', 'o'],
        ['📖 Anchore — Syft (SBOM tool)', 'https://github.com/anchore/syft', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html:
      '<div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>The SBOM that was generated, then never queried.</b> A team ' +
      'proudly reports "we generate an SBOM for every build" — but when a CVE drops, nobody can actually search across the SBOM archive ' +
      'because it is just JSON files sitting in a bucket. Fix: an SBOM is only useful if it feeds a queryable inventory (or vulnerability ' +
      'database join) — generation without an index is compliance theater that looks identical to the real thing in a slide deck.</p></div>' +
      '<div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>Enforcing signed images broke the emergency hotfix path.</b> ' +
      'An admission controller starts rejecting unsigned images fleet-wide, and the first real incident afterward is an on-call engineer ' +
      'unable to deploy a hand-built emergency patch image at 2am because it never went through the signing pipeline. Fix: define (in ' +
      'advance, not during the incident) a documented, logged break-glass path for emergency deploys — the alternative is engineers ' +
      'routing around the control entirely, which is worse than not having it.</p></div>' +
      '<p><b>CVE diffing is where SBOMs pay for themselves:</b> comparing two versions\' SBOMs shows exactly which dependencies changed ' +
      'in a release, turning "did this upgrade introduce a new vulnerable transitive dependency" into a diff, not an investigation.</p>',
      try: [
        ['📖 CycloneDX — SBOM standard', 'https://cyclonedx.org/', 'o'],
        ['🛡️ Ch 12 — vulnerability & patch-risk scoring at fleet scale', '#ch12', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html:
      '<pre><code>ANTI-PATTERN                              FIX\n' +
      'SBOM generated at build time and archived    Feed SBOMs into a queryable inventory/vulnerability database join —\n' +
      '  with no way to query across builds           an un-queryable SBOM is compliance theater, not a security control.\n' +
      'Signing enforced with no documented           Define a logged, audited break-glass deploy path in advance — or\n' +
      '  emergency/break-glass path                   engineers will route around the control during a real incident.\n' +
      'Trusting a base image\'s vendor-provided        Generate and verify your own SBOM on the final built artifact —\n' +
      '  SBOM without regenerating after your build    your build layer can add or change dependencies too.\n' +
      'Image signature checked at push time only     Verify signature AND attestation policy at DEPLOY/admission time —\n' +
      '                                             a signed-but-since-modified image must still be caught before running.\n' +
      'CVE response = re-scanning every image         Diff SBOMs between versions to see exactly which dependency changed —\n' +
      '  from scratch when a new CVE drops             turns "did we introduce this" into a lookup, not an investigation.\n' +
      'One SBOM format used inconsistently            Standardize on SPDX or CycloneDX org-wide so tooling and audits don\'t\n' +
      '  across teams (SPDX here, CycloneDX there)     need a translation layer between every pair of teams.</code></pre>' +
      '<p><b>The real test:</b> when the next critical CVE drops, can you produce the exact list of affected running images — not just ' +
      'built images sitting in a registry — in the time it takes to run one query?</p>',
      try: [
        ['📖 NTIA/CISA — minimum elements for an SBOM', 'https://www.cisa.gov/resources-tools/resources/minimum-elements-software-bill-materials-sbom', 'o'],
        ['🛡️ Ch 7 — security patching pipelines', '#ch7', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html:
      '<p>At expert level, supply-chain security is about closing the gap between "what we think is in our software" and "what is ' +
      'actually running" — and between "this image looks right" and "this image is provably, cryptographically the one our pipeline ' +
      'built". SBOMs answer the first; signing and attestation answer the second. Neither one, alone, is sufficient: a perfectly ' +
      'accurate SBOM for a tampered image is useless, and a validly signed image can still contain a vulnerable dependency the ' +
      'signature says nothing about.</p>' +
      '<p><b>🎯 Interview drill</b></p>' +
      '<pre><code>Q: What problem does an SBOM solve that image signing does not?\n' +
      'A: An SBOM answers "what is actually inside this image" (packages, libraries, versions) so you can\n' +
      '   quickly find every affected artifact when a CVE drops. Signing answers a different question —\n' +
      "   whether the image is unmodified since a trusted build — and says nothing about its contents.\n\n" +
      'Q: Why is generating an SBOM at build time not sufficient on its own?\n' +
      'A: It must feed a queryable inventory/vulnerability database join; an archive of unindexed SBOM JSON\n' +
      '   files is functionally useless during an actual incident when you need answers in minutes.\n\n' +
      'Q: An admission controller starts enforcing "only signed images may deploy." What must exist alongside\n' +
      '   this control before it goes live?\n' +
      'A: A documented, logged break-glass path for emergency deploys — without one, an on-call engineer\n' +
      "   during a real incident will be blocked or will route around the control entirely.\n\n" +
      'Q: Should you trust a base image\'s vendor-provided SBOM as sufficient for your own deployed artifact?\n' +
      'A: No — you should generate and verify your own SBOM against the final built image, since your build\n' +
      '   process can add, change, or pin dependencies the base image\'s SBOM never accounted for.\n\n' +
      'Q: How does SBOM diffing accelerate incident response compared to re-scanning from scratch?\n' +
      'A: Diffing SBOMs between two versions shows exactly which dependencies changed in a release, turning\n' +
      '   "did this upgrade introduce a vulnerable transitive dependency" into a direct lookup instead of a\n' +
      '   full re-investigation of the whole dependency tree.</code></pre>',
      try: [
        ['📖 SLSA — supply-chain levels for software artifacts', 'https://slsa.dev/', 'o'],
        ['🛡️ Ch 6 — secrets management at scale', '#ch6', 'o']
      ] }
  ],

  quiz: [
    { q: 'What problem does an SBOM solve that image signing does not address?',
      opts: [
        'Whether the image was built by a trusted pipeline',
        'What packages, libraries, and versions are actually inside an image — critical for quickly locating affected artifacts when a CVE drops',
        'Whether the image has been tampered with since it was built',
        'The network policy an image is allowed to use at runtime'],
      ok: 1,
      why: 'An SBOM is a contents manifest; it answers "what is in here," which signing (an integrity/provenance guarantee) does not.' },
    { q: 'Why is generating an SBOM for every build insufficient on its own, without further infrastructure?',
      opts: [
        'SBOMs are only valid for 24 hours after generation',
        'The SBOMs must feed a queryable inventory or vulnerability-database join; an archive of unindexed files cannot answer "which images are affected" quickly during an incident',
        'SBOM generation tools like Syft do not produce valid output',
        'SBOMs cannot be generated for container images, only for source code'],
      ok: 1,
      why: 'The value of an SBOM comes from being able to query it at scale during a CVE response; without an index or database, it is compliance theater.' },
    { q: 'Before enforcing "only signed images may deploy" via an admission controller, what must be established?',
      opts: [
        'Nothing extra — the control is safe to enable immediately fleet-wide',
        'A documented, logged break-glass deploy path for emergencies, so on-call engineers are not blocked or forced to route around the control during an incident',
        'All existing running images must be deleted first',
        'The signing keys must be shared with every engineer on the team'],
      ok: 1,
      why: 'Without a pre-defined emergency path, a real incident will either be blocked by the control or engineers will bypass it entirely, defeating its purpose.' }
  ]
};
