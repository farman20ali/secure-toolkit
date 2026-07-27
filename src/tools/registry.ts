export type ToolStatus = 'live' | 'coming-soon'

export type ToolDefinition = {
  id: string
  path: string
  title: string
  description: string
  status: ToolStatus
}

export const tools: ToolDefinition[] = [
  {
    id: 'password',
    path: '/tools/password',
    title: 'Password Generator',
    description:
      'Cryptographically strong passwords with customizable character sets.',
    status: 'live',
  },
  {
    id: 'uuid',
    path: '/tools/uuid',
    title: 'UUID Generator',
    description: 'Generate random UUID v4 and timestamp-ordered UUID v7 identifiers securely.',
    status: 'live',
  },
  {
    id: 'base64',
    path: '/tools/base64',
    title: 'Base64 Encode / Decode',
    description: 'Convert text to and from Base64 with UTF-8 support.',
    status: 'live',
  },
  {
    id: 'code-beautify',
    path: '/tools/code-beautify',
    title: 'Code Beautifier',
    description: 'Format and minify JSON, XML, HTML, and SQL queries locally.',
    status: 'live',
  },
  {
    id: 'code-compare',
    path: '/tools/code-compare',
    title: 'Code Diff & Comparer',
    description: 'Compare two or three codes or texts side-by-side with semantic formatting.',
    status: 'live',
  },
  {
    id: 'hash-generator',
    path: '/tools/hash-generator',
    title: 'Hash Generator',
    description: 'Generate secure SHA-256, SHA-512, and MD5 hashes from text or files locally.',
    status: 'live',
  },
  {
    id: 'jwt-decoder',
    path: '/tools/jwt-decoder',
    title: 'JWT Encoder & Decoder',
    description: 'Decode and inspect existing JWTs, or sign new ones with HMAC (HS256/384/512) locally.',
    status: 'live',
  },
  {
    id: 'url-codec',
    path: '/tools/url-codec',
    title: 'URL Encode / Decode',
    description: 'Encode and decode URLs and components locally.',
    status: 'live',
  },
  {
    id: 'rsa-generator',
    path: '/tools/rsa-generator',
    title: 'RSA Key Generator',
    description: 'Generate public/private RSA keys (up to 4096-bit) locally using Web Crypto.',
    status: 'live',
  },
  {
    id: 'cert-inspector',
    path: '/tools/cert-inspector',
    title: 'X.509 Certificate Tool',
    description: 'Inspect X.509 certificates (Subject, Issuer, Validity, Fingerprint) or generate RSA key pairs.',
    status: 'live',
  },
  {
    id: 'passkey',
    path: '/tools/passkey',
    title: 'Passkey & WebAuthn Tool',
    description: 'Test WebAuthn FIDO2 Passkey credentials locally, inspect authenticators, and parse clientDataJSON.',
    status: 'live',
  },
]

export function getToolById(id: string): ToolDefinition | undefined {
  return tools.find((tool) => tool.id === id)
}
