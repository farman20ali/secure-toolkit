import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'

import { transformStep, type EncodingFormat } from './encoding-lab-logic'

export default function EncodingLabTool() {
  const [initialText, setInitialText] = useState('Hello, Secure Toolkit! 🔐')
  const [pipeline, setPipeline] = useState<{ id: string; format: EncodingFormat; mode: 'encode' | 'decode' }[]>([
    { id: '1', format: 'hex', mode: 'encode' },
    { id: '2', format: 'base64', mode: 'encode' },
  ])

  const addStep = (format: EncodingFormat, mode: 'encode' | 'decode') => {
    setPipeline([...pipeline, { id: Math.random().toString(36).substring(2, 9), format, mode }])
  }

  const removeStep = (id: string) => {
    setPipeline(pipeline.filter((s) => s.id !== id))
  }

  // Compute live pipeline step outputs
  let currentVal = initialText
  const stepResults = pipeline.map((step) => {
    currentVal = transformStep(currentVal, step.format, step.mode)
    return { ...step, output: currentVal }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🔤</span>
          <span>Chainable Multi-Format Encoding Lab</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Build multi-step encoding and decoding pipelines with live intermediate step previews (Base64, Base64URL, Hex, Binary, URL, HTML).
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Initial Input Text
        </label>
        <textarea
          rows={3}
          value={initialText}
          onChange={(e) => setInitialText(e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 p-3 font-mono text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
        />
      </div>

      {/* Pipeline Controls */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Pipeline Steps ({pipeline.length})
          </h2>

          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => addStep('base64', 'encode')}
              className="rounded bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
            >
              + Base64 Encode
            </button>
            <button
              onClick={() => addStep('hex', 'encode')}
              className="rounded bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
            >
              + Hex Encode
            </button>
            <button
              onClick={() => addStep('binary', 'encode')}
              className="rounded bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
            >
              + Binary Encode
            </button>
            <button
              onClick={() => addStep('url', 'encode')}
              className="rounded bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
            >
              + URL Encode
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {stepResults.map((step, idx) => (
            <div
              key={step.id}
              className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-400 uppercase tracking-wider">
                  Step {idx + 1}: {step.format} ({step.mode})
                </span>
                <div className="flex items-center gap-2">
                  <CopyButton value={step.output} label="Copy Output" />
                  <button
                    onClick={() => removeStep(step.id)}
                    className="text-red-400 hover:text-red-300 font-bold"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="rounded bg-zinc-950 p-3 font-mono text-xs text-zinc-200 break-all border border-zinc-800">
                {step.output}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
