import { useState, useEffect } from 'react'

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i)
  }
  return new TextDecoder('utf-8').decode(bytes)
}

type DecodedToken = {
  header: any
  payload: any
  signature: string
  expired: boolean | null
  expDate: Date | null
  iatDate: Date | null
  nbfDate: Date | null
}

export default function JwtDecoderTool() {
  const [token, setToken] = useState('')
  const [decoded, setDecoded] = useState<DecodedToken | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token.trim()) {
      setDecoded(null)
      setError(null)
      return
    }

    try {
      const parts = token.trim().split('.')
      if (parts.length !== 3) {
        throw new Error('JWT must contain 3 parts separated by dots.')
      }

      const headerDecoded = JSON.parse(decodeBase64Url(parts[0]!))
      const payloadDecoded = JSON.parse(decodeBase64Url(parts[1]!))
      const signature = parts[2]!

      let expired: boolean | null = null
      let expDate: Date | null = null
      let iatDate: Date | null = null
      let nbfDate: Date | null = null

      if (typeof payloadDecoded.exp === 'number') {
        expDate = new Date(payloadDecoded.exp * 1000)
        expired = Date.now() > expDate.getTime()
      }
      if (typeof payloadDecoded.iat === 'number') {
        iatDate = new Date(payloadDecoded.iat * 1000)
      }
      if (typeof payloadDecoded.nbf === 'number') {
        nbfDate = new Date(payloadDecoded.nbf * 1000)
      }

      setDecoded({
        header: headerDecoded,
        payload: payloadDecoded,
        signature,
        expired,
        expDate,
        iatDate,
        nbfDate,
      })
      setError(null)
    } catch (e: any) {
      setError(`Failed to decode JWT: ${e.message}`)
      setDecoded(null)
    }
  }, [token])

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">JWT Decoder</h1>
        <p className="text-sm text-zinc-400">
          Decode and inspect JSON Web Tokens locally. Your token never leaves your browser.
        </p>
      </header>

      {/* Input Textarea */}
      <div className="space-y-2">
        <label htmlFor="jwt-input" className="block text-sm font-medium text-zinc-300">
          Encoded JWT Token
        </label>
        <textarea
          id="jwt-input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste encoded JWT (header.payload.signature) here..."
          className="h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Results Panel */}
      {decoded && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Decoded segments */}
          <div className="space-y-6">
            {/* Expiration Banner */}
            {decoded.expDate && (
              <div
                className={`rounded-lg border p-4 flex items-center justify-between gap-3 text-sm ${
                  decoded.expired
                    ? 'border-red-500/20 bg-red-950/10 text-red-450'
                    : 'border-emerald-500/20 bg-emerald-950/10 text-emerald-400'
                }`}
              >
                <div>
                  <span className="font-semibold">{decoded.expired ? 'Token Expired' : 'Token Active'}</span>
                  <p className="text-xs text-zinc-400 mt-1">
                    Expires on {decoded.expDate.toLocaleString()}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  decoded.expired ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                }`}>
                  {decoded.expired ? 'Expired' : 'Valid'}
                </span>
              </div>
            )}

            {/* Header */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Header: Algorithm & Token Type</span>
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-200">
                {JSON.stringify(decoded.header, null, 2)}
              </pre>
            </div>

            {/* Payload */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400">Payload: Data / Claims</span>
              <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-zinc-200">
                {JSON.stringify(decoded.payload, null, 2)}
              </pre>
            </div>
          </div>

          {/* Metadata and Explanations */}
          <div className="space-y-6 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
            <h2 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">
              Token Properties & Claims
            </h2>

            <div className="space-y-3.5 text-sm">
              {decoded.expDate && (
                <div className="flex justify-between border-b border-zinc-850 pb-2">
                  <span className="text-zinc-500">Expiration (exp)</span>
                  <span className="font-mono text-zinc-300">{decoded.expDate.toISOString()}</span>
                </div>
              )}
              {decoded.iatDate && (
                <div className="flex justify-between border-b border-zinc-850 pb-2">
                  <span className="text-zinc-500">Issued At (iat)</span>
                  <span className="font-mono text-zinc-300">{decoded.iatDate.toISOString()}</span>
                </div>
              )}
              {decoded.nbfDate && (
                <div className="flex justify-between border-b border-zinc-850 pb-2">
                  <span className="text-zinc-500">Not Before (nbf)</span>
                  <span className="font-mono text-zinc-300">{decoded.nbfDate.toISOString()}</span>
                </div>
              )}
              {decoded.payload.iss && (
                <div className="flex justify-between border-b border-zinc-850 pb-2">
                  <span className="text-zinc-500">Issuer (iss)</span>
                  <span className="font-mono text-zinc-300">{decoded.payload.iss}</span>
                </div>
              )}
              {decoded.payload.sub && (
                <div className="flex justify-between border-b border-zinc-850 pb-2">
                  <span className="text-zinc-500">Subject (sub)</span>
                  <span className="font-mono text-zinc-300">{decoded.payload.sub}</span>
                </div>
              )}
              {decoded.payload.aud && (
                <div className="flex justify-between border-b border-zinc-850 pb-2">
                  <span className="text-zinc-500">Audience (aud)</span>
                  <span className="font-mono text-zinc-300">
                    {Array.isArray(decoded.payload.aud) ? decoded.payload.aud.join(', ') : decoded.payload.aud}
                  </span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-500/10 bg-amber-500/5 p-4 text-xs text-amber-300/90 space-y-2 leading-relaxed">
              <span className="font-semibold block text-amber-400">⚠️ Signature Warning</span>
              <p>
                This tool decodes the JWT claims for local inspection. It does NOT verify the cryptographic signature.
              </p>
              <p>
                To fully verify the token, it must be validated by your backend using the public key or shared secret.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
