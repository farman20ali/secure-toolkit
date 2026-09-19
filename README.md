# 🔐 Secure Toolkit

> **Privacy-first security and developer utilities — entirely in your browser.**
> No backend, no analytics, no tracking. All cryptographic operations happen locally.

**Live site →** [`https://farman20ali.github.io/secure-toolkit/`](https://farman20ali.github.io/secure-toolkit/)

![Deploy to GitHub Pages](https://github.com/farman20ali/secure-toolkit/actions/workflows/deploy-pages.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)

---

## ✨ Tools & Features

### 🔐 Cryptography
| Tool | Key Features |
|------|--------------|
| **AES & Digital Signatures** | AES-GCM encryption/decryption, RSA/ECDSA message signing and verification — all via Web Crypto API. |
| **Hash Generator** | SHA-256, SHA-512, SHA-384, SHA-1, MD5 checksums; HMAC signatures with custom keys; file drag-and-drop hashing. |
| **RSA Key Generator** | Generate public/private RSA key pairs up to 4096-bit in PEM format via Web Crypto. |

### 🔑 Authentication & Passwords
| Tool | Key Features |
|------|--------------|
| **Password Generator** | Cryptographically strong passwords with configurable length, character sets, and entropy estimation. |
| **Password Security Analyzer** | Entropy scoring, character composition, pattern risk warnings, Bcrypt (`$2b$`) hashing, PBKDF2 key derivation, and strength meter. |
| **Passkey & WebAuthn Tool** | FIDO2/WebAuthn passkey registration tests, platform authenticator detection, and `clientDataJSON` payload inspection. |
| **TOTP Generator & QR Tool** | Live TOTP 2FA token generation with countdown, `otpauth://` QR code scanner and generator. |

### 🎫 Token & Identity
| Tool | Key Features |
|------|--------------|
| **JWT Encoder & Decoder** | Decode JWT claims/headers, verify HMAC (`HS256/384/512`) and RSA/ECDSA signatures from `.pem` files, sign new tokens. |

### 📜 PKI & Certificates
| Tool | Key Features |
|------|--------------|
| **X.509 Certificate Tool** | Parse X.509 certificates (Subject, Issuer, Validity, Fingerprints, SANs), generate 2048-bit RSA dev key pairs. |

### 📱 QR & Barcode Security
| Tool | Key Features |
|------|--------------|
| **QR & Barcode Security Lab** | Generate and decode QR codes and barcodes, scan from camera/file, and analyze for malicious URLs or embedded payloads. |

### 🌐 Web Security
| Tool | Key Features |
|------|--------------|
| **URL Security Analyzer** | Parse URL structures, detect embedded credentials, punycode domain spoofing, and open-redirect parameter patterns. |
| **URL Encode / Decode** | Interactive component-level and full-URI encoding/decoding. |
| **SMTP Security & Mail Tester Studio** | Verify SMTP credentials & Google App Passwords, test TLS ports, simulate protocol handshakes, bulk CSV mail merge, and generate diagnostic code snippets (Node.js, Python, PowerShell, PHP, OpenSSL). |

### 🕵️ Secret Detection
| Tool | Key Features |
|------|--------------|
| **Secret & Credential Detector** | Browser-local scanner for API keys, tokens, and credentials in code snippets, `.env` files, and JSON payloads. |

### 📦 File & Encoding Utilities
| Tool | Key Features |
|------|--------------|
| **File Integrity & Magic Byte Inspector** | Multi-algorithm file checksums, expected-hash matcher, extension vs. magic-byte mismatch detection, and entropy visualizer. |
| **Chainable Encoding Lab** | Multi-step pipeline builder for Base64, Base32, Base58, Hex, Binary, URL-encoding, HTML entities, and Unicode conversions. |
| **JSON Explorer & Diagnostic Lab** | Validate, auto-repair, tree-traverse, view object graphs, JSONPath queries, schema generation, and nested secret scanning. |
| **Base32 & Base64 Encoder / Decoder** | RFC 4648 Base32 (TOTP secrets), Standard & URL-safe Base64, full UTF-8/emoji support. |
| **Code Beautifier** | Format or minify JSON (with loose-parse fallback), XML, HTML, and SQL queries locally. |
| **Code Diff & Comparer** | 2-way and 3-way side-by-side diffs using the Myers O(N·D) algorithm, word-level diffing, and semantic formatting. |
| **UUID Generator** | RFC 4122 v4 (random) and RFC 9562 v7 (timestamp-ordered) UUIDs. |

---

## 🛡️ Threat Model & Security Policy

| Guarantee | Detail |
|-----------|--------|
| **Zero External Requests** | No input data, generated secrets, passkeys, certificates, or tokens leave your device. All operations execute strictly within the browser memory sandbox. |
| **Standard Web Cryptography** | Web Crypto API (`window.crypto.subtle`), standard WebAuthn APIs (`navigator.credentials`), and peer-reviewed client-side algorithms power all cryptographic operations. |
| **Open Source & Auditable** | Verify JavaScript execution directly in browser DevTools or run local builds fully offline. |

---

## 🚀 Local Development

### Prerequisites

- Node.js >= 22
- npm >= 10

### Quick Start

```bash
git clone https://github.com/farman20ali/secure-toolkit.git
cd secure-toolkit
npm install
npm run dev
```

Open the URL shown in the terminal (usually `http://localhost:5173`).

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then produce production bundle |
| `npm run preview` | Locally preview the production build |
| `npm run test` | Run Vitest unit test suite |
| `npm run lint` | Run OxLint static analysis |
| `npm run relay` | Start the local SMTP relay server (for SMTP Tester) |

> **GitHub Pages note:** The production build sets the base path to `/secure-toolkit/`. After building, `dist/404.html` is automatically generated from `dist/index.html` to support client-side routing on hard reload.

---

## 🏗️ Project Structure

```
secure-toolkit/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml   # CI: test → build → deploy to GitHub Pages
├── script/
│   └── server-relay.js        # Local Express SMTP relay (for SMTP Tester)
├── src/
│   ├── components/            # Shared UI components
│   ├── context/               # React context providers
│   ├── layout/                # App shell & navigation
│   ├── lib/                   # Shared utility helpers
│   ├── pages/                 # Route-level page components
│   └── tools/                 # One folder per tool
│       ├── registry.ts        # Central tool & category registry
│       ├── base64/
│       ├── cert-inspector/
│       ├── code-beautify/
│       ├── code-compare/
│       ├── cryptography/
│       ├── encoding/
│       ├── file-security/
│       ├── hash-generator/
│       ├── json-explorer/
│       ├── jwt-decoder/
│       ├── passkey/
│       ├── password/
│       ├── password-analyzer/
│       ├── qr-barcode/
│       ├── rsa-generator/
│       ├── secrets/
│       ├── smtp-tester/
│       ├── totp/
│       ├── url-codec/
│       ├── uuid/
│       └── web-security/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 + TypeScript 6 |
| Build | Vite 8 |
| Styling | Tailwind CSS 4 |
| Routing | React Router DOM 7 |
| Cryptography | Web Crypto API, bcryptjs, otpauth |
| QR / Barcode | qrcode, jsbarcode, jsqr, @zxing/library |
| Email | nodemailer (relay server only) |
| Testing | Vitest + Testing Library |
| Linting | OxLint |
| Deployment | GitHub Actions → GitHub Pages |

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-tool`
3. Commit your changes: `git commit -m 'feat: add my tool'`
4. Push and open a Pull Request targeting `main`

All tools must operate **entirely client-side** — no external API calls from tool logic.

---

## 📄 License

[MIT License](./LICENSE) © [farman20ali](https://github.com/farman20ali)
