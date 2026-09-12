# log-pipeline — Splunk-style ingestion, indexing & retention

Matches learn5 Ch 2 (centralized logging at scale) and Ch 3 (log pipeline
architecture: ingestion, indexing & retention).

## Files

- **`indexes.conf`** — three indexes (`infra_logs`, `audit_logs`,
  `debug_logs`) with three different retention periods, demonstrating the
  Ch 3 principle that retention is a compliance-vs-cost decision made per
  log type, not one fleet-wide number.
- **`props.conf`** — sourcetype parsing rules with deliberately lean
  index-time field extraction (timestamp/host/severity only), leaving
  richer fields to search-time extraction, per Ch 2's index-time-vs-
  search-time tradeoff.
- **`inputs.conf`** — forwarder monitor stanzas, including a
  self-monitoring stanza for the forwarder's own internal metrics log —
  the fix for Ch 2 Scenario A ("logs stopped flowing from rack 12"),
  where an unmonitored forwarder queue filling up looks identical to
  "nothing bad happened."
- **`kafka-topic-config.json`** — the durable buffer (Ch 3) sitting
  between forwarders and the Splunk indexing tier, sized to survive a
  24-hour indexer outage without dropping events, with a consumer-lag
  alert threshold so a silently-falling-behind buffer is caught before
  its retention window runs out.

## Try it

```bash
# validate JSON
python3 -m json.tool kafka-topic-config.json > /dev/null && echo "valid JSON"

# .conf files are Splunk's own INI-like format — validate structurally
# with Python's configparser (also how this repo's CI could extend
# coverage if it added a .conf linter):
python3 -c "
import configparser
for f in ['indexes.conf', 'props.conf', 'inputs.conf']:
    c = configparser.ConfigParser(strict=False)
    c.read(f)
    print(f, '->', c.sections())
"
```

## Why this shape

A single retention number and a single sourcetype for everything is the
Ch 2/Ch 3 anti-pattern this lab is built to avoid: `audit_logs` needs a
year for compliance, `debug_logs` needs a week because nobody queries it
past that, and the Kafka buffer exists specifically so an indexer
maintenance window (or outage) does not silently create a permanent gap
in searchable history.
