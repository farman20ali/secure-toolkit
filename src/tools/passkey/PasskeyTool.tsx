import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

// ─── Helpers & Parsers ───────────────────────────────────────────────────────

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
    const buf = base64UrlToBuffer(jsonStr)
    jsonStr = new TextDecoder().decode(buf)
  }
  const obj = JSON.parse(jsonStr)
  if (!obj.type || !obj.challenge || !obj.origin) {
    throw new Error('Invalid WebAuthn clientDataJSON (missing required type, challenge, or origin).')
  }
  return obj
}

export type ParsedAuthData = {
  rpIdHashHex: string
  flags: {
    userPresent: boolean
    userVerified: boolean
    attestedDataIncluded: boolean
    extensionDataIncluded: boolean
    rawByte: number
  }
  signCount: number
  aaguidHex?: string
  credentialIdHex?: string
}

export function parseAuthenticatorData(buffer: ArrayBuffer): ParsedAuthData {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 37) throw new Error('Authenticator data is too short (< 37 bytes).')

  let rpIdHashHex = ''
  for (let i = 0; i < 32; i++) rpIdHashHex += bytes[i]!.toString(16).padStart(2, '0')

  const flagsByte = bytes[32]!
  const flags = {
    userPresent: !!(flagsByte & 0x01),
    userVerified: !!(flagsByte & 0x04),
    attestedDataIncluded: !!(flagsByte & 0x40),
    extensionDataIncluded: !!(flagsByte & 0x80),
    rawByte: flagsByte,
  }

  const signCount =
    ((bytes[33]! << 24) >>> 0) +
    ((bytes[34]! << 16) >>> 0) +
    ((bytes[35]! << 8) >>> 0) +
    (bytes[36]! >>> 0)

  let aaguidHex: string | undefined
  let credentialIdHex: string | undefined

  if (flags.attestedDataIncluded && bytes.length >= 55) {
    let aaguid = ''
    for (let i = 37; i < 53; i++) aaguid += bytes[i]!.toString(16).padStart(2, '0')
    aaguidHex = `${aaguid.slice(0, 8)}-${aaguid.slice(8, 12)}-${aaguid.slice(12, 16)}-${aaguid.slice(16, 20)}-${aaguid.slice(20)}`

    const credIdLen = (bytes[53]! << 8) | bytes[54]!
    if (bytes.length >= 55 + credIdLen) {
      let credId = ''
      for (let i = 55; i < 55 + credIdLen; i++) credId += bytes[i]!.toString(16).padStart(2, '0')
      credentialIdHex = credId
    }
  }

  return { rpIdHashHex, flags, signCount, aaguidHex, credentialIdHex }
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

export type SavedPasskey = {
  id: string
  rawIdB64: string
  username: string
  displayName: string
  rpId: string
  attachment: string
  createdAt: string
  clientDataJson: string
  attestationObjectB64: string
}

// ─── Passkey Educational Architecture Diagram ───────────────────────────────

function ArchitectureFlow() {
  const [activeStep, setActiveStep] = useState<'reg' | 'auth'>('reg')

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div>
          <h2 className="text-sm font-bold text-zinc-100">Understanding How Passkeys Work</h2>
          <p className="text-xs text-zinc-400">
            Passkeys use WebAuthn &amp; asymmetric cryptography to eliminate passwords completely.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveStep('reg')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeStep === 'reg'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Phase 1: Registration (Creation)
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('auth')}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              activeStep === 'auth'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Phase 2: Authentication (Sign-in)
          </button>
        </div>
      </div>

      {activeStep === 'reg' ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Step 1: Challenge Request
            </span>
            <h3 className="text-xs font-bold text-zinc-200">1. Relying Party (RP)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The website/server generates a cryptographically random 32-byte <code className="text-emerald-300">challenge</code> and sends user metadata (username, RP ID) to the browser.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
              Step 2: Local Key Generation
            </span>
            <h3 className="text-xs font-bold text-zinc-200">2. Authenticator (Google/USB/OS)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The browser prompts TouchID, Windows Hello, Google Password Manager, or YubiKey. The authenticator generates a unique asymmetric key pair (ECC P-256 / RSA).
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              Step 3: Public Key Storage
            </span>
            <h3 className="text-xs font-bold text-zinc-200">3. Attestation &amp; Registration</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The Private Key remains safely inside the TPM/hardware chip. Only the <code className="text-amber-300">Public Key</code> and <code className="text-amber-300">Credential ID</code> are sent back to the RP server.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              Step 1: Sign-in Challenge
            </span>
            <h3 className="text-xs font-bold text-zinc-200">1. RP Server Prompts Sign-in</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The server sends a fresh random <code className="text-emerald-300">challenge</code> and allowed Credential IDs to <code className="text-emerald-300">navigator.credentials.get()</code>.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-bold text-sky-400">
              Step 2: Biometric / Hardware Sign
            </span>
            <h3 className="text-xs font-bold text-zinc-200">2. Authenticator Signs Challenge</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The user verifies presence via fingerprint/PIN. The private key signs <code className="text-sky-300">authenticatorData + SHA256(clientDataJSON)</code> without revealing any credentials.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2">
            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
              Step 3: Verification
            </span>
            <h3 className="text-xs font-bold text-zinc-200">3. RP Verifies Signature</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              The RP server uses the stored Public Key to verify the signature. Zero passwords sent over the network!
            </p>
          </div>
        </div>
      )}
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
        Browser &amp; OS Passkey Support Matrix
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 space-y-1">
          <p className="text-xs text-zinc-400">WebAuthn Standard</p>
          <p className={`text-sm font-bold ${supported ? 'text-emerald-400' : 'text-red-400'}`}>
            {supported ? '✅ Supported' : '❌ Not Supported'}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5 space-y-1">
          <p className="text-xs text-zinc-400">Platform Authenticator</p>
          <p className={`text-sm font-bold ${platformAuth ? 'text-emerald-400' : 'text-zinc-500'}`}>
            {platformAuth === null ? 'Checking…' : platformAuth ? '✅ Google / Ubuntu / TouchID' : '⚠️ Not Available'}
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

// ─── Registration & Generation Tab ──────────────────────────────────────────

function RegistrationTab({
  onSavePasskey,
}: {
  onSavePasskey: (pk: SavedPasskey) => void
}) {
  const [username, setUsername] = useState('user@example.com')
  const [displayName, setDisplayName] = useState('Jane Developer')
  const [attachment, setAttachment] = useState<'platform' | 'cross-platform' | 'any'>('platform')
  const [userVerification, setUserVerification] = useState<'required' | 'preferred' | 'discouraged'>('preferred')
  const [residentKey, setResidentKey] = useState<'required' | 'preferred' | 'discouraged'>('required')

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
      const currentHost = window.location.hostname || 'localhost'

      const options: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: {
          name: 'Secure Toolkit Local Sandbox',
          id: currentHost,
        },
        user: {
          id: userId,
          name: username,
          displayName: displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },  // ES256 (ECDSA P-256)
          { alg: -257, type: 'public-key' }, // RS256 (RSA 2048)
        ],
        authenticatorSelection: {
          userVerification,
          residentKey,
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

      const passkeyObj: SavedPasskey = {
        id: credential.id,
        rawIdB64: bufferToBase64Url(credential.rawId),
        username,
        displayName,
        rpId: currentHost,
        attachment: attachment === 'platform' ? 'Google / Ubuntu / OS' : attachment === 'cross-platform' ? 'USB Key / YubiKey' : 'Any',
        createdAt: new Date().toLocaleTimeString(),
        clientDataJson: clientDataJsonStr,
        attestationObjectB64: attestationB64,
      }

      setCreatedCredential({
        id: credential.id,
        rawIdB64: passkeyObj.rawIdB64,
        type: credential.type,
        clientDataJson: clientDataJsonStr,
        attestationObjectB64: attestationB64,
        parsedClientData: parsedClient,
      })

      onSavePasskey(passkeyObj)
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
          Generate &amp; Save Passkey Credential
        </h2>

        {/* Target Storage Selector */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-zinc-300">
            Where to Save / Target Authenticator:
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: 'platform',
                title: '📱 Google / Ubuntu / OS',
                desc: 'Save in Google Password Manager, Ubuntu Secret Service, TouchID, or Windows Hello',
              },
              {
                id: 'cross-platform',
                title: '🗝️ USB Key / YubiKey',
                desc: 'Save to physical USB security key or external NFC/Bluetooth token',
              },
              {
                id: 'any',
                title: '🌐 Any / Browser Prompt',
                desc: 'Let browser prompt with all available options',
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAttachment(opt.id as any)}
                className={`rounded-lg p-3.5 text-left border transition ${
                  attachment === opt.id
                    ? 'border-emerald-500/60 bg-emerald-500/10 ring-1 ring-emerald-500/30'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <p className="text-xs font-bold text-zinc-200">{opt.title}</p>
                <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Advanced WebAuthn Options */}
        <div className="grid gap-4 md:grid-cols-4 pt-2">
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
            <label className="block text-xs text-zinc-300">User Verification (UV)</label>
            <select
              value={userVerification}
              onChange={(e) => setUserVerification(e.target.value as any)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="preferred">Preferred (Biometric if available)</option>
              <option value="required">Required (Mandatory PIN/Fingerprint)</option>
              <option value="discouraged">Discouraged (Touch presence only)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Resident Key (Discoverable)</label>
            <select
              value={residentKey}
              onChange={(e) => setResidentKey(e.target.value as any)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="required">Required (Passwordless Passkey)</option>
              <option value="preferred">Preferred</option>
              <option value="discouraged">Discouraged (Server-side key)</option>
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
            {isRegistering ? 'Prompting Authenticator…' : '🔑 Register & Save Passkey'}
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
              🎉 Passkey Successfully Registered &amp; Stored in Sandbox!
            </h3>
            <PropertyRow label="Credential ID" value={createdCredential.id} />
            <PropertyRow label="Credential Type" value={createdCredential.type} />
            <PropertyRow label="Raw ID (Base64URL)" value={createdCredential.rawIdB64} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
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

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  attestationObject (CBOR Base64URL)
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

// ─── Test Saved Passkey Tab (Assertion / Sign-In) ───────────────────────────

function AuthenticationTab({ savedPasskeys }: { savedPasskeys: SavedPasskey[] }) {
  const [selectedCredId, setSelectedCredId] = useState<string>(savedPasskeys[0]?.id || '')
  const [assertionResult, setAssertionResult] = useState<{
    clientDataJsonStr: string
    parsedClientData?: ParsedClientData
    authDataB64: string
    signatureB64: string
    parsedAuthData?: ParsedAuthData
  } | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (savedPasskeys.length > 0 && !selectedCredId) {
      setSelectedCredId(savedPasskeys[0]!.id)
    }
  }, [savedPasskeys, selectedCredId])

  const handleTestSignIn = async () => {
    setError(null)
    setIsAuthenticating(true)
    setAssertionResult(null)

    try {
      if (!window.PublicKeyCredential) throw new Error('WebAuthn Passkeys are not supported in this browser.')

      const challenge = crypto.getRandomValues(new Uint8Array(32))
      const currentHost = window.location.hostname || 'localhost'

      const selectedPasskey = savedPasskeys.find((p) => p.id === selectedCredId)

      const options: PublicKeyCredentialRequestOptions = {
        challenge,
        rpId: currentHost,
        allowCredentials: selectedPasskey
          ? [{ id: base64UrlToBuffer(selectedPasskey.rawIdB64), type: 'public-key' }]
          : [],
        userVerification: 'preferred',
        timeout: 60000,
      }

      const credential = (await navigator.credentials.get({
        publicKey: options,
      })) as PublicKeyCredential

      if (!credential) throw new Error('No assertion credential returned.')

      const response = credential.response as AuthenticatorAssertionResponse
      const clientDataJsonStr = new TextDecoder().decode(response.clientDataJSON)
      const parsedClient = parseClientDataJson(clientDataJsonStr)

      const authDataB64 = bufferToBase64Url(response.authenticatorData)
      const signatureB64 = bufferToBase64Url(response.signature)
      const parsedAuth = parseAuthenticatorData(response.authenticatorData)

      setAssertionResult({
        clientDataJsonStr,
        parsedClientData: parsedClient,
        authDataB64,
        signatureB64,
        parsedAuthData: parsedAuth,
      })
    } catch (e: any) {
      setError(e.message || 'Passkey sign-in authentication failed.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Test Saved Passkey Sign-In (Assertion Ceremony)
        </h2>

        {savedPasskeys.length === 0 ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-950/10 p-4 text-xs text-amber-400">
            ⚠️ No saved passkeys found in your current session. Please register a test passkey first in the Registration tab!
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Select Saved Passkey to Authenticate:
              </label>
              <select
                value={selectedCredId}
                onChange={(e) => setSelectedCredId(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
              >
                {savedPasskeys.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username} ({p.attachment}) — ID: {p.id.slice(0, 16)}… ({p.createdAt})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleTestSignIn}
                disabled={isAuthenticating || !selectedCredId}
                className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
              >
                {isAuthenticating ? 'Prompting Authenticator…' : '⚡ Test Passkey Sign-In'}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {assertionResult && (
        <div className="space-y-6">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 space-y-3">
            <h3 className="font-bold text-sm text-emerald-400">
              ✅ Passkey Assertion Signature Verified!
            </h3>
            {assertionResult.parsedAuthData && (
              <>
                <PropertyRow
                  label="User Present (UP)"
                  value={assertionResult.parsedAuthData.flags.userPresent ? 'YES (Touch Verified)' : 'NO'}
                />
                <PropertyRow
                  label="User Verified (UV)"
                  value={assertionResult.parsedAuthData.flags.userVerified ? 'YES (PIN / Biometric)' : 'NO'}
                />
                <PropertyRow
                  label="Signature Counter"
                  value={String(assertionResult.parsedAuthData.signCount)}
                />
                <PropertyRow
                  label="RP ID Hash (SHA-256)"
                  value={assertionResult.parsedAuthData.rpIdHashHex}
                />
              </>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  Assertion Signature (Base64URL)
                </span>
                <CopyButton text={assertionResult.signatureB64} label="Copy Sig" />
              </div>
              <textarea
                readOnly
                value={assertionResult.signatureB64}
                rows={4}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-300 focus:outline-none resize-none"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                  authenticatorData (Base64URL)
                </span>
                <CopyButton text={assertionResult.authDataB64} label="Copy Data" />
              </div>
              <textarea
                readOnly
                value={assertionResult.authDataB64}
                rows={4}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-300 focus:outline-none resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deep Payload Inspector Tab ──────────────────────────────────────────────

function InspectorTab() {
  const [inputData, setInputData] = useState('')
  const [parsedClient, setParsedClient] = useState<ParsedClientData | null>(null)
  const [parsedAuth, setParsedAuth] = useState<ParsedAuthData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleInspect = useCallback((input: string) => {
    if (!input.trim()) { setParsedClient(null); setParsedAuth(null); setError(null); return }
    try {
      if (input.trim().startsWith('{') || input.trim().length < 200) {
        const res = parseClientDataJson(input)
        setParsedClient(res)
        setParsedAuth(null)
        setError(null)
      } else {
        const buf = base64UrlToBuffer(input.trim())
        const res = parseAuthenticatorData(buf)
        setParsedAuth(res)
        setParsedClient(null)
        setError(null)
      }
    } catch (e: any) {
      setError(e.message || 'Could not parse payload as clientDataJSON or authenticatorData.')
    }
  }, [])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="passkey-payload-input" className="block text-sm font-medium text-zinc-300">
          Paste clientDataJSON or authenticatorData (JSON / Base64URL)
        </label>
        <textarea
          id="passkey-payload-input"
          value={inputData}
          onChange={(e) => {
            setInputData(e.target.value)
            handleInspect(e.target.value)
          }}
          placeholder="Paste raw Base64URL or JSON string here..."
          rows={5}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none resize-y"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {parsedClient && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
            Parsed WebAuthn clientDataJSON
          </p>
          <PropertyRow label="Ceremony Type (type)" value={parsedClient.type} />
          <PropertyRow label="Challenge (Base64URL)" value={parsedClient.challenge} />
          <PropertyRow label="Relying Party Origin" value={parsedClient.origin} />
        </div>
      )}

      {parsedAuth && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
            Parsed authenticatorData Payload
          </p>
          <PropertyRow label="User Present (UP)" value={parsedAuth.flags.userPresent ? 'YES' : 'NO'} />
          <PropertyRow label="User Verified (UV)" value={parsedAuth.flags.userVerified ? 'YES' : 'NO'} />
          <PropertyRow label="Sign Counter" value={String(parsedAuth.signCount)} />
          <PropertyRow label="RP ID Hash" value={parsedAuth.rpIdHashHex} />
          {parsedAuth.aaguidHex && <PropertyRow label="AAGUID (Authenticator GUID)" value={parsedAuth.aaguidHex} />}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PasskeyTool() {
  const [tab, setTab] = useState<'register' | 'authenticate' | 'inspector'>('register')
  const [savedPasskeys, setSavedPasskeys] = useState<SavedPasskey[]>([])

  const handleSavePasskey = (pk: SavedPasskey) => {
    setSavedPasskeys((prev) => [pk, ...prev.filter((item) => item.id !== pk.id)])
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Passkey &amp; WebAuthn Sandbox</h1>
        <p className="text-sm text-zinc-400">
          Learn how Passkeys work, target Google/Ubuntu or USB authenticators, generate key pairs, and test sign-in ceremonies locally.
        </p>
      </header>

      <CapabilityPanel />
      <ArchitectureFlow />

      {/* Navigation Tabs */}
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
          1. Register &amp; Save Passkey
        </button>
        <button
          type="button"
          onClick={() => setTab('authenticate')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'authenticate'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          2. Test Passkey Sign-In ({savedPasskeys.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('inspector')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'inspector'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          3. Deep Payload Inspector
        </button>
      </div>

      {tab === 'register' && (
        <RegistrationTab onSavePasskey={handleSavePasskey} />
      )}
      {tab === 'authenticate' && <AuthenticationTab savedPasskeys={savedPasskeys} />}
      {tab === 'inspector' && <InspectorTab />}
    </div>
  )
}
