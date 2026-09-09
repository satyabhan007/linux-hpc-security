#!/usr/bin/env python3
"""
Key Management · Step 1 — envelope encryption, KEK rotation, crypto-shredding.

The pattern behind every cloud KMS (AWS KMS, GCP KMS, Azure Key Vault,
Vault Transit):

  * a KEK (key-encryption key) never leaves the HSM/KMS. You call
    Encrypt/Decrypt/GenerateDataKey; you never hold the KEK bytes.
  * each object gets its own DEK (data-encryption key), generated fresh.
  * the object is encrypted with the DEK; the DEK is WRAPPED (encrypted)
    by the KEK and stored next to the ciphertext.
  * to read: unwrap the DEK with the KEK (one small KMS call), then
    decrypt the object locally.

This buys you:
  - KEK rotation that re-wraps DEKs, NOT re-encrypting petabytes
  - a tiny blast radius for a leaked DEK (one object)
  - crypto-shredding: destroy a key -> its data is unrecoverable, instantly

We model wrap/unwrap with a toy reversible transform (NOT real crypto -
the point is the key hierarchy and lifecycle).
"""
import hashlib
import os


def _stream(key: bytes, nbytes: int) -> bytes:
    out = bytearray()
    ctr = 0
    while len(out) < nbytes:
        out += hashlib.sha256(key + ctr.to_bytes(8, "big")).digest()
        ctr += 1
    return bytes(out[:nbytes])


def xor(data: bytes, key: bytes) -> bytes:
    ks = _stream(key, len(data))
    return bytes(a ^ b for a, b in zip(data, ks))


class KMS:
    """Holds KEKs by (key_id, version). Callers never see KEK bytes."""

    def __init__(self):
        self._keks = {}
        self._current = {}

    def create_key(self, key_id):
        self._keks[(key_id, 1)] = os.urandom(32)
        self._current[key_id] = 1

    def rotate(self, key_id):
        v = self._current[key_id] + 1
        self._keks[(key_id, v)] = os.urandom(32)
        self._current[key_id] = v
        return v

    def destroy_key(self, key_id):
        for k in [k for k in self._keks if k[0] == key_id]:
            del self._keks[k]
        self._current.pop(key_id, None)

    def generate_data_key(self, key_id):
        dek = os.urandom(32)
        v = self._current[key_id]
        wrapped = xor(dek, self._keks[(key_id, v)])
        return dek, {"key_id": key_id, "version": v, "wrapped_dek": wrapped}

    def decrypt_data_key(self, meta):
        kek = self._keks.get((meta["key_id"], meta["version"]))
        if kek is None:
            raise KeyError("KEK version destroyed or unknown -> DEK unrecoverable")
        return xor(meta["wrapped_dek"], kek)

    def rewrap(self, meta):
        """Re-wrap an existing DEK under the current KEK version. No object
        data is touched."""
        dek = self.decrypt_data_key(meta)
        v = self._current[meta["key_id"]]
        return {"key_id": meta["key_id"], "version": v,
                "wrapped_dek": xor(dek, self._keks[(meta["key_id"], v)])}


def put(kms, key_id, plaintext):
    dek, meta = kms.generate_data_key(key_id)
    return {"ct": xor(plaintext, dek), "meta": meta}


def get(kms, obj):
    dek = kms.decrypt_data_key(obj["meta"])
    return xor(obj["ct"], dek)


def main():
    kms = KMS()
    kms.create_key("app-data")

    docs = {f"doc{i}": os.urandom(400 + i * 137) for i in range(5)}
    store = {name: put(kms, "app-data", pt) for name, pt in docs.items()}

    # round-trips
    for name, pt in docs.items():
        assert get(kms, store[name]) == pt
    print(f"  stored {len(store)} objects, each with its own wrapped DEK")

    # every DEK wrapping is distinct even though the KEK is shared
    wraps = [o["meta"]["wrapped_dek"] for o in store.values()]
    assert len(set(wraps)) == len(wraps)

    # --- KEK rotation: re-wrap DEKs, DO NOT re-encrypt the objects ---
    ct_before = {n: bytes(o["ct"]) for n, o in store.items()}
    new_v = kms.rotate("app-data")
    for o in store.values():
        o["meta"] = kms.rewrap(o["meta"])
    ct_after = {n: bytes(o["ct"]) for n, o in store.items()}
    assert ct_before == ct_after, "object ciphertext must be untouched by KEK rotation"
    assert all(o["meta"]["version"] == new_v for o in store.values())
    for name, pt in docs.items():
        assert get(kms, store[name]) == pt
    print(f"  rotated KEK to v{new_v}: {len(store)} DEKs re-wrapped, 0 bytes of "
          f"object data re-encrypted")

    # --- blast radius ---
    leaked_dek = kms.decrypt_data_key(store["doc2"]["meta"])
    can_read = sum(1 for o in store.values()
                   if xor(o["ct"], leaked_dek) in docs.values())
    assert can_read == 1, "a leaked DEK exposes exactly ONE object"
    print("  leaked DEK -> 1 object exposed (not the whole store)")

    # --- crypto-shredding: destroy the key, data is gone ---
    kms.destroy_key("app-data")
    lost = 0
    for name in store:
        try:
            get(kms, store[name])
        except KeyError:
            lost += 1
    assert lost == len(store)
    print(f"  destroyed KEK -> all {lost} objects cryptographically shredded "
          f"(ciphertext still on disk, forever unreadable)")

    print("\n  this is why 'encrypt everything' is cheap: one KMS call per object")
    print("  open, KEK rotation is O(number of DEKs) not O(bytes), and 'delete the")
    print("  data' can mean 'delete one key'.")
    print("\nPASS — envelope encryption: per-object DEKs, KEK rotation re-wraps only,"
          " leaked DEK = 1 object, key destruction = instant crypto-shred.")


if __name__ == "__main__":
    main()
