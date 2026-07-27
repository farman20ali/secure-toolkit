import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

// ─── Shared Base64URL & PEM helpers ──────────────────────────────────────────

function encodeBase64Url(data: string | ArrayBuffer): string {
  let binString: string
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data)
    binString = ''
    for (let i = 0; i < bytes.length; i++) binString += String.fromCharCode(bytes[i]!)
  } else {
    const view = new Uint8Array(data)
    binString = ''
    for (let i = 0; i < view.length; i++) binString += String.fromCharCode(view[i]!)
  }
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

function base64UrlToUint8Array(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i)
  return bytes
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 space]+-----/g, '')
    .replace(/-----END [A-Z0-9 space]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

// ─── Decode & Verify helpers ──────────────────────────────────────────────────

export type DecodedToken = {
  raw: string
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  signingInput: string
  expired: boolean | null
  expDate: Date | null
  iatDate: Date | null
  nbfDate: Date | null
  alg: string
}

export function decodeToken(token: string): DecodedToken {
  const raw = token.trim()
  if (raw.length > 8192) throw new Error('Token is too large to decode safely (max 8 KiB).')
  const cleaned = raw.replace(/^"|"$/g, '').replace(/^'|'$/g, '')
  const parts = cleaned.split('.')
  if (parts.length !== 3) {
    throw new Error(
      parts.length < 3
        ? `JWT must have 3 dot-separated parts — found ${parts.length}.`
        : 'Token has too many dots — verify it is a standard JWT.',
    )
  }
  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = JSON.parse(decodeBase64Url(parts[0]!))
  } catch {
    throw new Error('Header segment is not valid Base64URL-encoded JSON.')
  }
  try {
    payload = JSON.parse(decodeBase64Url(parts[1]!))
  } catch {
    throw new Error('Payload segment is not valid Base64URL-encoded JSON.')
  }
  const signature = parts[2]!
  const signingInput = `${parts[0]}.${parts[1]}`
  const alg = typeof header.alg === 'string' ? header.alg : 'HS256'

  let expired: boolean | null = null
  let expDate: Date | null = null
  let iatDate: Date | null = null
  let nbfDate: Date | null = null
  if (typeof payload.exp === 'number') {
    expDate = new Date(payload.exp * 1000)
    expired = Date.now() > expDate.getTime()
  }
  if (typeof payload.iat === 'number') iatDate = new Date(payload.iat * 1000)
  if (typeof payload.nbf === 'number') nbfDate = new Date(payload.nbf * 1000)

  return { raw, header, payload, signature, signingInput, expired, expDate, iatDate, nbfDate, alg }
}

export async function verifyJwtSignature(
  decoded: DecodedToken,
  secretOrPublicKeyPem: string,
): Promise<boolean> {
  const inputBytes = new TextEncoder().encode(decoded.signingInput)
  const sigBytes = base64UrlToUint8Array(decoded.signature)
  const alg = decoded.alg.toUpperCase()

  if (alg.startsWith('HS')) {
    const hash = alg === 'HS384' ? 'SHA-384' : alg === 'HS512' ? 'SHA-512' : 'SHA-256'
    const keyData = new TextEncoder().encode(secretOrPublicKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash },
      false,
      ['verify'],
    )
    return crypto.subtle.verify('HMAC', cryptoKey, sigBytes.buffer as ArrayBuffer, inputBytes.buffer as ArrayBuffer)
  }

  if (alg.startsWith('RS')) {
    const hash = alg === 'RS384' ? 'SHA-384' : alg === 'RS512' ? 'SHA-512' : 'SHA-256'
    const spkiBuffer = pemToArrayBuffer(secretOrPublicKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      spkiBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash },
      false,
      ['verify'],
    )
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes.buffer as ArrayBuffer, inputBytes.buffer as ArrayBuffer)
  }

  if (alg.startsWith('ES')) {
    const namedCurve = alg === 'ES384' ? 'P-384' : 'P-256'
    const hash = alg === 'ES384' ? 'SHA-384' : 'SHA-256'
    const spkiBuffer = pemToArrayBuffer(secretOrPublicKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      spkiBuffer,
      { name: 'ECDSA', namedCurve },
      false,
      ['verify'],
    )
    return crypto.subtle.verify({ name: 'ECDSA', hash }, cryptoKey, sigBytes.buffer as ArrayBuffer, inputBytes.buffer as ArrayBuffer)
  }

  throw new Error(`Unsupported algorithm for verification: ${alg}`)
}

// ─── Encode helpers ──────────────────────────────────────────────────────────

type Algorithm = 'HS256' | 'HS384' | 'HS512'
const ALGO_HASH: Record<Algorithm, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
}

async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  alg: Algorithm,
): Promise<string> {
  const header = { alg, typ: 'JWT' }
  const headerB64 = encodeBase64Url(JSON.stringify(header))
  const payloadB64 = encodeBase64Url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const keyData = new TextEncoder().encode(secret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: ALGO_HASH[alg] },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${encodeBase64Url(signature)}`
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function JsonBlock({ label, data }: { label: string; data: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-200 leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 py-2 last:border-0">
      <span className="shrink-0 text-xs text-zinc-500">{label}</span>
      <span className="break-all text-right font-mono text-xs text-zinc-300">{value}</span>
    </div>
  )
}

// ─── Decode Tab ──────────────────────────────────────────────────────────────

function DecodeTab() {
  const [token, setToken] = useState('')
  const [decoded, setDecoded] = useState<DecodedToken | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Signature verification state
  const [keyInput, setKeyInput] = useState('')
  const [verificationResult, setVerificationResult] = useState<{
    status: 'idle' | 'valid' | 'invalid' | 'error'
    message?: string
  }>({ status: 'idle' })
  const [isVerifying, setIsVerifying] = useState(false)
  const [clockSkew, setClockSkew] = useState<number>(0)

  useEffect(() => {
    if (!token.trim()) {
      setDecoded(null)
      setError(null)
      setVerificationResult({ status: 'idle' })
      return
    }
    try {
      setDecoded(decodeToken(token))
      setError(null)
      setVerificationResult({ status: 'idle' })
    } catch (e: any) {
      setError(e.message)
      setDecoded(null)
    }
  }, [token])

  const handleVerify = async () => {
    if (!decoded || !keyInput.trim()) return
    setIsVerifying(true)
    try {
      const isValid = await verifyJwtSignature(decoded, keyInput.trim())
      setVerificationResult({
        status: isValid ? 'valid' : 'invalid',
        message: isValid ? 'Signature matches header & payload!' : 'Signature verification failed.',
      })
    } catch (e: any) {
      setVerificationResult({
        status: 'error',
        message: e.message || 'Failed to verify signature with provided key.',
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const handlePemFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      if (typeof evt.target?.result === 'string') {
        setKeyInput(evt.target.result)
      }
    }
    reader.readAsText(file)
  }

  // Claim validation evaluation considering clock skew
  const evalClaims = useCallback(() => {
    if (!decoded) return null
    const now = Date.now()
    const skewMs = clockSkew * 1000
    let isExpired = false
    let isNotBeforeInvalid = false

    if (decoded.expDate) {
      isExpired = now > decoded.expDate.getTime() + skewMs
    }
    if (decoded.nbfDate) {
      isNotBeforeInvalid = now < decoded.nbfDate.getTime() - skewMs
    }
    return { isExpired, isNotBeforeInvalid }
  }, [decoded, clockSkew])

  const claimStatus = evalClaims()

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <label htmlFor="jwt-decode-input" className="block text-sm font-medium text-zinc-300">
          Paste JWT Token
        </label>
        <textarea
          id="jwt-decode-input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.signature"
          spellCheck={false}
          className="h-24 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {decoded && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            {/* Expiry Banner */}
            {decoded.expDate && (
              <div
                className={`flex items-center justify-between gap-3 rounded-lg border p-4 ${
                  claimStatus?.isExpired
                    ? 'border-red-500/20 bg-red-950/10'
                    : 'border-emerald-500/20 bg-emerald-950/10'
                }`}
              >
                <div>
                  <p className={`font-semibold text-sm ${claimStatus?.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                    {claimStatus?.isExpired ? '⛔ Token Expired' : '✅ Token Active'}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Expires {decoded.expDate.toLocaleString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                    claimStatus?.isExpired
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  {claimStatus?.isExpired ? 'Expired' : 'Valid'}
                </span>
              </div>
            )}

            <JsonBlock label="Header — Algorithm & Token Type" data={decoded.header} />
            <JsonBlock label="Payload — Claims" data={decoded.payload} />
          </div>

          <div className="space-y-5">
            {/* Parsed Claims Panel */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Parsed Claims &amp; Timing
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">Clock Skew:</span>
                  <select
                    value={clockSkew}
                    onChange={(e) => setClockSkew(Number(e.target.value))}
                    className="rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value={0}>0s (Strict)</option>
                    <option value={30}>±30s</option>
                    <option value={60}>±60s</option>
                    <option value={300}>±5m</option>
                  </select>
                </div>
              </div>
              <div>
                {decoded.expDate && <MetaRow label="Expiry (exp)" value={decoded.expDate.toISOString()} />}
                {decoded.iatDate && <MetaRow label="Issued At (iat)" value={decoded.iatDate.toISOString()} />}
                {decoded.nbfDate && <MetaRow label="Not Before (nbf)" value={decoded.nbfDate.toISOString()} />}
                {decoded.payload.iss != null && (
                  <MetaRow label="Issuer (iss)" value={String(decoded.payload.iss)} />
                )}
                {decoded.payload.sub != null && (
                  <MetaRow label="Subject (sub)" value={String(decoded.payload.sub)} />
                )}
                {decoded.payload.aud != null && (
                  <MetaRow
                    label="Audience (aud)"
                    value={
                      Array.isArray(decoded.payload.aud)
                        ? (decoded.payload.aud as unknown[]).map(String).join(', ')
                        : String(decoded.payload.aud)
                    }
                  />
                )}
              </div>
            </div>

            {/* Signature Verification Panel */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Signature Verification ({decoded.alg})
                </p>
                {decoded.alg.startsWith('RS') || decoded.alg.startsWith('ES') ? (
                  <label className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer">
                    + Upload .pem / .crt
                    <input
                      type="file"
                      accept=".pem,.crt,.pub,.key"
                      onChange={handlePemFileUpload}
                      className="hidden"
                    />
                  </label>
                ) : null}
              </div>

              <div className="space-y-2">
                <label className="block text-xs text-zinc-400">
                  {decoded.alg.startsWith('HS')
                    ? 'Enter Secret Key (HMAC):'
                    : 'Paste Public Key (PEM / SPKI Format):'}
                </label>
                <textarea
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={
                    decoded.alg.startsWith('HS')
                      ? 'your-256-bit-secret'
                      : '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQE...'
                  }
                  rows={decoded.alg.startsWith('HS') ? 2 : 4}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none resize-y"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleVerify}
                  disabled={!keyInput.trim() || isVerifying}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
                >
                  {isVerifying ? 'Verifying...' : 'Verify Signature'}
                </button>
              </div>

              {verificationResult.status !== 'idle' && (
                <div
                  className={`rounded-lg border p-3 text-xs font-medium ${
                    verificationResult.status === 'valid'
                      ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                      : verificationResult.status === 'invalid'
                        ? 'border-red-500/30 bg-red-950/20 text-red-300'
                        : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
                  }`}
                >
                  {verificationResult.status === 'valid' && '✅ Valid Signature'}
                  {verificationResult.status === 'invalid' && '❌ Invalid Signature'}
                  {verificationResult.status === 'error' && '⚠️ Verification Error'}
                  {verificationResult.message && <p className="mt-1 font-mono text-[11px] opacity-90">{verificationResult.message}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Encode Tab ──────────────────────────────────────────────────────────────

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    sub: '1234567890',
    name: 'John Doe',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  },
  null,
  2,
)

function EncodeTab() {
  const [alg, setAlg] = useState<Algorithm>('HS256')
  const [secret, setSecret] = useState('your-256-bit-secret')
  const [payloadText, setPayloadText] = useState(DEFAULT_PAYLOAD)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSigning, setIsSigning] = useState(false)

  const handleSign = useCallback(async () => {
    setError(null)
    setResult(null)
    if (!secret.trim()) { setError('Secret key is required.'); return }
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(payloadText)
    } catch {
      setError('Payload is not valid JSON.')
      return
    }
    setIsSigning(true)
    try {
      const token = await signJwt(parsed, secret, alg)
      setResult(token)
    } catch (e: any) {
      setError(`Signing failed: ${e.message}`)
    } finally {
      setIsSigning(false)
    }
  }, [alg, secret, payloadText])

  const addTimestamps = () => {
    try {
      const parsed = JSON.parse(payloadText)
      parsed.iat = Math.floor(Date.now() / 1000)
      parsed.exp = Math.floor(Date.now() / 1000) + 3600
      setPayloadText(JSON.stringify(parsed, null, 2))
    } catch {
      setError('Payload is not valid JSON — fix it first.')
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Algorithm</label>
            <div className="flex gap-2">
              {(['HS256', 'HS384', 'HS512'] as Algorithm[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAlg(a)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold border transition ${
                    alg === a
                      ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="jwt-secret" className="block text-sm font-medium text-zinc-300">
              Secret Key
            </label>
            <input
              id="jwt-secret"
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="your-256-bit-secret"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
            <p className="text-xs text-zinc-500">
              Used for HMAC signing. Keep this secret on your server.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="jwt-payload" className="block text-sm font-medium text-zinc-300">
              Payload (JSON Claims)
            </label>
            <button
              type="button"
              onClick={addTimestamps}
              className="text-xs text-emerald-400 hover:text-emerald-300 transition"
            >
              + Add iat / exp
            </button>
          </div>
          <textarea
            id="jwt-payload"
            value={payloadText}
            onChange={(e) => setPayloadText(e.target.value)}
            spellCheck={false}
            className="h-48 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSign}
          disabled={isSigning}
          className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
        >
          {isSigning ? 'Signing…' : 'Sign & Generate JWT'}
        </button>
      </div>

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Signed Token
            </span>
            <CopyButton text={result} label="Copy Token" />
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm leading-relaxed break-all">
            {result.split('.').map((part, i) => (
              <span
                key={i}
                className={[
                  i === 0 ? 'text-red-400' : i === 1 ? 'text-sky-400' : 'text-emerald-400',
                ].join(' ')}
              >
                {part}
                {i < 2 && <span className="text-zinc-600">.</span>}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            <span className="text-red-400">Red</span> = header ·{' '}
            <span className="text-sky-400">Blue</span> = payload ·{' '}
            <span className="text-emerald-400">Green</span> = signature
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Root Component ──────────────────────────────────────────────────────────

export default function JwtTool() {
  const [tab, setTab] = useState<'decode' | 'encode'>('decode')

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">JWT Encoder, Decoder &amp; Verifier</h1>
        <p className="text-sm text-zinc-400">
          Decode, inspect, verify signatures with HMAC or RSA/ECDSA public key PEM files, or generate signed JWTs.
        </p>
      </header>

      <div className="flex gap-6 border-b border-zinc-800">
        {(['decode', 'encode'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`pb-3 text-sm font-semibold border-b-2 -mb-px capitalize transition ${
              tab === t
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'decode' ? 'Decode, Inspect & Verify' : 'Encode & Sign'}
          </button>
        ))}
      </div>

      {tab === 'decode' ? <DecodeTab /> : <EncodeTab />}
    </div>
  )
}
