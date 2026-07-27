import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

// ─── MD5 Implementation ──────────────────────────────────────────────────────
function md5(bytes: Uint8Array): Uint8Array {
  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]
  const r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ]

  const len = bytes.length
  const words: number[] = []
  for (let i = 0; i < len; i++) {
    words[i >> 2] = (words[i >> 2] || 0) | (bytes[i]! << ((i % 4) * 8))
  }
  words[len >> 2] = (words[len >> 2] || 0) | (0x80 << ((len % 4) * 8))
  const wlen = ((len + 8) >> 6) * 16 + 14
  words[wlen] = len * 8
  for (let i = (len >> 2) + 1; i <= wlen + 1; i++) {
    if (words[i] === undefined) words[i] = 0
  }

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476

  for (let i = 0; i < wlen + 2; i += 16) {
    let a = h0
    let b = h1
    let c = h2
    let d = h3

    for (let j = 0; j < 64; j++) {
      let f = 0
      let g = 0
      if (j < 16) {
        f = (b & c) | (~b & d)
        g = j
      } else if (j < 32) {
        f = (d & b) | (~d & c)
        g = (5 * j + 1) % 16
      } else if (j < 48) {
        f = b ^ c ^ d
        g = (3 * j + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * j) % 16
      }

      const temp = d
      d = c
      c = b
      const val = (a + f + k[j]! + (words[i + g] || 0)) | 0
      const rot = r[j]!
      b = (b + ((val << rot) | (val >>> (32 - rot)))) | 0
      a = temp
    }

    h0 = (h0 + a) | 0
    h1 = (h1 + b) | 0
    h2 = (h2 + c) | 0
    h3 = (h3 + d) | 0
  }

  const out = new Uint8Array(16)
  const writeInt = (n: number, offset: number) => {
    out[offset] = n & 0xff
    out[offset + 1] = (n >> 8) & 0xff
    out[offset + 2] = (n >> 16) & 0xff
    out[offset + 3] = (n >> 24) & 0xff
  }
  writeInt(h0, 0)
  writeInt(h1, 4)
  writeInt(h2, 8)
  writeInt(h3, 12)
  return out
}

function hmacMd5(keyBytes: Uint8Array, messageBytes: Uint8Array): Uint8Array {
  const blockSize = 64
  let k = keyBytes
  if (k.length > blockSize) {
    k = md5(k)
  }
  const keyPadded = new Uint8Array(blockSize)
  keyPadded.set(k)

  const ipad = new Uint8Array(blockSize)
  const opad = new Uint8Array(blockSize)
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyPadded[i]! ^ 0x36
    opad[i] = keyPadded[i]! ^ 0x5c
  }

  const inner = new Uint8Array(blockSize + messageBytes.length)
  inner.set(ipad, 0)
  inner.set(messageBytes, blockSize)
  const innerHash = md5(inner)

  const outer = new Uint8Array(blockSize + 16)
  outer.set(opad, 0)
  outer.set(innerHash, blockSize)
  return md5(outer)
}

// ─── Formatters ──────────────────────────────────────────────────────────────
function bufferToFormat(
  buffer: ArrayBuffer | Uint8Array,
  format: 'hex-lower' | 'hex-upper' | 'base64',
): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  if (format === 'base64') {
    let bin = ''
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    return btoa(bin)
  }
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i]!.toString(16).padStart(2, '0')
  }
  return format === 'hex-upper' ? hex.toUpperCase() : hex.toLowerCase()
}

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512'
type FormatOption = 'hex-lower' | 'hex-upper' | 'base64'

const ALL_ALGORITHMS: { id: HashAlgorithm; label: string; legacy?: boolean }[] = [
  { id: 'sha256', label: 'SHA-256' },
  { id: 'sha512', label: 'SHA-512' },
  { id: 'sha384', label: 'SHA-384' },
  { id: 'sha1', label: 'SHA-1', legacy: true },
  { id: 'md5', label: 'MD5', legacy: true },
]

export default function HashGeneratorTool() {
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  
  // Customization options
  const [selectedAlgs, setSelectedAlgs] = useState<Record<HashAlgorithm, boolean>>({
    sha256: true,
    sha512: true,
    sha384: true,
    sha1: true,
    md5: true,
  })
  const [isHmac, setIsHmac] = useState(false)
  const [hmacSecret, setHmacSecret] = useState('')
  const [format, setFormat] = useState<FormatOption>('hex-lower')
  const [expectedHash, setExpectedHash] = useState('')

  const [hashes, setHashes] = useState<Partial<Record<HashAlgorithm, string>> | null>(null)
  const [isHashing, setIsHashing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computeHashes = useCallback(async (data: ArrayBuffer) => {
    setIsHashing(true)
    setError(null)
    const u8 = new Uint8Array(data)
    const secretBytes = new TextEncoder().encode(hmacSecret)
    const results: Partial<Record<HashAlgorithm, string>> = {}

    try {
      if (isHmac) {
        // HMAC calculation
        if (selectedAlgs.md5) {
          const md5Res = hmacMd5(secretBytes, u8)
          results.md5 = bufferToFormat(md5Res, format)
        }
        const cryptoAlgs: { id: HashAlgorithm; name: string }[] = [
          { id: 'sha1', name: 'SHA-1' },
          { id: 'sha256', name: 'SHA-256' },
          { id: 'sha384', name: 'SHA-384' },
          { id: 'sha512', name: 'SHA-512' },
        ]
        for (const item of cryptoAlgs) {
          if (selectedAlgs[item.id]) {
            const cryptoKey = await crypto.subtle.importKey(
              'raw',
              secretBytes,
              { name: 'HMAC', hash: item.name },
              false,
              ['sign'],
            )
            const sig = await crypto.subtle.sign('HMAC', cryptoKey, data)
            results[item.id] = bufferToFormat(sig, format)
          }
        }
      } else {
        // Plain digest calculation
        if (selectedAlgs.md5) {
          const md5Res = md5(u8)
          results.md5 = bufferToFormat(md5Res, format)
        }
        const cryptoAlgs: { id: HashAlgorithm; name: string }[] = [
          { id: 'sha1', name: 'SHA-1' },
          { id: 'sha256', name: 'SHA-256' },
          { id: 'sha384', name: 'SHA-384' },
          { id: 'sha512', name: 'SHA-512' },
        ]
        for (const item of cryptoAlgs) {
          if (selectedAlgs[item.id]) {
            const buf = await crypto.subtle.digest(item.name, data)
            results[item.id] = bufferToFormat(buf, format)
          }
        }
      }
      setHashes(results)
    } catch (e: any) {
      setError(`Hashing error: ${e.message}`)
      setHashes(null)
    } finally {
      setIsHashing(false)
    }
  }, [isHmac, hmacSecret, selectedAlgs, format])

  useEffect(() => {
    if (inputMode === 'text') {
      if (!text) {
        setHashes(null)
        return
      }
      const buffer = new TextEncoder().encode(text).buffer
      computeHashes(buffer)
    }
  }, [text, inputMode, computeHashes])

  useEffect(() => {
    if (inputMode === 'file' && file) {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          computeHashes(reader.result)
        }
      }
      reader.onerror = () => {
        setError('Failed to read the file.')
      }
      reader.readAsArrayBuffer(file)
    } else if (inputMode === 'file' && !file) {
      setHashes(null)
    }
  }, [file, inputMode, computeHashes])

  const toggleAlg = (id: HashAlgorithm) => {
    setSelectedAlgs((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const matchAlgorithm = (): { matched: boolean; algName?: string } => {
    if (!expectedHash.trim() || !hashes) return { matched: false }
    const cleanedInput = expectedHash.trim().toLowerCase()
    for (const [alg, val] of Object.entries(hashes)) {
      if (val && val.toLowerCase() === cleanedInput) {
        return { matched: true, algName: alg.toUpperCase() }
      }
    }
    return { matched: false }
  }

  const matchStatus = matchAlgorithm()

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Hash &amp; Checksum Generator</h1>
        <p className="text-sm text-zinc-400">
          Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512 and HMAC signatures with custom formats. 100% client-side.
        </p>
      </header>

      {/* Primary Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        {/* Mode Selector */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setInputMode('text'); setFile(null) }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === 'text'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Text Input
          </button>
          <button
            type="button"
            onClick={() => { setInputMode('file'); setText('') }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === 'file'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            File Drag &amp; Drop
          </button>
        </div>

        {/* Format Selector */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Output Digest:</span>
          {(
            [
              { id: 'hex-lower', label: 'hex' },
              { id: 'hex-upper', label: 'HEX' },
              { id: 'base64', label: 'Base64' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFormat(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                format === f.id
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Features & Options Bar */}
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">Algorithm &amp; HMAC Controls</p>

        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-zinc-800/60 pb-4">
          {/* Checkboxes for algorithms */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs text-zinc-400">Active Hashes:</span>
            {ALL_ALGORITHMS.map((a) => (
              <label key={a.id} className="flex cursor-pointer items-center gap-2 text-xs font-medium text-zinc-300 hover:text-zinc-100">
                <input
                  type="checkbox"
                  checked={selectedAlgs[a.id]}
                  onChange={() => toggleAlg(a.id)}
                  className="size-3.5 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
                />
                <span>{a.label}</span>
                {a.legacy && (
                  <span className="rounded bg-amber-500/10 px-1 text-[9px] text-amber-400 border border-amber-500/20">
                    legacy
                  </span>
                )}
              </label>
            ))}
          </div>

          {/* HMAC Toggle */}
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-zinc-300 hover:text-zinc-100">
            <input
              type="checkbox"
              checked={isHmac}
              onChange={(e) => setIsHmac(e.target.checked)}
              className="size-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
            />
            <span className="text-emerald-400">Enable HMAC Mode</span>
          </label>
        </div>

        {/* Secret Key Input if HMAC is enabled */}
        {isHmac && (
          <div className="space-y-1.5 pt-1">
            <label htmlFor="hmac-secret-key" className="block text-xs font-semibold text-zinc-300">
              HMAC Secret Key
            </label>
            <input
              id="hmac-secret-key"
              type="text"
              value={hmacSecret}
              onChange={(e) => setHmacSecret(e.target.value)}
              placeholder="Enter secret key for HMAC calculation..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2.5 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Input area */}
      {inputMode === 'text' ? (
        <div className="space-y-2">
          <label htmlFor="hash-text-input" className="block text-sm font-medium text-zinc-300">
            Input Text
          </label>
          <textarea
            id="hash-text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste text here to hash in real-time..."
            className="h-32 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
          />
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Select Local File</label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0])
            }}
            className="flex h-36 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-750 bg-zinc-950/40 hover:bg-zinc-950/80 transition cursor-pointer relative"
          >
            <input
              type="file"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) setFile(e.target.files[0])
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Upload local file to hash"
            />
            <div className="text-center space-y-1 select-none pointer-events-none">
              <p className="text-sm text-zinc-300">
                {file ? `Selected file: ${file.name}` : 'Drag & drop a file here, or click to browse'}
              </p>
              {file && (
                <p className="text-xs text-zinc-500">
                  Size: {(file.size / 1024).toFixed(2)} KB
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Checksum Matcher / Verifier Box */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
        <label htmlFor="expected-hash-input" className="block text-xs font-bold uppercase tracking-widest text-zinc-500">
          Verify / Match Checksum
        </label>
        <div className="flex gap-3">
          <input
            id="expected-hash-input"
            type="text"
            value={expectedHash}
            onChange={(e) => setExpectedHash(e.target.value)}
            placeholder="Paste expected hash checksum to compare against computed outputs..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
        {expectedHash.trim() && hashes && (
          <div>
            {matchStatus.matched ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-4 py-2.5 text-xs font-semibold text-emerald-400 flex items-center justify-between">
                <span>✅ Checksum match found! Fits computed {matchStatus.algName} hash.</span>
              </div>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-950/20 px-4 py-2.5 text-xs font-semibold text-red-400">
                ❌ Expected checksum does not match any computed outputs above.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Computed Outputs */}
      {isHashing && (
        <div className="text-center py-6 text-zinc-400 text-sm font-medium">
          Computing hashes...
        </div>
      )}

      {!isHashing && hashes && (
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">
            Computed {isHmac ? 'HMAC Signatures' : 'Checksums'}
          </h2>

          <div className="space-y-3">
            {ALL_ALGORITHMS.map((alg) => {
              const hashValue = hashes[alg.id]
              if (!selectedAlgs[alg.id] || !hashValue) return null
              const isMatchedAlg = expectedHash.trim() && matchStatus.matched && matchStatus.algName === alg.label

              return (
                <div key={alg.id} className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
                  <div className="w-28 shrink-0 flex items-center gap-1.5 font-medium text-zinc-400 text-xs uppercase tracking-wider">
                    {alg.label}
                    {alg.legacy && (
                      <span className="bg-amber-500/10 text-[9px] text-amber-400 rounded px-1 lowercase font-normal border border-amber-500/20">
                        legacy
                      </span>
                    )}
                  </div>
                  <div
                    className={`flex-1 flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 border font-mono text-sm break-all select-all transition ${
                      isMatchedAlg
                        ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'border-zinc-800 text-emerald-400'
                    }`}
                  >
                    <span>{hashValue}</span>
                    <CopyButton text={hashValue} label="Copy" />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
