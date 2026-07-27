import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBuffer(b64url: string): ArrayBuffer {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export type ParsedClientData = {
  type: string
  challenge: string
  origin: string
  crossOrigin?: boolean
}

export function parseClientDataJson(rawJsonOrB64Url: string): ParsedClientData {
  let jsonStr = rawJsonOrB64Url.trim()
  if (!jsonStr.startsWith('{')) {
    // Try Base64URL decode
    const buf = base64UrlToBuffer(jsonStr)
    jsonStr = new TextDecoder().decode(buf)
  }
  const obj = JSON.parse(jsonStr)
  if (!obj.type || !obj.challenge || !obj.origin) {
    throw new Error('Invalid WebAuthn clientDataJSON (missing required type, challenge, or origin).')
  }
  return obj
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PropertyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 py-2.5 last:border-0">
      <span className="shrink-0 text-xs font-medium text-zinc-400">{label}</span>
      <span className="break-all text-right font-mono text-xs text-zinc-200">{value}</span>
    </div>
  )
}

// ─── Browser Capability Tester ───────────────────────────────────────────────

function CapabilityPanel() {
  const [supported, setSupported] = useState<boolean | null>(null)
  const [platformAuth, setPlatformAuth] = useState<boolean | null>(null)
  const [conditionalMediation, setConditionalMediation] = useState<boolean | null>(null)

  useEffect(() => {
    const isWebAuthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential
    setSupported(isWebAuthnSupported)

    if (isWebAuthnSupported) {
      if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().then(setPlatformAuth)
      }
      if (PublicKeyCredential.isConditionalMediationAvailable) {
        PublicKeyCredential.isConditionalMediationAvailable().then(setConditionalMediation)
      }
    }
  }, [])

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
        Browser Passkey Capabilities
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 space-y-1">
          <p className="text-xs text-zinc-400">WebAuthn Support</p>
          <p className={`text-sm font-bold ${supported ? 'text-emerald-400' : 'text-red-400'}`}>
            {supported ? '✅ Supported' : '❌ Not Supported'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 space-y-1">
          <p className="text-xs text-zinc-400">Platform Authenticator</p>
          <p className={`text-sm font-bold ${platformAuth ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {platformAuth === null ? 'Checking…' : platformAuth ? '✅ TouchID / FaceID / Hello' : '⚠️ Not Available'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 space-y-1">
          <p className="text-xs text-zinc-400">Autofill / Conditional UI</p>
          <p className={`text-sm font-bold ${conditionalMediation ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {conditionalMediation === null ? 'Checking…' : conditionalMediation ? '✅ Supported' : '⚠️ Not Supported'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Passkey Registration & Inspection ───────────────────────────────────────

function RegistrationTab() {
  const [username, setUsername] = useState('user@example.com')
  const [displayName, setDisplayName] = useState('Jane Developer')
  const [attachment, setAttachment] = useState<'platform' | 'cross-platform' | 'any'>('any')
  const [createdCredential, setCreatedCredential] = useState<{
    id: string
    rawIdB64: string
    type: string
    clientDataJson: string
    attestationObjectB64: string
    parsedClientData?: ParsedClientData
  } | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRegisterPasskey = async () => {
    setError(null)
    setIsRegistering(true)
    setCreatedCredential(null)

    try {
      if (!window.PublicKeyCredential) throw new Error('WebAuthn Passkeys are not supported in this browser.')

      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const userId = crypto.getRandomValues(new Uint8Array(16))

      const options: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Secure Toolkit Local Dev',
          id: window.location.hostname || 'localhost',
        },
        user: {
          id: userId,
          name: username,
          displayName: displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256
          { alg: -257, type: 'public-key' }, // RS256
        ],
        authenticatorSelection: {
          userVerification: 'preferred',
          ...(attachment !== 'any' ? { authenticatorAttachment: attachment } : {}),
        },
        timeout: 60000,
      }

      const credential = (await navigator.credentials.create({
        publicKey: options,
      })) as PublicKeyCredential

      if (!credential) throw new Error('No credential returned by browser.')

      const response = credential.response as AuthenticatorAttestationResponse
      const clientDataJsonStr = new TextDecoder().decode(response.clientDataJSON)
      const parsedClient = parseClientDataJson(clientDataJsonStr)
      const attestationB64 = bufferToBase64Url(response.attestationObject)

      setCreatedCredential({
        id: credential.id,
        rawIdB64: bufferToBase64Url(credential.rawId),
        type: credential.type,
        clientDataJson: clientDataJsonStr,
        attestationObjectB64: attestationB64,
        parsedClientData: parsedClient,
      })
    } catch (e: any) {
      setError(e.message || 'Passkey creation was canceled or failed.')
    } finally {
      setIsRegistering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Create &amp; Test Local Passkey Credential
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">User Email / ID</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Authenticator Attachment</label>
            <select
              value={attachment}
              onChange={(e) => setAttachment(e.target.value as any)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="any">Any (TouchID, YubiKey, 1Password)</option>
              <option value="platform">Platform Only (TouchID / Windows Hello)</option>
              <option value="cross-platform">Cross-Platform Only (Hardware Key / Phone)</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleRegisterPasskey}
            disabled={isRegistering}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
          >
            {isRegistering ? 'Prompting Authenticator…' : '🔑 Register Test Passkey'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {createdCredential && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-3">
            <h3 className="font-bold text-sm text-emerald-400">
              🎉 Passkey Successfully Registered!
            </h3>
            <PropertyRow label="Credential ID" value={createdCredential.id} />
            <PropertyRow label="Credential Type" value={createdCredential.type} />
            <PropertyRow label="Raw ID (Base64URL)" value={createdCredential.rawIdB64} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* clientDataJSON */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  clientDataJSON (Decoded)
                </span>
                <CopyButton text={createdCredential.clientDataJson} label="Copy JSON" />
              </div>
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-300 leading-relaxed">
                {JSON.stringify(createdCredential.parsedClientData, null, 2)}
              </pre>
            </div>

            {/* attestationObject */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  attestationObject (Base64URL)
                </span>
                <CopyButton text={createdCredential.attestationObjectB64} label="Copy CBOR" />
              </div>
              <textarea
                readOnly
                value={createdCredential.attestationObjectB64}
                rows={8}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-300 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── clientDataJSON Parser ───────────────────────────────────────────────────

function ParserTab() {
  const [inputData, setInputData] = useState('')
  const [parsed, setParsed] = useState<ParsedClientData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParse = useCallback((input: string) => {
    if (!input.trim()) { setParsed(null); setError(null); return }
    try {
      const res = parseClientDataJson(input)
      setParsed(res)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Invalid clientDataJSON.')
      setParsed(null)
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="client-data-input" className="block text-sm font-medium text-zinc-300">
          Paste clientDataJSON (JSON String or Base64URL)
        </label>
        <textarea
          id="client-data-input"
          value={inputData}
          onChange={(e) => {
            setInputData(e.target.value)
            handleParse(e.target.value)
          }}
          placeholder='{"type":"webauthn.create","challenge":"dGhpcyBpcyBhIHRlc3Q...","origin":"http://localhost:5173"}'
          rows={4}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none resize-y"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {parsed && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
            Parsed WebAuthn clientDataJSON
          </p>
          <PropertyRow label="Ceremony Type (type)" value={parsed.type} />
          <PropertyRow label="Challenge (Base64URL)" value={parsed.challenge} />
          <PropertyRow label="Relying Party Origin" value={parsed.origin} />
          {parsed.crossOrigin !== undefined && (
            <PropertyRow label="Cross-Origin Flag" value={String(parsed.crossOrigin)} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PasskeyTool() {
  const [tab, setTab] = useState<'register' | 'parser'>('register')

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Passkey &amp; WebAuthn Inspector</h1>
        <p className="text-sm text-zinc-400">
          Test WebAuthn FIDO2 Passkey credentials locally, inspect authenticators, and parse clientDataJSON payloads.
        </p>
      </header>

      <CapabilityPanel />

      {/* Tabs */}
      <div className="flex gap-6 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('register')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'register'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Test Passkey Registration
        </button>
        <button
          type="button"
          onClick={() => setTab('parser')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'parser'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Parse clientDataJSON
        </button>
      </div>

      {tab === 'register' ? <RegistrationTab /> : <ParserTab />}
    </div>
  )
}
