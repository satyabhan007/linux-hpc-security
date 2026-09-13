# postmortem — blameless postmortem template + burn-rate alert example

Matches learn5 Ch 14 (postmortems for infrastructure incidents), Ch 7
(SLOs & error budgets), and Ch 8 (alerting design).

## Files

- **`TEMPLATE.md`** — a blameless postmortem template: summary, impact,
  timeline (built from timestamps, not memory), 5-whys root cause,
  what-went-well/poorly, and an action-items table requiring a named
  owner and due date per row, per Ch 14's "an action item with neither is
  a wish, not a commitment." Each action item has a "Links to" column
  pointing at the specific lab/chapter the fix lands in, per the Ch 16
  closed-loop principle.
- **`burn_rate_alert.yml`** — the same multi-window burn-rate alert rules
  as `../observability/alerts.rules.yml`, annotated for postmortem use so
  an author can cite exactly which rule should have paged (and reason
  about it if it didn't) without cross-referencing another directory.

## Try it

```bash
yamllint -d "{extends: relaxed, rules: {line-length: disable, truthy: disable}}" burn_rate_alert.yml
```

## Why this shape

Per Ch 14, L5: "the postmortem is an organizational learning mechanism,
and its real output is not the document — it is the set of action items
that actually get closed." The template is built around that: every
section exists to produce a specific, owned, dated action item, not just
a narrative account of what happened.
