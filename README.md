# Secure Toolkit

Privacy-first security and developer utilities that run entirely in your browser. No backend, no analytics, and no tracking. All processing, key generation, and token validations happen fully locally.

**Live site:** `https://farman20ali.github.io/secure-toolkit/`

## Tools & Features

| Tool | Status | Key Features |
|------|--------|--------------|
| **Password & Bcrypt Utilities** | Live | Custom lengths, entropy estimation, `$2b$` Bcrypt hashing with cost factor selection, password match verifier, and PBKDF2 key derivation. |
| **Passkey & WebAuthn Tool** | Live | Test FIDO2 / WebAuthn Passkey registration locally, check browser platform authenticator support, and parse `clientDataJSON` payloads. |
| **X.509 Certificate Tool** | Live | Inspect X.509 certificates (Subject, Issuer, Validity Dates, Fingerprints) and generate 2048-bit RSA dev key pairs in PEM format. |
| **JWT Encoder, Decoder & Verifier** | Live | Decode JWT claims & headers, verify signatures using HMAC (`HS256/384/512`) or uploaded RSA/ECDSA public keys (`.pem`), and sign new tokens. |
| **Hash & Checksum Generator** | Live | Compute `SHA-256`, `SHA-512`, `SHA-384`, `SHA-1`, and `MD5` checksums, compute HMAC signatures with custom keys, and match expected hashes. |
| **Code Diff & Comparer** | Live | 2-way and 3-way side-by-side file alignment diffs ($O(N \cdot D)$ Myers algorithm) with optional word-level diffing and semantic formatting. |
| **Code Beautifier** | Live | Format or minify JSON, XML, HTML, and SQL queries locally with loose JSON parsing fallback. |
| **UUID Generator** | Live | RFC 4122 v4 (random) and RFC 9562 v7 (timestamp-ordered) UUIDs. |
| **Base64 Encode / Decode** | Live | Full UTF-8 emoji-safe conversion, URL-safe Base64 formatting. |
| **URL Encode / Decode** | Live | Interactive component and full URI encoding and decoding. |
| **RSA Key Generator** | Live | Local generation of RSA key pairs (up to 4096-bit) in PEM format via Web Crypto. |

---

## Local Development

```bash
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Running Tests

```bash
npm run test
```

### Production Build & Linting

```bash
npm run lint
npm run build
npm run preview
```

The production build uses the base path `/secure-toolkit/` for GitHub Pages. After building, `404.html` is automatically copied from `index.html` to support client-side routing on reload.

---

## Threat Model & Security Policy

1. **Zero External Network Requests**: No input data, generated secrets, passkeys, certificates, or tokens leave your device. All operations execute strictly within the browser memory sandbox.
2. **Standard Web Cryptography**: Web Crypto API (`window.crypto.subtle`), standard WebAuthn APIs (`navigator.credentials`), and peer-reviewed client-side algorithms power all cryptographic operations.
3. **Open Source & Auditable**: You can verify the Javascript execution directly in browser developer tools or run local builds offline.

## License

MIT License.
