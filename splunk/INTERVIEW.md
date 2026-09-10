# Splunk & SIEM — Interview Q&A

---

## SPL basics

**Q: What is SPL structurally?**
A pipeline: an implicit `search` for retrieval, then commands joined by
`|`, each transforming the event stream left to right.

**Q: `search` vs `where`?**
`search` filters events by field=value (indexed, fast, wildcards, `OR`);
`where` filters by a full expression evaluated per event
(`where a > 2*b`, functions, field-to-field comparison). Put selective
`search` terms first.

**Q: `stats` vs `eventstats` vs `streamstats`?**
`stats` collapses to one row per group (events discarded). `eventstats`
computes the same aggregate but appends it as a column to every event
(rows kept — for comparing each event to its group). `streamstats`
computes a running aggregate in event order (cumulative sum, moving
count, time-since-last).

**Q: `stats` vs `chart` vs `timechart`?**
`stats` = tabular aggregation. `chart` = aggregation with a `by`
split-by field becoming columns (for a 2D matrix / bar chart).
`timechart` = `chart` with `_time` as the x-axis (auto-binned).

**Q: What does `dc()` do? `values()` vs `list()`?**
`dc(x)` = distinct count. `values(x)` = the sorted set of unique values.
`list(x)` = all values in order (with duplicates), capped at 100.

**Q: Why avoid `join` and subsearches?**
Subsearches run first, are capped (~10k results / 60s by default) and
**silently truncate** — giving wrong answers on large data. Prefer
`stats` (with `eval` inside aggregates) or `lookup`.

**Q: `rex` vs `extract` vs an inline `eval`?**
`rex field=_raw "..."` = ad-hoc regex extraction in the search. Field
extractions in `props.conf`/`transforms.conf` = reusable, defined once.
`eval` = compute from existing fields.

**Q: How do you compute "5 events within 10 minutes per user"?**
`bin _time span=10m | stats count by _time,user | where count>=5`, or
`streamstats` with a time-window (`streamstats time_window=10m count by
user | where count>=5`).

---

## Data architecture

**Q: What is an index in Splunk?**
A physical data store with its own retention (`frozenTimePeriodInSecs`),
sizing, and access control. Always scope searches with `index=`.

**Q: What is a sourcetype?**
A label for the data format that drives field extraction, line breaking,
and timestamp parsing (`access_combined`, `WinEventLog:Security`,
`aws:cloudtrail`).

**Q: Search-time vs index-time field extraction?**
Splunk defaults to search-time ("schema on read"): raw events stored,
fields extracted per search — cheap ingest, flexible. Index-time
extraction bakes fields in at ingest: faster query, rigid, more storage.

**Q: Explain the components of a distributed Splunk deployment.**
Universal/heavy **forwarders** collect and forward; **indexers**
(often clustered for replication) store and search data; **search
heads** (clustered) run the UI and dispatch searches to indexers; a
**deployment server** pushes app/config; a **cluster manager** and
**SHC deployer** manage the clusters; a **license manager** meters
ingest.

**Q: What is bucket lifecycle (hot/warm/cold/frozen)?**
Hot = actively written; warm = rolled, still searchable, local; cold =
older, often cheaper storage; frozen = past retention — deleted or
archived. Governed by size and time settings per index.

---

## Data models, CIM, acceleration

**Q: What is the CIM?**
Common Information Model — a set of normalized field names/data models
(Authentication, Network_Traffic, Endpoint, Web, …) so detections
written against the model work across every source mapped to it.

**Q: Why does CIM matter for detection engineering?**
Write one rule against `Authentication.action=failure` and it covers AD,
Okta, sshd, VPN — instead of one rule per log type. New source ⇒ map its
fields, no rule changes.

**Q: What is `tstats` and why is it fast?**
It queries the indexed `.tsidx` files and accelerated data model
summaries directly, not raw events — orders of magnitude faster, used
for dashboards and correlation searches. Constraint: only indexed/
accelerated fields.

**Q: Accelerated data model vs summary indexing?**
Accelerated DM: Splunk maintains rolling summaries of a data model,
queried via `tstats`. Summary indexing: you schedule a search that
writes aggregated results into a normal index you query cheaply later.
Both trade storage/compute for fast recurring queries.

---

## Detection / ES

**Q: What is a correlation search?**
A scheduled search over a sliding window that creates a **notable
event** when a condition trips — the building block of Enterprise
Security detections.

**Q: What is a notable event?**
The alert/case object ES creates from a correlation search: severity,
status, owner, drill-down search, associated risk — the SOC's
case-management unit.

**Q: Why throttle a correlation search?**
Without suppression (e.g. one notable per `risk_object` per hour), a
single campaign (a brute force with hundreds of failures) generates
hundreds of notables and buries the analyst.

**Q: Explain Risk-Based Alerting (RBA).**
Each detection writes a **risk score** to an entity (user/host) in the
risk index/data model instead of firing its own alert. One correlation
search sums risk per entity over a window and creates a notable only
when it crosses a threshold. ~10× fewer alerts, each a multi-signal
story.

**Q: What are "risk factors" / risk modifiers in RBA?**
Multipliers on the base risk score based on context — e.g. ×2 if the
asset is a domain controller, ×1.5 if the user is a privileged account,
×0 to suppress known-good. They shape which entities cross the threshold.

**Q: What is `| collect` used for?**
Writes the current search results into a target index (e.g. summary
indexing, or writing risk events to `index=risk`).

---

## Operations

**Q: How is Splunk licensed and what do you watch?**
Historically per-GB/day ingest; also workload (SVC) and infrastructure
pricing. Watch `index=_internal source=*license_usage.log` and
per-index daily volume; filter/route noisy low-value sourcetypes.

**Q: A correlation search "isn't firing" — troubleshooting steps?**
Check `index=_internal sourcetype=scheduler status=skipped` (scheduler
oversubscribed), verify the data model is accelerating and backfilled,
confirm the field extraction/CIM mapping still works (upstream
sourcetype rename), check the enrichment lookup isn't empty, and run the
search manually over the window.

**Q: How do you make sure detections keep working?**
A canary: a scheduled job that injects a known test event and alerts if
the corresponding notable doesn't appear. Plus alerting on any
correlation search with `status=skipped`.

**Q: Splunk SPL vs Microsoft KQL vs Elastic — conceptually the same?**
Yes — all are pipe/stage query languages over event data with
filter → transform → aggregate → present. KQL: `|` stages,
`summarize ... by`. Elastic: ES|QL is similar; older EQL is
sequence-oriented for behavioral detections. Sigma abstracts detection
logic across all of them.
