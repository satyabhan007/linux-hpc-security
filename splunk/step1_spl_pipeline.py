#!/usr/bin/env python3
"""
Splunk · Step 1 — a mini SPL pipeline executor.

SPL is a stream of commands joined by `|`. The first is an implicit
`search`; each subsequent command transforms the pipeline of events.
This implements the core verbs you use every day:

    search k=v ...        keep events matching all k=v (=, !=, wildcard *)
    where <expr>          keep events where a Python-ish expr is truthy
    eval field=<expr>     add/replace a field
    rename a as b         rename a field
    stats <aggs> by <f>   collapse to one row per group  (count, sum(x), avg(x), dc(x), values(x))
    sort [-]field[,...]   order rows (leading - = descending)
    head N / tail N       first / last N rows
    table f1 f2 ...       project columns

Then it runs a few real queries over a small web-access dataset.
"""
import fnmatch
import re
import statistics as st

EVENTS = [
    {"host": "web01", "status": 200, "bytes": 512,  "uri": "/",         "user": "-",     "method": "GET"},
    {"host": "web01", "status": 200, "bytes": 1841, "uri": "/app",      "user": "alice", "method": "GET"},
    {"host": "web02", "status": 404, "bytes": 209,  "uri": "/x.php",    "user": "-",     "method": "GET"},
    {"host": "web02", "status": 500, "bytes": 0,    "uri": "/app/pay",  "user": "bob",   "method": "POST"},
    {"host": "web01", "status": 200, "bytes": 990,  "uri": "/app",      "user": "bob",   "method": "GET"},
    {"host": "web03", "status": 403, "bytes": 118,  "uri": "/admin",    "user": "mallory","method": "GET"},
    {"host": "web02", "status": 500, "bytes": 0,    "uri": "/app/pay",  "user": "alice", "method": "POST"},
    {"host": "web01", "status": 301, "bytes": 0,    "uri": "/old",      "user": "-",     "method": "GET"},
    {"host": "web03", "status": 200, "bytes": 4211, "uri": "/app/rpt",  "user": "alice", "method": "GET"},
    {"host": "web02", "status": 404, "bytes": 190,  "uri": "/y.php",    "user": "-",     "method": "GET"},
]

AGG = {
    "count":  lambda rows, f=None: len(rows),
    "sum":    lambda rows, f:  sum(r[f] for r in rows),
    "avg":    lambda rows, f:  round(st.mean(r[f] for r in rows), 2),
    "max":    lambda rows, f:  max(r[f] for r in rows),
    "min":    lambda rows, f:  min(r[f] for r in rows),
    "dc":     lambda rows, f:  len({r[f] for r in rows}),
    "values": lambda rows, f:  sorted({str(r[f]) for r in rows}),
}


def _coerce(v):
    try:
        return int(v)
    except ValueError:
        return v.strip('"')


def cmd_search(rows, arg):
    for tok in arg.split():
        neg = tok.startswith("NOT ")
        if "!=" in tok:
            k, v = tok.split("!="); rows = [r for r in rows if str(r.get(k)) != v.strip('"')]
        elif "=" in tok:
            k, v = tok.split("=", 1); v = v.strip('"')
            rows = [r for r in rows if fnmatch.fnmatch(str(r.get(k, "")), v)]
    return rows


def cmd_where(rows, arg):
    return [r for r in rows if eval(arg, {"__builtins__": {}}, r)]


def cmd_eval(rows, arg):
    field, expr = [s.strip() for s in arg.split("=", 1)]
    out = []
    for r in rows:
        r = dict(r)
        r[field] = eval(expr, {"__builtins__": {}, "len": len, "round": round}, r)
        out.append(r)
    return out


def cmd_rename(rows, arg):
    a, b = [s.strip() for s in arg.lower().split(" as ")]
    return [{(b if k == a else k): v for k, v in r.items()} for r in rows]


def cmd_stats(rows, arg):
    aggpart, _, bypart = arg.partition(" by ")
    groupf = [s.strip() for s in bypart.split(",")] if bypart else []
    specs = []
    for a in aggpart.split(","):
        a = a.strip()
        alias = a
        if re.search(r"\s+as\s+", a, re.I):
            a, alias = re.split(r"\s+as\s+", a, maxsplit=1, flags=re.I)
            a, alias = a.strip(), alias.strip()
        if "(" in a:
            fn, inner = a.split("(", 1)
            specs.append((fn.strip(), inner.rstrip(")").strip(), alias))
        else:
            specs.append((a, None, alias))
    groups = {}
    for r in rows:
        key = tuple(r.get(g) for g in groupf)
        groups.setdefault(key, []).append(r)
    out = []
    for key, grp in groups.items():
        row = dict(zip(groupf, key))
        for fn, f, label in specs:
            row[label] = AGG[fn](grp, f) if f else AGG[fn](grp)
        out.append(row)
    return out


def cmd_sort(rows, arg):
    keys = [k.strip() for k in arg.split(",")]
    for k in reversed(keys):
        desc = k.startswith("-")
        kk = k[1:] if desc else k
        rows = sorted(rows, key=lambda r: r.get(kk), reverse=desc)
    return rows


def cmd_head(rows, arg): return rows[:int(arg)]
def cmd_tail(rows, arg): return rows[-int(arg):]
def cmd_table(rows, arg):
    cols = [c.strip() for c in arg.split()]
    return [{c: r.get(c) for c in cols} for r in rows]


VERBS = {"search": cmd_search, "where": cmd_where, "eval": cmd_eval,
         "rename": cmd_rename, "stats": cmd_stats, "sort": cmd_sort,
         "head": cmd_head, "tail": cmd_tail, "table": cmd_table}


def run_spl(spl, events):
    parts = [p.strip() for p in spl.split("|")]
    rows = [dict(e) for e in events]
    for i, part in enumerate(parts):
        verb, _, arg = part.partition(" ")
        if i == 0 and verb not in VERBS:              # implicit leading search
            verb, arg = "search", part
        rows = VERBS[verb](rows, arg.strip())
    return rows


def main():
    q1 = 'where status >= 400 | stats count as errs by host | sort -errs'
    r1 = run_spl(q1, EVENTS)
    print("Q1  errors by host:"); [print("   ", r) for r in r1]

    q2 = 'search method=POST | stats count as n, dc(user) as users by uri'
    r2 = run_spl(q2, EVENTS)
    print("Q2  POST activity:"); [print("   ", r) for r in r2]

    q3 = 'where status == 200 | eval kb = round(bytes/1024.0, 1) | sort -kb | head 3 | table uri user kb'
    r3 = run_spl(q3, EVENTS)
    print("Q3  biggest 200s:"); [print("   ", r) for r in r3]

    q4 = 'stats sum(bytes) as total, avg(bytes) as mean, count as hits by host | sort -total'
    r4 = run_spl(q4, EVENTS)
    print("Q4  bytes by host:"); [print("   ", r) for r in r4]

    # --- assertions on the pipeline semantics ---
    assert {r["host"]: r["errs"] for r in r1} == {"web02": 4, "web03": 1}
    assert r1[0]["host"] == "web02", "sort -errs puts the noisiest host first"

    pay = next(r for r in r2 if r["uri"] == "/app/pay")
    assert pay["n"] == 2 and pay["users"] == 2, "two POSTs to /app/pay from two distinct users"

    assert len(r3) == 3 and r3[0]["uri"] == "/app/rpt", "head 3 after sort -kb"
    assert r3[0]["kb"] == 4.1

    web01 = next(r for r in r4 if r["host"] == "web01")
    assert web01["hits"] == 4 and web01["total"] == 512 + 1841 + 990 + 0
    assert r4[0]["host"] == "web03", "web03 moved the most bytes (the 4211 report)"

    print("\nPASS — search/where/eval/stats/sort/head/table compose like real SPL.")


if __name__ == "__main__":
    main()
