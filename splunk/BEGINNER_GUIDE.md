# Splunk & SIEM — The Amateur's Guide

> SQL asks a table a question. SPL walks a conveyor belt of events, and
> each station (command) reshapes what is on the belt before the next
> one sees it.

---

## 1. What a SIEM is

**Security Information and Event Management**: ingest logs from
everywhere, normalize them, retain them, and search + correlate across
them. **Splunk** is the archetype (competitors: Elastic Security, Sentinel,
QRadar, Chronicle, Devo). The query language is **SPL**.

The other jobs a SIEM does: **correlation** (turn many events into one
alert), **dashboards**, **compliance retention**, and **investigation**
(pivot from an IOC to everywhere it appears).

---

## 2. SPL is a pipeline

An implicit `search` up front, then commands joined by `|`, each
transforming the event stream:

```
index=web sourcetype=access_combined status>=500
| stats count by host, uri
| sort -count
| head 20
```

Read it left to right: *find* the events, *aggregate* them, *order*,
*limit*. (Lab: `step1_spl_pipeline.py` implements the core verbs.)

The verbs you use every day:

| Command | Does |
|---|---|
| `search` | filter events by `field=value` (wildcards, `!=`, `OR`, comparisons) |
| `where` | filter by an expression (`where bytes > 3*avg`) |
| `eval` | compute a new field (`eval kb = bytes/1024`) |
| `rename` | `rename src_ip as attacker_ip` |
| `stats` | aggregate: `count`, `sum(x)`, `avg(x)`, `dc(x)` (distinct count), `values(x)`, `by` groups |
| `sort` | `sort -count` (descending), `sort +_time` |
| `head` / `tail` | first / last N |
| `table` / `fields` | choose columns |
| `dedup` | first event per key |
| `lookup` | join an external table (enrichment) |
| `rex` | regex field extraction inline |
| `bin` / `bucket` | group `_time` into spans (`bin _time span=10m`) |

---

## 3. Where the data lives

- **Index** — a physical store with its own retention and access
  control: `index=security`, `index=web`, `index=firewall`. **Always
  scope with `index=`** — a bare search scans everything and is why
  "Splunk is slow".
- **Sourcetype** — tags the format (`access_combined`,
  `WinEventLog:Security`, `aws:cloudtrail`) and drives field extraction.
- **Search-time vs index-time extraction** — Splunk extracts fields at
  *search* time by default: cheap ingest, flexible schema, "schema on
  read". Index-time is faster to query but rigid.
- Every search needs a **time range** — a tight one. "All time" over a
  busy index is a self-inflicted outage.

---

## 4. The stats family (the #1 confusion)

```
stats       collapse the pipeline to ONE row per group (the events are gone)
eventstats  same aggregate, ADDED as a column to EVERY event (rows kept)
streamstats a RUNNING aggregate in event order (cumsum, moving count, "time since")
```

- `stats sum(bytes) by user` → one row per user, a summary table.
- `eventstats avg(bytes) by user` → every event keeps its fields **plus**
  `avg(bytes)` for its user, so `| where bytes > 3*avg` finds each
  user's own outliers.
- `streamstats count by src` → the running count so far, in time order —
  how you say "the 6th failure within 10 minutes" without a subsearch.

(Lab: `step2_stats_family.py` shows all three on one dataset.)

---

## 5. Data models and CIM — write a detection once

The **Common Information Model (CIM)** maps every sourcetype's fields to
a shared schema: `Authentication.user`, `Authentication.action`,
`Network_Traffic.dest_ip`, `Endpoint.Processes.process_name`.

Write a "brute force" detection once against
`Authentication.action=failure` and it fires on failed logins from
**AD, Okta, sshd, and the VPN concentrator** — because CIM normalized
them all to the same field.

**Accelerated data models** + `tstats` query pre-summarized data —
orders of magnitude faster than raw `stats`, and how Enterprise Security
dashboards stay usable. **Summary indexing** rolls expensive daily
aggregates into a small index you query cheaply.

---

## 6. Correlation searches → notable events

A **correlation search** runs on a schedule over a sliding window and
creates a **notable event** when a threshold trips:

```
| tstats count from datamodel=Authentication where Authentication.action=failure by _time span=10m, Authentication.user
| where count > 5
| ... create notable, severity=high ...
```

Two things separate a real rule from a naive one:

- **Throttling / suppression** — at most one notable per entity per
  window, or one brute-force campaign becomes 200 notables.
- **Risk-Based Alerting (RBA)** — instead of one rule = one alert, each
  rule adds a **risk score** to an entity (user/host). A notable fires
  only when that entity's **summed risk over 24h** crosses a threshold.
  Cuts alert volume ~10× and every alert is a story, not one weak
  signal.

(Lab: `step3_correlation_notable.py`.)

---

## 7. Operating it

- **License / ingest** — you pay per GB/day (or by workload). Watch
  `index=_internal source=*license_usage.log`. Route noisy low-value
  logs to a cheaper tier or filter at ingest.
- **Skipped searches** — `index=_internal ... SavedSplunker` — if the
  scheduler is oversubscribed, correlation searches silently skip and
  you have blind windows.
- **RBAC on indexes** — analysts see `index=security` but not HR logs.
- **Deployment** at scale: universal **forwarders** on endpoints →
  **indexers** (store + search) → **search heads** (the UI, clustered),
  with a **deployment server** pushing configs and a **cluster master**.

---

## 8. Run the labs

```bash
python3 splunk/step1_spl_pipeline.py         # a mini SPL executor
python3 splunk/step2_stats_family.py         # stats vs eventstats vs streamstats vs lookup
python3 splunk/step3_correlation_notable.py  # correlation search + throttling + RBA
```

Next: **`chaos/`** — and the alerting these dashboards drive had better
fire when you break something on purpose.
