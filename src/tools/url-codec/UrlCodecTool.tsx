import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

export default function UrlCodecTool() {
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [type, setType] = useState<'component' | 'full'>('component')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const processUrl = useCallback((text: string, currentMode: 'encode' | 'decode', currentType: 'component' | 'full') => {
    if (!text) {
      setOutput('')
      setError(null)
      return
    }

    try {
      if (currentMode === 'encode') {
        const encoded = currentType === 'component' ? encodeURIComponent(text) : encodeURI(text)
        setOutput(encoded)
        setError(null)
      } else {
        const decoded = currentType === 'component' ? decodeURIComponent(text) : decodeURI(text)
        setOutput(decoded)
        setError(null)
      }
    } catch (e: any) {
      setError(`Malformed URL sequence: ${e.message}`)
      setOutput('')
    }
  }, [])

  useEffect(() => {
    processUrl(input, mode, type)
  }, [input, mode, type, processUrl])

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
        <h1 className="text-2xl font-bold text-zinc-50">URL Encode / Decode</h1>
        <p className="text-sm text-zinc-400">
          Encode or decode URLs and parameter components safely. Runs entirely locally.
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
          <div className="flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
            <button
              type="button"
              onClick={() => setType('component')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                type === 'component'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60'
                  : 'text-zinc-500 hover:text-zinc-350'
              }`}
            >
              Component
            </button>
            <button
              type="button"
              onClick={() => setType('full')}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                type === 'full'
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60'
                  : 'text-zinc-500 hover:text-zinc-350'
              }`}
            >
              Full URL
            </button>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-750 transition"
          >
            Swap Input/Output
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-750 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Grid of Textareas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <div className="space-y-2">
          <label htmlFor="url-input" className="block text-sm font-medium text-zinc-300">
            Input Text
          </label>
          <textarea
            id="url-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'encode'
                ? 'Type or paste plain text here (e.g. name=John Doe&status=active)'
                : 'Type or paste encoded URL text here (e.g. name%3DJohn%2520Doe%26status%3Dactive)'
            }
            className="h-64 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="url-output" className="block text-sm font-medium text-zinc-300">
              Output Text
            </label>
            <CopyButton text={output} disabled={!!error || !output} />
          </div>
          {error ? (
            <div className="flex h-64 w-full items-center justify-center rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-center text-sm text-red-400 font-medium">
              {error}
            </div>
          ) : (
            <textarea
              id="url-output"
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
