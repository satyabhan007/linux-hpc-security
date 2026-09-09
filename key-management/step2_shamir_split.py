#!/usr/bin/env python3
"""
Key Management · Step 2 — Shamir's Secret Sharing (the key ceremony).

A root/unseal key must not sit whole anywhere. Split it into `n` shares
so that ANY `k` of them reconstruct it and any `k-1` reveal NOTHING.
This is how Vault unseals, how CAs protect offline roots, and how a
"break-glass" key needs a quorum of officers in a room.

Math: pick a random degree-(k-1) polynomial f over a prime field with
f(0) = secret. Share i is (i, f(i)). Any k points determine f uniquely
(Lagrange interpolation); k-1 points leave f(0) uniformly random.

Pure Python, prime field. No dependencies.
"""
import os
import random

# a 521-bit Mersenne prime; secret must be < PRIME (fine for any key)
PRIME = 2 ** 521 - 1


def _eval(poly, x, p=PRIME):
    acc = 0
    for coeff in reversed(poly):        # Horner
        acc = (acc * x + coeff) % p
    return acc


def split(secret_int, n, k, p=PRIME):
    if not (2 <= k <= n):
        raise ValueError("need 2 <= k <= n")
    if secret_int >= p:
        raise ValueError("secret too large for the field")
    poly = [secret_int] + [random.randrange(1, p) for _ in range(k - 1)]
    return [(i, _eval(poly, i, p)) for i in range(1, n + 1)]


def _inv(a, p=PRIME):
    return pow(a, p - 2, p)            # Fermat, p prime


def recombine(shares, p=PRIME):
    """Lagrange interpolation at x = 0."""
    secret = 0
    for j, (xj, yj) in enumerate(shares):
        num, den = 1, 1
        for m, (xm, _) in enumerate(shares):
            if m == j:
                continue
            num = (num * (-xm)) % p
            den = (den * (xj - xm)) % p
        secret = (secret + yj * num * _inv(den, p)) % p
    return secret


def main():
    random.seed(20260910)
    secret = int.from_bytes(os.urandom(32), "big")     # a 256-bit master key
    n, k = 5, 3
    shares = split(secret, n, k)
    print(f"  split a 256-bit key into n={n} shares, threshold k={k}")
    for i, (x, y) in enumerate(shares):
        print(f"    share {x}: {hex(y)[:26]}...")

    # any k shares reconstruct
    import itertools
    combos = list(itertools.combinations(shares, k))
    for c in combos:
        assert recombine(list(c)) == secret
    print(f"  all {len(combos)} distinct {k}-of-{n} subsets reconstruct the key")

    # more than k also works
    assert recombine(shares[:4]) == secret
    assert recombine(shares) == secret

    # k-1 shares: the recovered f(0) is NOT the secret, and sweeping the
    # missing share's value shows every field element is equally possible
    partial = shares[:k - 1]
    guesses = set()
    for _ in range(200):
        fake_y = random.randrange(PRIME)
        guesses.add(recombine(partial + [(99, fake_y)]))
    # every choice of the missing point gives a different, consistent secret
    assert len(guesses) == 200 and secret not in guesses
    # concretely: with only 2 of 3 shares, adding ANY 3rd point yields a
    # different, consistent secret -> zero information leaked
    s_a = recombine(partial + [(99, 12345)])
    s_b = recombine(partial + [(99, 67890)])
    assert s_a != s_b and s_a != secret and s_b != secret
    print(f"  {k-1} shares: reconstructions vary with the missing point -> 0 bits leaked")

    # tamper detection is NOT built in: a corrupted share yields a wrong
    # secret silently. Real deployments add a checksum/commitment per share
    # (Feldman/Pedersen VSS) or verify the reconstructed key against a KCV.
    bad = list(shares[:k])
    bad[0] = (bad[0][0], (bad[0][1] + 1) % PRIME)
    assert recombine(bad) != secret
    print("  NOTE: a wrong/forged share reconstructs a WRONG key silently;")
    print("        add a per-share commitment (VSS) or check a KCV after recombine.")

    # operational shape: n=5 officers, k=3 quorum; 2 can be unavailable or
    # compromised without loss of availability or confidentiality.
    assert n - k == 2
    print(f"\n  ceremony: {n} custodians, quorum {k}. Tolerates {n - k} lost shares")
    print(f"  (availability) and {k - 1} stolen shares (confidentiality).")

    print("\nPASS — any k-of-n reconstruct; k-1 leak nothing; corruption is silent"
          " without a commitment scheme.")


if __name__ == "__main__":
    main()
