import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { encodeBase32, decodeBase32, generateRandomBase32Secret } from './base32-logic'

export type EncodingScheme = 'base64-std' | 'base64-url' | 'base32-std' | 'base32-hex'

const DEFAULT_BUFFERS: Record<EncodingScheme, { encode: string; decode: string }> = {
  'base32-std': { encode: 'Hello World', decode: 'JBSWY3DPEHPK3PXP' },
  'base32-hex': { encode: 'Hello World', decode: '91IMOR3F64OR3PP' },
  'base64-std': { encode: 'Hello World', decode: 'SGVsbG8gV29ybGQ=' },
  'base64-url': { encode: 'Hello World', decode: 'SGVsbG8gV29ybGQ' },
}

export default function Base64Tool() {
  const [scheme, setScheme] = useState<EncodingScheme>('base32-std')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [buffers, setBuffers] = useState(DEFAULT_BUFFERS)

  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const activeInput = buffers[scheme][mode]

  const setActiveInput = (val: string) => {
    setBuffers((prev) => ({
      ...prev,
      [scheme]: {
        ...prev[scheme],
        [mode]: val,
      },
    }))
  }

  const processText = useCallback(
    (text: string, currentMode: 'encode' | 'decode', currentScheme: EncodingScheme) => {
      if (!text.trim()) {
        setOutput('')
        setError(null)
        return
      }

      try {
        if (currentMode === 'encode') {
          if (currentScheme === 'base32-std' || currentScheme === 'base32-hex') {
            const variant = currentScheme === 'base32-hex' ? 'hex' : 'standard'
            setOutput(encodeBase32(text, variant, true))
            setError(null)
          } else {
            // Base64
            const bytes = new TextEncoder().encode(text)
            let binString = ''
            for (let i = 0; i < bytes.length; i++) {
              binString += String.fromCharCode(bytes[i]!)
            }
            let base64 = btoa(binString)
            if (currentScheme === 'base64-url') {
              base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
            }
            setOutput(base64)
            setError(null)
          }
        } else {
          // Decode mode
          if (currentScheme === 'base32-std' || currentScheme === 'base32-hex') {
            const variant = currentScheme === 'base32-hex' ? 'hex' : 'standard'
            setOutput(decodeBase32(text, variant))
            setError(null)
          } else {
            // Base64
            let normalized = text.trim().replace(/-/g, '+').replace(/_/g, '/')
            const pad = normalized.length % 4
            if (pad === 2) normalized += '=='
            else if (pad === 3) normalized += '='

            const binString = atob(normalized)
            const bytes = new Uint8Array(binString.length)
            for (let i = 0; i < binString.length; i++) {
              bytes[i] = binString.charCodeAt(i)
            }
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
            setOutput(decoded)
            setError(null)
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(currentMode === 'decode' ? `Invalid ${currentScheme.toUpperCase()} input format.` : msg)
        setOutput('')
      }
    },
    []
  )

  useEffect(() => {
    processText(activeInput, mode, scheme)
  }, [activeInput, mode, scheme, processText])

  const handleSwitchMode = (targetMode: 'encode' | 'decode') => {
    if (targetMode === mode) return

    // If switching mode with a valid current output, update target buffer
    if (output && !error) {
      setBuffers((prev) => ({
        ...prev,
        [scheme]: {
          ...prev[scheme],
          [targetMode]: output,
        },
      }))
    }
    setMode(targetMode)
  }

  const handleSwap = () => {
    const currentOut = output
    const currentIn = activeInput
    const targetMode = mode === 'encode' ? 'decode' : 'encode'

    setBuffers((prev) => ({
      ...prev,
      [scheme]: {
        ...prev[scheme],
        [targetMode]: currentOut || currentIn,
      },
    }))
    setMode(targetMode)
  }

  const handleClear = () => {
    setActiveInput('')
    setOutput('')
    setError(null)
  }

  const handleGenerateRandomKey = () => {
    if (scheme.startsWith('base32')) {
      const secret = generateRandomBase32Secret(16)
      setBuffers((prev) => ({
        ...prev,
        [scheme]: {
          ...prev[scheme],
          decode: secret,
        },
      }))
      setMode('decode')
    } else {
      const bytes = new Uint8Array(24)
      crypto.getRandomValues(bytes)
      let bin = ''
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
      let b64 = btoa(bin)
      if (scheme === 'base64-url') b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      setBuffers((prev) => ({
        ...prev,
        [scheme]: {
          ...prev[scheme],
          decode: b64,
        },
      }))
      setMode('decode')
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🔤</span>
          <span>Base32 &amp; Base64 Security Codec Studio</span>
        </h1>
        <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Encode and decode Base32 (RFC 4648 / TOTP 2FA keys) and Base64 (Standard &amp; URL-safe) with isolated tab buffers.
        </p>
      </header>

      {/* Scheme Selection Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto gap-2">
        {[
          { id: 'base32-std', label: '⏱️ Base32 Standard (RFC 4648 / TOTP)' },
          { id: 'base32-hex', label: '🔢 Base32 Extended Hex' },
          { id: 'base64-std', label: '🔤 Base64 Standard' },
          { id: 'base64-url', label: '🌐 Base64 URL-Safe' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setScheme(item.id as EncodingScheme)}
            className={`border-b-2 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors whitespace-nowrap ${
              scheme === item.id
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleSwitchMode('encode')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition border ${
              mode === 'encode'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Encode Plaintext ➔ {scheme.toUpperCase()}
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('decode')}
            className={`rounded-lg px-4 py-2 text-xs font-bold transition border ${
              mode === 'decode'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }`}
          >
            Decode {scheme.toUpperCase()} ➔ Plaintext
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleGenerateRandomKey}
            className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-sky-500 transition shadow-xs"
          >
            🎲 Generate Random {scheme.startsWith('base32') ? 'Base32 TOTP Key' : 'Base64 Key'}
          </button>

          <button
            type="button"
            onClick={handleSwap}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition"
          >
            🔄 Swap Input/Output
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition"
          >
            🧹 Clear
          </button>
        </div>
      </div>

      {/* Text Areas Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="base-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Input Text {mode === 'decode' ? `(${scheme.toUpperCase()})` : '(Plaintext UTF-8)'}
            </label>
            <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">{activeInput.length} chars</span>
          </div>
          <textarea
            id="base-input"
            value={activeInput}
            onChange={(e) => setActiveInput(e.target.value)}
            placeholder={
              mode === 'encode'
                ? 'Type or paste plain text here (e.g. Hello World or user@example.com)...'
                : `Paste ${scheme.toUpperCase()} encoded string (e.g. JBSWY3DPEHPK3PXP)...`
            }
            className="h-64 w-full rounded-xl border border-slate-300 bg-white p-4 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 resize-y shadow-xs"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="base-output" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Output Result {mode === 'encode' ? `(${scheme.toUpperCase()})` : '(Plaintext UTF-8)'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-slate-400 dark:text-zinc-500">{output.length} chars</span>
              <CopyButton value={output} label="Copy Output" />
            </div>
          </div>
          {error ? (
            <div className="flex h-64 w-full items-center justify-center rounded-xl border border-red-300 bg-red-50 p-4 text-center text-xs font-bold text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              ⚠️ {error}
            </div>
          ) : (
            <textarea
              id="base-output"
              value={output}
              readOnly
              placeholder="Conversion result will appear here..."
              className="h-64 w-full rounded-xl border border-slate-300 bg-slate-50 p-4 font-mono text-xs text-emerald-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-400 focus:outline-none resize-y shadow-xs"
            />
          )}
        </div>
      </div>
    </div>
  )
}
