# Secure Toolkit

Privacy-first security and developer utilities that run entirely in your browser. No backend, no analytics, and no tracking. All processing and generation happen fully locally.

**Live site:** `https://farman20ali.github.io/secure-toolkit/`

## Tools

| Tool | Status | Key Features |
|------|--------|--------------|
| **Password Generator** | Live | Custom lengths, custom character sets, entropy estimation. |
| **UUID Generator** | Live | RFC 4122 v4 (random) and RFC 9562 v7 (timestamp-ordered) UUIDs. |
| **Base64 Encode / Decode** | Live | Full UTF-8 emoji-safe conversion, URL-safe Base64 formatting. |
| **Code Beautifier** | Live | Format or minify JSON, XML, HTML, and SQL queries locally. Loose JSON parser. |
| **Code Diff & Comparer** | Live | 2-way and 3-way side-by-side file alignment diffs with optional semantic pre-formatting. |
| **Hash Generator** | Live | Generate SHA-256, SHA-512, SHA-1, SHA-384, and MD5 hashes. Supports local file drag & drop. |
| **JWT Decoder** | Live | Visual decoding of Header, Claims Payload, and Signature. Expiration check. |
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

### Production Build

```bash
npm run build
npm run preview
```

The production build uses the base path `/secure-toolkit/` for GitHub project Pages. After building, `404.html` is automatically copied from `index.html` to support client-side routing on reload.

---

## Threat Model & Security Policy

1. **Zero External Requests**: No input data, generated secrets, files, or tokens are ever sent over the network. All operations are performed strictly in the browser memory sandbox.
2. **Standard Web Cryptography**: Random number generation, hash calculation (SHA), and RSA key generation rely on the native Web Crypto API (`window.crypto`), ensuring strong cryptographic primitives.
3. **Open Source Verification**: You can verify that the Javascript running matches the repository code by inspecting the source directly or running a local instance.

## License

MIT License.
