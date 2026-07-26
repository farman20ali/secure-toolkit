import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!)
  }
  return btoa(binary)
}

function spkiToPem(keyBuffer: ArrayBuffer): string {
  const b64 = arrayBufferToBase64(keyBuffer)
  const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64
  return `-----BEGIN PUBLIC KEY-----\n${formatted}\n-----END PUBLIC KEY-----`
}

function pkcs8ToPem(keyBuffer: ArrayBuffer): string {
  const b64 = arrayBufferToBase64(keyBuffer)
  const formatted = b64.match(/.{1,64}/g)?.join('\n') || b64
  return `-----BEGIN PRIVATE KEY-----\n${formatted}\n-----END PRIVATE KEY-----`
}

type RsaKeyPair = {
  publicKey: string
  privateKey: string
}

export default function RsaGeneratorTool() {
  const [keySize, setKeySize] = useState<1024 | 2048 | 4096>(2048)
  const [keys, setKeys] = useState<RsaKeyPair | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    setKeys(null)

    // Yield to the main thread to show loader
    await new Promise((resolve) => setTimeout(resolve, 50))

    try {
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: keySize,
          publicExponent: new Uint8Array([1, 0, 1]), // 65537
          hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
      )

      const pubExport = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
      const privExport = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

      setKeys({
        publicKey: spkiToPem(pubExport),
        privateKey: pkcs8ToPem(privExport),
      })
    } catch (e: any) {
      setError(`RSA Key Generation failed: ${e.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">RSA Key Pair Generator</h1>
        <p className="text-sm text-zinc-400">
          Generate secure RSA public/private key pairs locally in your browser.
        </p>
      </header>

      {/* Configurations panel */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <label className="text-sm font-semibold text-zinc-300">Key Modulus Size (bits)</label>
          <p className="text-xs text-zinc-500">
            Higher values offer greater security but take longer to generate.
          </p>
          <div className="flex gap-2 pt-2">
            {([1024, 2048, 4096] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setKeySize(size)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold border transition ${
                  keySize === size
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                {size} {size === 2048 ? '(Standard)' : size === 4096 ? '(Ultra Secure)' : '(Legacy)'}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed self-end sm:self-center"
        >
          {isGenerating ? 'Generating Key Pair...' : 'Generate Key Pair'}
        </button>
      </section>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="size-8 animate-spin rounded-full border-4 border-zinc-800 border-t-emerald-500" />
          <p className="text-sm text-zinc-400 animate-pulse">
            Generating cryptographic parameters... (especially 4096-bit keys may take a few seconds)
          </p>
        </div>
      )}

      {/* Output Results */}
      {!isGenerating && keys && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Public Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Public Key (SPKI)</span>
              <div className="flex gap-2">
                <CopyButton text={keys.publicKey} label="Copy" />
                <button
                  type="button"
                  onClick={() => handleDownload(keys.publicKey, 'public_key.pem')}
                  className="rounded-lg border border-zinc-650 bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 transition"
                >
                  Download .pem
                </button>
              </div>
            </div>
            <pre className="h-96 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
              {keys.publicKey}
            </pre>
          </div>

          {/* Private Key */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-400">Private Key (PKCS#8)</span>
              <div className="flex gap-2">
                <CopyButton text={keys.privateKey} label="Copy" />
                <button
                  type="button"
                  onClick={() => handleDownload(keys.privateKey, 'private_key.pem')}
                  className="rounded-lg border border-zinc-650 bg-zinc-800 px-3.5 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-700 transition"
                >
                  Download .pem
                </button>
              </div>
            </div>
            <pre className="h-96 overflow-y-auto rounded-lg border border-zinc-850 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-300">
              {keys.privateKey}
            </pre>
          </div>

          {/* Warning Card */}
          <div className="md:col-span-2 rounded-lg border border-red-500/20 bg-red-950/10 p-4 text-xs text-red-450/90 leading-relaxed">
            <strong className="text-red-400 block mb-1">🛡️ Key Security Warning</strong>
            The private key must never be shared or uploaded. Anyone with access to the private key can decrypt files or forge signatures on your behalf.
          </div>
        </div>
      )}
    </div>
  )
}
