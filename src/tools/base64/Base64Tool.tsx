import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

export default function Base64Tool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [urlSafe, setUrlSafe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const processText = useCallback((text: string, currentMode: 'encode' | 'decode', isUrlSafe: boolean) => {
    if (!text) {
      setOutput('')
      setError(null)
      return
    }

    try {
      if (currentMode === 'encode') {
        // UTF-8 to binary string
        const bytes = new TextEncoder().encode(text)
        let binString = ''
        for (let i = 0; i < bytes.length; i++) {
          binString += String.fromCharCode(bytes[i]!)
        }
        let base64 = btoa(binString)
        if (isUrlSafe) {
          base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        }
        setOutput(base64)
        setError(null)
      } else {
        // Normalize URL safe Base64 back to standard
        let normalized = text.trim().replace(/-/g, '+').replace(/_/g, '/')
        const pad = normalized.length % 4
        if (pad === 2) {
          normalized += '=='
        } else if (pad === 3) {
          normalized += '='
        }

        const binString = atob(normalized)
        const bytes = new Uint8Array(binString.length)
        for (let i = 0; i < binString.length; i++) {
          bytes[i] = binString.charCodeAt(i)
        }
        const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
        setOutput(decoded)
        setError(null)
      }
    } catch (e: any) {
      setError(currentMode === 'decode' ? 'Invalid Base64 input string.' : e.message)
      setOutput('')
    }
  }, [])

  useEffect(() => {
    processText(input, mode, urlSafe)
  }, [input, mode, urlSafe, processText])

  const handleSwap = () => {
    const currentOutput = output
    const currentInput = input
    setMode((m) => (m === 'encode' ? 'decode' : 'encode'))
    setInput(currentOutput || currentInput)
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Base64 Encode / Decode</h1>
        <p className="text-sm text-zinc-400">
          Convert text to and from Base64 with full UTF-8 support and URL-safe mapping.
        </p>
      </header>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode('encode')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === 'encode'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Encode
          </button>
          <button
            type="button"
            onClick={() => setMode('decode')}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              mode === 'decode'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
            }`}
          >
            Decode
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label htmlFor="opt-urlsafe" className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
            <input
              id="opt-urlsafe"
              type="checkbox"
              checked={urlSafe}
              onChange={(e) => setUrlSafe(e.target.checked)}
              className="size-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
            />
            URL-safe (RFC 4648)
          </label>

          <button
            type="button"
            onClick={handleSwap}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-750 transition"
          >
            Swap Input/Output
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-750 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Text Areas Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <div className="space-y-2">
          <label htmlFor="base64-input" className="block text-sm font-medium text-zinc-300">
            Input Text {mode === 'decode' && '(Base64)'}
          </label>
          <textarea
            id="base64-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'encode'
                ? 'Type or paste plain text here (e.g., Hello, 世界! 👋)'
                : 'Type or paste Base64 encoded string here...'
            }
            className="h-64 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="base64-output" className="block text-sm font-medium text-zinc-300">
              Output Text {mode === 'encode' && '(Base64)'}
            </label>
            <CopyButton text={output} disabled={!!error || !output} />
          </div>
          {error ? (
            <div className="flex h-64 w-full items-center justify-center rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-center text-sm text-red-400 font-medium">
              {error}
            </div>
          ) : (
            <textarea
              id="base64-output"
              value={output}
              readOnly
              placeholder="Conversion result will appear here..."
              className="h-64 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-emerald-300 focus:outline-none resize-y"
            />
          )}
        </div>
      </div>
    </div>
  )
}
