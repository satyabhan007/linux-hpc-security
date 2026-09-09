#!/usr/bin/env python3
"""
Encrypted Anomaly · Step 2 — JA3/JA4-style TLS client fingerprinting.

The TLS ClientHello is sent in the clear (pre-1.3 fully; 1.3 still
exposes the same fields unless ECH is used). Its shape is decided by the
client's TLS *library*, not the user:

  * TLS version
  * ordered cipher-suite list
  * ordered extension list
  * supported elliptic curves / groups
  * EC point formats
  * ALPN ("h2", "http/1.1")

Hash that tuple and you get a fingerprint (JA3 = MD5 of the CSV; JA4 is
the newer, structured, GREASE-resilient version). A stock Chrome, a Go
`net/http` client, a Python `requests`, and a Cobalt Strike / custom
malloc all have DIFFERENT fingerprints — visible without decryption.

This lab computes a JA3-like hash, keeps a per-destination allowlist of
fingerprints seen from sanctioned software, and flags an unknown one.
"""
import hashlib

GREASE = {0x0a0a, 0x1a1a, 0x2a2a, 0x3a3a, 0x4a4a, 0x5a5a, 0x6a6a, 0x7a7a,
          0x8a8a, 0x9a9a, 0xaaaa, 0xbaba, 0xcaca, 0xdada, 0xeaea, 0xfafa}


def ja3(ch):
    """ch: dict with tls_version, ciphers, extensions, curves, ec_formats."""
    def clean(xs):
        return [x for x in xs if x not in GREASE]
    fields = [
        str(ch["tls_version"]),
        "-".join(map(str, clean(ch["ciphers"]))),
        "-".join(map(str, clean(ch["extensions"]))),
        "-".join(map(str, clean(ch["curves"]))),
        "-".join(map(str, ch["ec_formats"])),
    ]
    s = ",".join(fields)
    return hashlib.md5(s.encode()).hexdigest()


# Realistic-ish ClientHellos (numbers are illustrative code points).
CHROME = {"tls_version": 771,
          "ciphers": [0x1a1a, 4865, 4866, 4867, 49195, 49199, 49196, 49200, 52393, 52392],
          "extensions": [0x0a0a, 0, 23, 65281, 10, 11, 35, 16, 5, 13, 18, 51, 45, 43, 27, 17513],
          "curves": [0x1a1a, 29, 23, 24], "ec_formats": [0]}
FIREFOX = {"tls_version": 771,
           "ciphers": [4865, 4867, 4866, 49195, 49199, 52393, 52392, 49196, 49200],
           "extensions": [0, 23, 65281, 10, 11, 16, 5, 34, 51, 43, 13, 45, 28, 21],
           "curves": [29, 23, 24, 25, 256, 257], "ec_formats": [0]}
GO_HTTP = {"tls_version": 771,
           "ciphers": [4865, 4866, 4867, 49195, 49196, 49199, 49200, 52393, 52392],
           "extensions": [0, 5, 10, 11, 13, 18, 23, 43, 45, 51],
           "curves": [29, 23, 24, 25], "ec_formats": [0]}
MALWARE_CUSTOM = {"tls_version": 771,
                  "ciphers": [49200, 49196, 49199, 49195, 159, 158, 57, 51, 10],  # odd order, old suites
                  "extensions": [0, 10, 11, 13, 23],                              # sparse
                  "curves": [23, 24, 25], "ec_formats": [0]}


def main():
    prints = {name: ja3(ch) for name, ch in
              [("Chrome", CHROME), ("Firefox", FIREFOX),
               ("Go net/http", GO_HTTP), ("malware(custom)", MALWARE_CUSTOM)]}
    for n, h in prints.items():
        print(f"  {n:>16}  JA3 {h}")

    # every distinct client stack -> distinct fingerprint
    assert len(set(prints.values())) == 4

    # GREASE must not change the hash: Chrome with different GREASE values
    chrome2 = {**CHROME, "ciphers": [0x2a2a, 4865, 4866, 4867, 49195, 49199,
                                     49196, 49200, 52393, 52392],
               "extensions": [0x8a8a, 0, 23, 65281, 10, 11, 35, 16, 5, 13, 18,
                              51, 45, 43, 27, 17513],
               "curves": [0x3a3a, 29, 23, 24]}
    assert ja3(chrome2) == prints["Chrome"], "GREASE-stripped hash must be stable"

    # Policy: on the corporate egress proxy, host `updates.example.com`
    # is only ever contacted by the sanctioned updater (a Go binary) and
    # by browsers. Allowlist those fingerprints.
    allow = {prints["Chrome"], prints["Firefox"], prints["Go net/http"]}

    observed = [("Chrome", prints["Chrome"]),
                ("Firefox", prints["Firefox"]),
                ("Go net/http", prints["Go net/http"]),
                ("malware(custom)", prints["malware(custom)"])]
    alerts = []
    for who, fp in observed:
        status = "ok" if fp in allow else "ALERT unknown TLS stack"
        print(f"  egress: {who:>16} -> {status}")
        if fp not in allow:
            alerts.append(who)
    assert alerts == ["malware(custom)"], alerts

    # SNI / cert-name consistency (also cleartext pre-ECH): a flow whose
    # SNI says `cdn.example.com` but whose certificate CN is
    # `x2j9.duckdns.org` is domain-fronting or a mismatch worth flagging.
    def sni_cert_ok(sni, cert_cn):
        return sni.split(".")[-2:] == cert_cn.split(".")[-2:]
    assert sni_cert_ok("cdn.example.com", "edge.example.com")
    assert not sni_cert_ok("cdn.example.com", "x2j9.duckdns.org")

    print("\n  Encrypted, yes — but the handshake still names the client library,")
    print("  and a fingerprint no sanctioned software produces is a strong signal.")
    print("  (ECH/Encrypted-ClientHello removes SNI+fields; then you fall back to")
    print("   Step 1 flow features and Step 3 beaconing.)")
    print("\nPASS — 4 client stacks -> 4 fingerprints; GREASE-stable; only the custom"
          " malware stack trips the egress allowlist.")


if __name__ == "__main__":
    main()
