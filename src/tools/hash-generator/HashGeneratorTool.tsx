import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

// Self-contained MD5 implementation for Uint8Array
function md5(bytes: Uint8Array): string {
  const k = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
  ]
  const r = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
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

  const toHex = (n: number) => {
    let s = ''
    for (let i = 0; i < 4; i++) {
      s += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    }
    return s
  }
  return toHex(h0) + toHex(h1) + toHex(h2) + toHex(h3)
}

function bufferToHex(buffer: ArrayBuffer): string {
  const view = new DataView(buffer)
  let hex = ''
  for (let i = 0; i < view.byteLength; i++) {
    hex += view.getUint8(i).toString(16).padStart(2, '0')
  }
  return hex
}

type HashResults = {
  md5: string
  sha1: string
  sha256: string
  sha384: string
  sha512: string
}

export default function HashGeneratorTool() {
  const [inputMode, setInputMode] = useState<'text' | 'file'>('text')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [casing, setCasing] = useState<'lower' | 'upper'>('lower')
  const [hashes, setHashes] = useState<HashResults | null>(null)
  const [isHashing, setIsHashing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computeHashes = useCallback(async (data: ArrayBuffer) => {
    setIsHashing(true)
    setError(null)
    try {
      // 1. MD5
      const u8 = new Uint8Array(data)
      const md5Hash = md5(u8)

      // 2. Web Crypto hashes
      const sha1Buf = await crypto.subtle.digest('SHA-1', data)
      const sha256Buf = await crypto.subtle.digest('SHA-256', data)
      const sha384Buf = await crypto.subtle.digest('SHA-384', data)
      const sha512Buf = await crypto.subtle.digest('SHA-512', data)

      setHashes({
        md5: md5Hash,
        sha1: bufferToHex(sha1Buf),
        sha256: bufferToHex(sha256Buf),
        sha384: bufferToHex(sha384Buf),
        sha512: bufferToHex(sha512Buf),
      })
    } catch (e: any) {
      setError(`Hashing error: ${e.message}`)
      setHashes(null)
    } finally {
      setIsHashing(false)
    }
  }, [])

  // Triggered on text change
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

  // Triggered on file change
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

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const formatHash = (h: string) => {
    return casing === 'upper' ? h.toUpperCase() : h.toLowerCase()
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Hash Generator</h1>
        <p className="text-sm text-zinc-400">
          Compute MD5, SHA-1, SHA-256, SHA-384, and SHA-512 checksums in your browser. Files are never uploaded.
        </p>
      </header>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setInputMode('text')
              setFile(null)
            }}
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
            onClick={() => {
              setInputMode('file')
              setText('')
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              inputMode === 'file'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            File Drag & Drop
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500">Hash Case:</span>
          <button
            type="button"
            onClick={() => setCasing('lower')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              casing === 'lower'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-750'
                : 'text-zinc-500 hover:text-zinc-350 border border-transparent'
            }`}
          >
            lowercase
          </button>
          <button
            type="button"
            onClick={() => setCasing('upper')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              casing === 'upper'
                ? 'bg-zinc-800 text-zinc-100 border border-zinc-750'
                : 'text-zinc-500 hover:text-zinc-350 border border-transparent'
            }`}
          >
            UPPERCASE
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Input section */}
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
            onDrop={handleFileDrop}
            className="flex h-36 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-750 bg-zinc-950/40 hover:bg-zinc-950/80 transition cursor-pointer relative"
          >
            <input
              type="file"
              onChange={handleFileSelect}
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

      {/* Hashes List */}
      {isHashing && (
        <div className="text-center py-6 text-zinc-400 text-sm font-medium">
          Computing hashes...
        </div>
      )}

      {!isHashing && hashes && (
        <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
          <h2 className="text-sm font-semibold text-zinc-300 mb-3 border-b border-zinc-800 pb-2">
            Computed Checksums
          </h2>
          
          <div className="space-y-4">
            {/* SHA-256 */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
              <div className="w-24 shrink-0 font-medium text-zinc-400 text-xs uppercase tracking-wider">
                SHA-256
              </div>
              <div className="flex-1 flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-850 font-mono text-sm text-emerald-300 break-all select-all">
                <span>{formatHash(hashes.sha256)}</span>
                <CopyButton text={formatHash(hashes.sha256)} label="Copy" />
              </div>
            </div>

            {/* SHA-512 */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
              <div className="w-24 shrink-0 font-medium text-zinc-400 text-xs uppercase tracking-wider">
                SHA-512
              </div>
              <div className="flex-1 flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-850 font-mono text-sm text-emerald-300 break-all select-all">
                <span>{formatHash(hashes.sha512)}</span>
                <CopyButton text={formatHash(hashes.sha512)} label="Copy" />
              </div>
            </div>

            {/* SHA-1 */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
              <div className="w-24 shrink-0 font-medium text-zinc-400 text-xs uppercase tracking-wider">
                SHA-1
              </div>
              <div className="flex-1 flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-850 font-mono text-sm text-emerald-350 break-all select-all">
                <span>{formatHash(hashes.sha1)}</span>
                <CopyButton text={formatHash(hashes.sha1)} label="Copy" />
              </div>
            </div>

            {/* SHA-384 */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
              <div className="w-24 shrink-0 font-medium text-zinc-400 text-xs uppercase tracking-wider">
                SHA-384
              </div>
              <div className="flex-1 flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-850 font-mono text-sm text-emerald-350 break-all select-all">
                <span>{formatHash(hashes.sha384)}</span>
                <CopyButton text={formatHash(hashes.sha384)} label="Copy" />
              </div>
            </div>

            {/* MD5 (non-cryptographic warning tag) */}
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center justify-between">
              <div className="w-24 shrink-0 flex items-center gap-1.5 font-medium text-zinc-400 text-xs uppercase tracking-wider">
                MD5
                <span className="bg-amber-500/10 text-[9px] text-amber-400 rounded px-1 lowercase font-normal tracking-normal border border-amber-500/20" title="Non-cryptographic, for checksums only">
                  legacy
                </span>
              </div>
              <div className="flex-1 flex items-center justify-between gap-3 bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-850 font-mono text-sm text-emerald-350 break-all select-all">
                <span>{formatHash(hashes.md5)}</span>
                <CopyButton text={formatHash(hashes.md5)} label="Copy" />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
