# Splunk & SIEM — Deep Dive: Production Scenarios

---

## Scenario 1 — "Splunk is slow" tickets every day

**Symptom.** Analysts complain searches take minutes or time out.
`index=_audit` shows lots of long-running searches with `search *` and
`All time`.

**Fixes, in order of impact.**
1. **Scope every search:** `index=`, `sourcetype=`, and a tight time
   range. A dashboard panel that defaults to "All time" over a 2 TB/day
   index is the #1 cause.
2. **Filter early:** put the most selective terms in the *first*
   `search`, before any `| stats`. `index=web status=500` then stats,
   not `index=web | stats ... | where status=500`.
3. **Use `tstats` + accelerated data models** for dashboards and
   correlation searches — 10–100× faster because it reads
   pre-summarized tsidx, not raw events.
4. **Avoid `join` and subsearches** where possible — subsearches are
   capped (default 10k rows, 60s) and silently truncate. Use `stats` or
   a `lookup` instead.
5. **Summary indexing** for recurring heavy aggregations (daily
   rollups).
6. Check **search concurrency limits** and indexer CPU — you may be
   compute-bound, not query-bound.

**`join` → `stats` rewrite:**
```
# slow (subsearch, truncates):
index=web | join user [ search index=hr | fields user, department ]
# fast:
index=web OR index=hr | stats values(department) as dept, count(eval(index="web")) as hits by user
```

---

## Scenario 2 — A correlation search stopped firing and nobody noticed

**Symptom.** During an incident review, a brute-force notable that
"should have fired" never did. The rule is enabled and looks correct.

**Diagnosis.**
```
index=_internal sourcetype=scheduler status=skipped savedsearch_name="Brute Force*"
| stats count by _time
```
The scheduler was **oversubscribed** — too many correlation searches on
the same cron minute, exceeding the search-head concurrency limit, so
this one skipped ~40% of its runs, leaving blind windows.

Also check:
- The data model it queries wasn't **accelerating** (backfill fell
  behind after an outage) → `tstats` returned partial data.
- A `sourcetype` rename upstream broke the field extraction the rule
  depends on → `count` was always 0.
- The lookup it enriches from was stale/empty.

**Fixes.** Stagger cron schedules (`cron_schedule` with spread minutes),
raise concurrency or move heavy searches to a dedicated search head,
alert on `status=skipped` for any correlation search, and add a
**canary**: a scheduled search that injects a known test event and
verifies the notable appears.

---

## Scenario 3 — Alert volume is unmanageable; move to RBA

**Before.** 34 correlation searches, ~600 notables/day, ~2% true
positive. For one compromised user in a day: separate notables for
`brute_force`, `new_admin_role`, `impossible_travel`, `mfa_fatigue`,
`mass_download` — 5 disconnected low-confidence pings.

**After — Risk-Based Alerting.**
```
# each detection becomes a "risk rule" that writes to the risk index
... your detection logic ...
| eval risk_score = 40, risk_object = user, risk_object_type = "user",
       risk_message = "Impossible travel for " . user
| collect index=risk

# ONE correlation search over the risk index:
| tstats sum(All_Risk.calculated_risk_score) as risk from datamodel=Risk
    where earliest=-24h by All_Risk.risk_object
| where risk > 100
| ... create notable: "user X accumulated <risk> in 24h across N rules" ...
```

**Result:** ~600 → ~40 notables/day, and each one is a narrative that
crossed a bar. Analysts get "alice: 340 risk in 6h from 5 rule types"
instead of 5 separate "maybe nothing" alerts. (Lab:
`step3_correlation_notable.py`.)

---

## Scenario 4 — CIM normalization saves the detection backlog

**Situation.** You need "brute force" detection for AD, Okta, Duo,
sshd, VPN, and a custom app. Naively that's 6 rules to write and
maintain.

**With CIM.** Add each sourcetype's field mapping to the
**Authentication** data model (via props/transforms or an add-on):
```
Okta:   outcome.result=FAILURE   -> Authentication.action=failure
sshd:   "Failed password"        -> Authentication.action=failure
VPN:    Reason-Code=... denied   -> Authentication.action=failure
```
Then **one** rule:
```
| tstats count from datamodel=Authentication
    where Authentication.action=failure by Authentication.user, Authentication.src, _time span=5m
| where count > 8
```
fires across all six sources. New source next quarter? Map its fields,
zero rule changes.

---

## Scenario 5 — Ingest cost blew the budget

**Symptom.** Monthly Splunk bill up 60%. `license_usage.log` shows one
sourcetype (`verbose_app_debug`) is 45% of ingest.

**Levers.**
- **Filter at ingest** (`props.conf` / `transforms.conf` `nullQueue`):
  drop debug lines, health-check noise, and fields you never search.
- **Route** high-volume low-value data to a cheaper store (Splunk
  Edge/S3, or a separate low-cost index with short retention) and only
  index a sampled or summarized stream.
- **Trim at the source**: does the app need to log every 200 OK with
  full headers?
- **Workload pricing / SVC** instead of ingest pricing if your ratio of
  search to ingest is high.
- **Retention**: `frozenTimePeriodInSecs` per index — security may need
  1 year, app debug 7 days.

Track `dailyvolume` per index/sourcetype on a dashboard so this is
caught in week 1, not on the invoice.

---

## SPL patterns worth memorizing

```
# top N with a percentage
index=web | top limit=10 uri showperc=t

# rare / first-seen
index=proc | stats earliest(_time) as first_seen count by process, host
| where first_seen > relative_time(now(), "-1d")

# sessionize / time between events per key
index=auth | sort 0 user _time
| streamstats current=f last(_time) as prev by user
| eval gap = _time - prev

# outliers vs the group
index=net | eventstats avg(bytes) as a stdev(bytes) as s by src
| where bytes > a + 3*s

# sliding-window threshold (correlation core)
index=auth action=failure | bin _time span=10m
| stats count by _time, user | where count > 5
```
