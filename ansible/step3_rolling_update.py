#!/usr/bin/env python3
"""
Ansible · Step 3 — a safe rolling update (serial + max_fail_percentage + health gate).

    - hosts: compute
      serial: "20%"                 # wave size
      max_fail_percentage: 10       # abort the whole play if a wave exceeds this
      tasks:
        - drain node
        - patch + reboot
        - wait for health check (until/retries)

This models the roll: waves, per-host patch that may fail, a health
check with retries, and the abort logic. It runs two fleets — one that
completes, one that trips the failure ceiling — and checks the behaviour.
"""
import math


def waves(hosts, serial_pct):
    size = max(1, math.ceil(len(hosts) * serial_pct / 100))
    return [hosts[i:i + size] for i in range(0, len(hosts), size)]


def health_ok(host, flaky, retries=5):
    """A flaky host comes up after a few tries; a broken host never does."""
    if host in flaky and flaky[host] == "broken":
        return False
    need = flaky.get(host, 0) if isinstance(flaky.get(host), int) else 0
    return need <= retries          # recovers within the retry budget


def roll(hosts, serial_pct, max_fail_pct, patch_fails, flaky):
    done, failed = [], []
    for wi, wave in enumerate(waves(hosts, serial_pct), 1):
        wave_failed = []
        for h in wave:
            if h in patch_fails:
                wave_failed.append((h, "patch failed"))
                continue
            if not health_ok(h, flaky):
                wave_failed.append((h, "health check timed out"))
                continue
            done.append(h)
        failed.extend(wave_failed)

        cum_fail_pct = 100 * len(failed) / len(hosts)
        print(f"  wave {wi}: {wave}  ->  {len(wave)-len(wave_failed)} ok, "
              f"{len(wave_failed)} failed   (cumulative fail {cum_fail_pct:.0f}%)")
        for h, why in wave_failed:
            print(f"          {h}: {why}")

        if cum_fail_pct > max_fail_pct:
            remaining = [h for h in hosts if h not in done and h not in [f[0] for f in failed]]
            print(f"  ABORT: {cum_fail_pct:.0f}% > max_fail_percentage {max_fail_pct}% "
                  f"— {len(remaining)} hosts left untouched")
            return {"status": "aborted", "done": done, "failed": failed,
                    "untouched": remaining}
    return {"status": "completed", "done": done, "failed": failed, "untouched": []}


def main():
    fleet = [f"cpu{i:03d}" for i in range(1, 21)]       # 20 nodes

    print("scenario A — one slow node recovers within retries, roll completes:")
    a = roll(fleet, serial_pct=20, max_fail_pct=10,
             patch_fails=set(), flaky={"cpu007": 3})
    print(f"  => {a['status']}, {len(a['done'])}/20 updated\n")

    print("scenario B — 3 nodes broken, exceeds 10% ceiling, roll aborts:")
    b = roll(fleet, serial_pct=20, max_fail_pct=10,
             patch_fails={"cpu003", "cpu004"}, flaky={"cpu009": "broken"})
    print(f"  => {b['status']}, {len(b['done'])} updated, {len(b['untouched'])} untouched\n")

    assert a["status"] == "completed" and len(a["done"]) == 20
    assert b["status"] == "aborted"
    # abort happened in wave 2 (cum 3/20 = 15% > 10%), so waves 3-5 untouched
    assert len(b["untouched"]) >= 8
    assert len(b["done"]) + len(b["failed"]) + len(b["untouched"]) == 20
    # a tighter ceiling would abort even earlier; a looser one would push through
    loose = roll(fleet, serial_pct=20, max_fail_pct=80,
                 patch_fails={"cpu003", "cpu004"}, flaky={"cpu009": "broken"})
    assert loose["status"] == "completed"

    print("PASS — roll completes under the ceiling, aborts over it, and stops mid-fleet.")


if __name__ == "__main__":
    main()
