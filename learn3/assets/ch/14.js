/* linux-hpc-security Learn — Part 3 · Chapter 14: Cluster Capacity Planning & TCO */
window.CH[14] = {
  levels: [
    /* ---------- L1 · Amateur ---------- */
    { html: `
      <p>Every cluster eventually needs a refresh — the current hardware ages out, demand outgrows capacity, or a new GPU generation makes
      the old fleet look expensive to keep running. <b>Capacity planning</b> is deciding how much of what to buy next, grounded in real
      utilization data (Chapter 13) rather than guesswork, and <b>TCO</b> (Total Cost of Ownership) is the honest accounting that a
      cluster's real cost is never just the sticker price of the hardware — power, cooling, floor space, and staff time all belong in the
      number a budget committee actually needs to see.</p>
      <pre><code>Naive cost:  "the new GPU rack costs $2M"
      TCO:         $2M hardware + power (kW × $/kWh × years) + cooling + floor space + admin staff time</code></pre>
      <div class="analogy"><span class="lbl">🎯 Analogy</span><p><b>Buying a car vs. owning a car.</b> The sticker price is what you pay
      once; owning it also means gas, insurance, maintenance, and parking for years afterward. Comparing two clusters (or a cluster vs.
      cloud bursting) by hardware price alone is like comparing cars by sticker price alone — the cheaper-looking option can easily be the
      more expensive one once you account for everything that keeps it running.</p></div>`,
      try: [
        ['📖 TOP500 — HPC Procurement Resources', 'https://www.top500.org/', 'o'],
        ['🖥️ Ch 13 — HPC monitoring & telemetry', '#ch13', 'o']
      ] },

    /* ---------- L2 · Beginner ---------- */
    { html: `
      <p>Capacity planning starts from the same accounting and telemetry data covered in Chapters 11 and 13 — real utilization trends, not
      anecdote — and TCO modeling puts every ongoing cost on the same footing as the purchase price:</p>
      <pre><code># pull 12 months of utilization trend from Slurm accounting to ground the sizing decision
$ sreport cluster utilization start=2025-09-01 end=2026-09-01 -t percent

# a simple TCO sketch for a 3-year refresh horizon (illustrative, not exhaustive)
Hardware (upfront):        $2,000,000
Power: 400kW x $0.12/kWh x 24 x 365 x 3 years  =  $1,261,440
Cooling (~40% of power draw, typical PUE overhead)  =  $504,576
Floor space + rack/PDU infra                        =  $150,000
Admin/ops staff time (fractional FTE over 3 years)  =  $300,000
-----------------------------------------------------------------
3-year TCO:                                          ~$4,216,016   (vs. $2M sticker price)</code></pre>
      <div class="standard"><span class="lbl">🔧 Standard</span><p>The standard input metric is <b>utilization-weighted demand</b> —
      not raw node-hours requested, but node-hours actually used at meaningful efficiency (Chapter 13's <code>seff</code> data), since
      sizing a refresh against inflated, low-efficiency demand just buys more hardware to be used just as inefficiently. <b>PUE</b> (Power
      Usage Effectiveness — total facility power ÷ IT equipment power) is the standard datacenter-efficiency metric that turns "power cost"
      into a comparable number across sites.</p></div>`,
      try: [
        ['📖 Slurm — sreport Utilization Reports', 'https://slurm.schedmd.com/sreport.html', 'o'],
        ['📖 The Green Grid — PUE (Power Usage Effectiveness)', 'https://www.thegreengrid.org/', 'o']
      ] },

    /* ---------- L3 · Builder ---------- */
    { html: `
      <div class="reallife"><span class="lbl">🏭 Scenario A</span><p><b>A utilization-driven capacity-planning model.</b> A site's queue
      wait times have crept up over a year, and the obvious ask is "buy more nodes." But pulling actual <code>sreport</code> utilization
      data shows the real problem is concentrated in one partition (GPU) at specific hours (business-day daytime), while the CPU partition
      runs at 60% most of the time — the right purchase is more GPU capacity and better time-of-day scheduling policy (Chapter 8), not a
      proportional fleet-wide expansion that would leave the CPU partition even more underutilized than it already is.</p></div>
      <div class="reallife"><span class="lbl">🏭 Scenario B</span><p><b>A build-vs-cloud-burst TCO comparison.</b> Facing a capacity
      shortfall, a site compares buying 20 more on-prem GPU nodes against relying more heavily on cloud bursting (Chapter 12) for peak
      demand. The on-prem TCO model amortizes purchase + power + cooling + staff time over a 5-year hardware lifetime; the cloud model
      totals expected burst node-hours (from historical peak patterns) times cloud GPU-hour pricing. Because their historical peak usage is
      short and infrequent (grant-deadline-driven, a few weeks a year), cloud bursting wins on pure TCO — but the team also weighs the
      data-gravity latency cost (Chapter 12) that a pure dollar comparison misses, since some of their burst-eligible workloads simply
      don't burst well regardless of price.</p></div>
      <p><b>Justifying a GPU refresh to a budget committee</b> means translating utilization and efficiency data into their language:
      "our current GPUs ran at 78% average utilization for 11 of the last 12 months, and per-job efficiency data shows the demand is real
      work, not waste — at current growth we'll hit queue-wait SLA breach in 4 months without additional capacity" is a fundable argument;
      "we want newer GPUs" is not.</p>`,
      try: [
        ['📖 NVIDIA — Data Center GPU TCO Considerations', 'https://www.nvidia.com/en-us/data-center/', 'o'],
        ['🖥️ Ch 12 — burst-to-cloud HPC', '#ch12', 'o']
      ] },

    /* ---------- L4 · Advanced ---------- */
    { html: `
      <pre><code>ANTI-PATTERN                              FIX
Sizing a refresh off raw node-hours         Use utilization-weighted, efficiency-adjusted demand
requested, ignoring per-job efficiency     (Chapter 13) — inflated low-efficiency demand shouldn't
                                             drive proportional hardware growth.
Comparing hardware purchase price only,     Model full TCO: power (with PUE), cooling, floor space,
ignoring power/cooling/staff TCO            and staff time over the hardware's real service lifetime.
Proportional fleet-wide expansion when      Partition-level utilization data often shows the shortfall
the bottleneck is one partition             concentrated in one resource class (e.g. GPU) — buy where
                                             the actual demand is, not evenly across everything.
Treating cloud-burst-vs-buy as purely a     Data-gravity latency (Chapter 12) and workload fit matter
dollar comparison                           alongside pure TCO — cheaper on paper isn't cheaper if the
                                             workload doesn't burst well at all.
No sensitivity analysis on power/energy     Energy price volatility over a 3-5 year TCO horizon can
price assumptions                           swing the total materially — model a range, not one point
                                             estimate, for any multi-year cost projection.
Presenting a refresh ask as "we want        Budget committees fund SLA-breach risk and demonstrated real
newer hardware" without quantified need     utilization trends, not hardware enthusiasm — lead with the
                                             data (Chapter 13), not the wish list.</code></pre>
      <p><b>The real test:</b> can your capacity-planning request survive someone asking "show me the utilization data behind this number"
      — or does the sizing rationale collapse into "it felt like we needed more"?</p>`,
      try: [
        ['📖 Slurm — Long-Term Accounting Data Retention', 'https://slurm.schedmd.com/accounting.html', 'o'],
        ['🖥️ Ch 11 — multi-tenancy, accounting & fairshare at scale', '#ch11', 'o']
      ] },

    /* ---------- L5 · Expert ---------- */
    { html: `
      <p>At expert level, capacity planning and TCO modeling are how everything else in this part — accounting (Chapter 11), telemetry
      (Chapter 13), burst economics (Chapter 12) — converges into a single forward-looking financial decision, and the quality of that
      decision is bounded entirely by the quality of the data feeding it. A site with rigorous accounting and telemetry can make a
      defensible, quantified refresh case; a site without it is reduced to guessing, no matter how sophisticated its TCO spreadsheet looks,
      because a spreadsheet built on inflated or absent utilization data just produces a precisely wrong number.</p>
      <p><b>🎯 Interview drill</b></p>
      <pre><code>Q: Why should capacity planning use utilization-weighted, efficiency-adjusted demand rather than raw
   requested node-hours?
A: Raw requested node-hours reflect what users asked for, which Chapter 13 shows can be wildly inflated
   relative to actual use (a job requesting 64 cores at 15% efficiency). Sizing a refresh against
   inflated demand just buys more hardware to be used just as inefficiently — efficiency-adjusted demand
   reflects real need.

Q: Why is comparing two clusters (or cloud vs. on-prem) by hardware sticker price alone misleading?
A: Sticker price omits power, cooling (weighted by PUE), floor space, and staff time — all recurring
   costs over the hardware's service lifetime that can exceed the purchase price itself. A full TCO
   model puts every ongoing cost on the same footing as the upfront price.

Q: A site's queue wait times are rising. Why might the right response be targeted GPU purchases rather
   than a proportional fleet-wide expansion?
A: Partition-level utilization data (not aggregate) often reveals the bottleneck is concentrated in one
   resource class and time window, not the whole fleet. Buying proportionally across a fleet where most
   partitions have headroom wastes capital on capacity that isn't actually constrained.

Q: Why can cloud bursting win a pure TCO comparison against buying more on-prem hardware, yet still be
   the wrong choice for some workloads?
A: TCO comparisons capture dollar cost but not data-gravity latency or fabric-performance mismatches
   (Chapter 12) — some workloads simply don't burst well regardless of price, so the decision needs both
   the cost model and a workload-fit assessment, not cost alone.

Q: What makes a capacity-planning request to a budget committee fundable versus not?
A: Grounding it in quantified utilization/efficiency trends and a concrete risk (e.g. projected SLA
   breach by a specific date) rather than a qualitative preference for newer hardware. "Show me the data
   behind this number" should have a real, specific answer.</code></pre>`,
      try: [
        ['📖 TOP500 — Historical Capacity/Efficiency Trends', 'https://www.top500.org/statistics/list/', 'o'],
        ['🖥️ Ch 16 — the production HPC cluster reference architecture', '#ch16', 'o']
      ] }
  ],

  quiz: [
    { q: 'Why should capacity planning be grounded in utilization-weighted, efficiency-adjusted demand rather than raw requested node-hours?',
      opts: [
        'Raw requested node-hours are always identical to actual usage',
        'Requested node-hours can be wildly inflated relative to actual efficient use, so sizing against them just buys more hardware to be used just as inefficiently',
        'Efficiency data is not available in Slurm accounting',
        'Node-hours have no relationship to hardware sizing decisions'],
      ok: 1,
      why: 'Chapter 13\'s efficiency telemetry reveals the gap between requested and actually-used resources; sizing off inflated demand perpetuates inefficiency rather than fixing it.' },
    { q: 'Why is comparing two hardware options by purchase price alone considered misleading in HPC capacity planning?',
      opts: [
        'Purchase price is the only cost that matters over a hardware lifetime',
        'It omits recurring costs like power (weighted by PUE), cooling, floor space, and staff time, which can exceed the purchase price over the service lifetime',
        'Power and cooling costs are always negligible compared to hardware cost',
        'TCO only applies to cloud computing, never to on-prem hardware'],
      ok: 1,
      why: 'A full Total Cost of Ownership model includes every recurring cost alongside the upfront price, since those recurring costs compound over a multi-year service lifetime.' },
    { q: 'A site\'s queue wait times are rising cluster-wide. Utilization data shows the bottleneck is concentrated in the GPU partition specifically. What is the appropriate response?',
      opts: [
        'Expand every partition proportionally regardless of where demand is concentrated',
        'Target the purchase toward the GPU partition where actual demand is constrained, informed by partition-level utilization data',
        'Ignore the data and expand based on overall cluster age',
        'Reduce the CPU partition to fund an unrelated GPU purchase with no data justification'],
      ok: 1,
      why: 'Partition-level (not just aggregate) utilization data shows where the real bottleneck is; capital should go where demand is actually constrained, not spread evenly across underutilized and overutilized resources alike.' }
  ]
};
