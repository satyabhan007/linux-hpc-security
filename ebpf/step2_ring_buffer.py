#!/usr/bin/env python3
"""
eBPF · Step 2 — the BPF ring buffer (BPF_MAP_TYPE_RINGBUF), from scratch.

The ring buffer is how modern eBPF streams events to userspace: a single
shared circular byte buffer, multi-producer / single-consumer, with a
length-prefixed record format so a half-written record is never visible,
and a drop counter for when the consumer falls behind.

This implements a truly circular buffer (wrap via modulo) with that
protocol and hammers it with interleaved producers.
"""


class RingBuffer:
    def __init__(self, size_bytes):
        self.size = size_bytes
        self.buf = bytearray(size_bytes)
        self.prod = 0                 # monotonic byte counter
        self.cons = 0                 # monotonic byte counter
        self.dropped = 0
        self.pending = []             # committed records not yet consumed

    def _free(self):
        return self.size - (self.prod - self.cons)

    def _write(self, pos, data):
        for i, b in enumerate(data):
            self.buf[(pos + i) % self.size] = b

    def _read(self, pos, n):
        return bytes(self.buf[(pos + i) % self.size] for i in range(n))

    def emit(self, payload):
        rec = 4 + len(payload)                # 4-byte length header
        if rec > self._free():
            self.dropped += 1
            return False
        start = self.prod
        self._write(start, len(payload).to_bytes(4, "little"))
        self._write(start + 4, payload)
        self.prod += rec
        self.pending.append((start, rec, len(payload)))
        return True

    def consume(self):
        out = []
        for start, rec, plen in self.pending:
            length = int.from_bytes(self._read(start, 4), "little")
            assert length == plen, "torn record — protocol violation"
            out.append(self._read(start + 4, plen))
            self.cons += rec
        self.pending.clear()
        return out


def run(buf_size, producers, rounds, drain_every):
    rb = RingBuffer(buf_size)
    got, seq = [], 0
    for r in range(rounds):
        for p in range(producers):
            payload = f"p{p}:e{seq:04d}".encode()      # 8 bytes -> 12-byte record
            rb.emit(payload)
            seq += 1
        if r % drain_every == drain_every - 1:
            got.extend(rb.consume())
    got.extend(rb.consume())
    return rb, got, seq


def main():
    # small buffer, lazy consumer -> overflow and drops
    rb, got, emitted = run(buf_size=128, producers=4, rounds=60, drain_every=5)
    delivered = len(got)
    print(f"  buffer 128 B, drain every 5 rounds")
    print(f"  emitted  : {emitted}")
    print(f"  delivered: {delivered}")
    print(f"  dropped  : {rb.dropped}   (backpressure, not corruption)")
    print(f"  first 6  : {[e.decode() for e in got[:6]]}")

    assert delivered + rb.dropped == emitted, "every event delivered or counted dropped"
    idxs = [int(e.split(b':e')[1]) for e in got]
    assert idxs == sorted(idxs), "single consumer must see events in emission order"
    assert delivered > 0 and rb.dropped > 0, "this config should show both delivery and drops"

    # bigger buffer + more frequent drain -> strictly fewer drops
    rb2, got2, emitted2 = run(buf_size=1024, producers=4, rounds=60, drain_every=2)
    print(f"\n  buffer 1024 B, drain every 2 rounds -> dropped: {rb2.dropped}")
    assert rb2.dropped < rb.dropped
    assert len(got2) + rb2.dropped == emitted2

    print("\nPASS — length-prefixed records stay atomic and ordered; overflow => counted drops.")


if __name__ == "__main__":
    main()
