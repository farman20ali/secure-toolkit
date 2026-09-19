export type ToolStatus = 'live' | 'coming-soon'

export type ToolCategory =
  | 'cryptography'
  | 'auth'
  | 'tokens'
  | 'pki'
  | 'qr-barcode'
  | 'web-security'
  | 'secrets'
  | 'file-encoding'

export type CategoryDefinition = {
  id: ToolCategory
  title: string
  icon: string
  description: string
}

export const categories: CategoryDefinition[] = [
  {
    id: 'cryptography',
    title: 'Cryptography',
    icon: '🔐',
    description: 'AES encryption, digital signatures, hashing, and key management.',
  },
  {
    id: 'auth',
    title: 'Authentication & Passwords',
    icon: '🔑',
    description: 'Passwords, passkeys, WebAuthn, TOTP MFA, and KDF hashing.',
  },
  {
    id: 'tokens',
    title: 'Token & Identity',
    icon: '🎫',
    description: 'JWT inspection, signature verification, and OAuth tokens.',
  },
  {
    id: 'pki',
    title: 'PKI & Certificates',
    icon: '📜',
    description: 'X.509 certificate decoding, chain validation, and key conversion.',
  },
  {
    id: 'qr-barcode',
    title: 'QR & Barcode Security',
    icon: '📱',
    description: 'Generate, decode, scan, and security-analyze QR codes & barcodes.',
  },
  {
    id: 'web-security',
    title: 'Web Security',
    icon: '🌐',
    description: 'URL security analyzer, credential leaks, and HTTP codec utilities.',
  },
  {
    id: 'secrets',
    title: 'Secret Detection',
    icon: '🕵️',
    description: 'Browser-local secret scanner for code, .env files, and API keys.',
  },
  {
    id: 'file-encoding',
    title: 'File & Encoding Utilities',
    icon: '📦',
    description: 'File checksums, MIME mismatch, multi-encoding pipelines, and formatting.',
  },
]

export type ToolDefinition = {
  id: string
  path: string
  title: string
  icon: string
  description: string
  category: ToolCategory
  status: ToolStatus
  popular?: boolean
}

export const tools: ToolDefinition[] = [
  // 📱 QR & Barcode Security Lab
  {
    id: 'qr-barcode',
    path: '/tools/qr-barcode',
    title: 'QR & Barcode Security Lab',
    icon: '📱',
    description:
      'Generate, decode, scan, and security-analyze QR codes & barcodes for malicious redirects and leaks.',
    category: 'qr-barcode',
    status: 'live',
    popular: true,
  },

  // 🕵️ Secret Scanner
  {
    id: 'secret-scanner',
    path: '/tools/secret-scanner',
    title: 'Secret & Credential Detector',
    icon: '🕵️',
    description:
      'Scan code, .env files, and JSON payloads locally for leaked API keys, tokens, and credentials.',
    category: 'secrets',
    status: 'live',
    popular: true,
  },

  // 🔑 TOTP MFA Tool
  {
    id: 'totp',
    path: '/tools/totp',
    title: 'TOTP Generator & QR Tool',
    icon: '⏱️',
    description:
      'Generate live TOTP 2FA tokens, countdowns, and parse or generate otpauth:// QR codes.',
    category: 'auth',
    status: 'live',
    popular: true,
  },

  // 🔐 AES & Digital Signatures
  {
    id: 'crypto-lab',
    path: '/tools/crypto-lab',
    title: 'AES & Digital Signatures',
    icon: '🔐',
    description:
      'AES-GCM encryption/decryption and RSA/ECDSA digital message signing and verification.',
    category: 'cryptography',
    status: 'live',
    popular: true,
  },

  // 🔑 Password Security Analyzer
  {
    id: 'password-analyzer',
    path: '/tools/password-analyzer',
    title: 'Password Security Analyzer',
    icon: '🛡️',
    description:
      'Analyze password entropy, character composition, pattern risk warnings, and bcrypt/PBKDF2 hashes.',
    category: 'auth',
    status: 'live',
  },

  // 🌐 URL Security Analyzer
  {
    id: 'url-analyzer',
    path: '/tools/url-analyzer',
    title: 'URL Security Analyzer',
    icon: '🌐',
    description:
      'Parse URL structures, detect embedded credentials, punycode domain spoofing, and open redirect parameters.',
    category: 'web-security',
    status: 'live',
  },

  // 📦 File Security Inspector
  {
    id: 'file-security',
    path: '/tools/file-security',
    title: 'File Integrity & Magic Byte Inspector',
    icon: '📦',
    description:
      'Multi-hash file verification, checksum matcher, extension vs magic-byte mismatch detector, and entropy visualizer.',
    category: 'file-encoding',
    status: 'live',
  },

  // 🔤 Chainable Encoding Lab
  {
    id: 'encoding-lab',
    path: '/tools/encoding-lab',
    title: 'Chainable Encoding Lab',
    icon: '🔤',
    description:
      'Multi-step pipeline builder for Base64, Base32, Base58, Hex, Binary, URL, HTML, and Unicode conversions.',
    category: 'file-encoding',
    status: 'live',
  },

  // Existing Tools
  {
    id: 'password',
    path: '/tools/password',
    title: 'Password Generator',
    icon: '🔑',
    description:
      'Cryptographically strong passwords with customizable character sets.',
    category: 'auth',
    status: 'live',
  },
  {
    id: 'uuid',
    path: '/tools/uuid',
    title: 'UUID Generator',
    icon: '🆔',
    description:
      'Generate random UUID v4 and timestamp-ordered UUID v7 identifiers securely.',
    category: 'file-encoding',
    status: 'live',
  },
  {
    id: 'base64',
    path: '/tools/base64',
    title: 'Base32 & Base64 Encoder / Decoder',
    icon: '🔤',
    description:
      'Encode, decode, and generate Base32 (RFC 4648 / TOTP 2FA secrets) and Base64 (Standard & URL-safe) keys.',
    category: 'file-encoding',
    status: 'live',
  },


  {
    id: 'code-beautify',
    path: '/tools/code-beautify',
    title: 'Code Beautifier',
    icon: '🧹',
    description: 'Format and minify JSON, XML, HTML, and SQL queries locally.',
    category: 'file-encoding',
    status: 'live',
  },
  {
    id: 'code-compare',
    path: '/tools/code-compare',
    title: 'Code Diff & Comparer',
    icon: '⚖️',
    description:
      'Compare two or three codes or texts side-by-side with semantic formatting.',
    category: 'file-encoding',
    status: 'live',
  },
  {
    id: 'hash-generator',
    path: '/tools/hash-generator',
    title: 'Hash Generator',
    icon: '🔒',
    description:
      'Generate secure SHA-256, SHA-512, and MD5 hashes from text or files locally.',
    category: 'cryptography',
    status: 'live',
  },
  {
    id: 'jwt-decoder',
    path: '/tools/jwt-decoder',
    title: 'JWT Encoder & Decoder',
    icon: '🎫',
    description:
      'Decode and inspect existing JWTs, or sign new ones with HMAC (HS256/384/512) locally.',
    category: 'tokens',
    status: 'live',
  },
  {
    id: 'url-codec',
    path: '/tools/url-codec',
    title: 'URL Encode / Decode',
    icon: '🌐',
    description: 'Encode and decode URLs and components locally.',
    category: 'web-security',
    status: 'live',
  },
  {
    id: 'rsa-generator',
    path: '/tools/rsa-generator',
    title: 'RSA Key Generator',
    icon: '🔑',
    description:
      'Generate public/private RSA keys (up to 4096-bit) locally using Web Crypto.',
    category: 'cryptography',
    status: 'live',
  },
  {
    id: 'cert-inspector',
    path: '/tools/cert-inspector',
    title: 'X.509 Certificate Tool',
    icon: '📜',
    description:
      'Inspect X.509 certificates (Subject, Issuer, Validity, Fingerprint) or generate RSA key pairs.',
    category: 'pki',
    status: 'live',
  },
  {
    id: 'passkey',
    path: '/tools/passkey',
    title: 'Passkey & WebAuthn Tool',
    icon: '🪪',
    description:
      'Test WebAuthn FIDO2 Passkey credentials locally, inspect authenticators, and parse clientDataJSON.',
    category: 'auth',
    status: 'live',
  },
]

export function getToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}

export function getCategoryById(id: ToolCategory): CategoryDefinition | undefined {
  return categories.find((cat) => cat.id === id)
}
