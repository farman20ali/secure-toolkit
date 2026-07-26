import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { generateUuids, type UuidOptions } from './generateUuid'

const DEFAULT_OPTIONS: UuidOptions = {
  version: 'v4',
  quantity: 5,
  uppercase: false,
  hyphens: true,
  braces: false,
}

export default function UuidTool() {
  const [options, setOptions] = useState<UuidOptions>(DEFAULT_OPTIONS)
  const [uuids, setUuids] = useState<string[]>([])

  const regenerate = useCallback(() => {
    setUuids(generateUuids(options))
  }, [options])

  useEffect(() => {
    regenerate()
  }, [regenerate])

  const updateOption = <K extends keyof UuidOptions>(
    key: K,
    value: UuidOptions[K],
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  const allUuidsText = uuids.join('\n')

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">UUID Generator</h1>
        <p className="text-sm text-zinc-400">
          Generate RFC 4122 / RFC 9562 compliant Universally Unique Identifiers (UUIDs) locally in your browser.
        </p>
      </header>

      {/* Output Panel */}
      <section
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        aria-labelledby="uuid-output-heading"
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <h2 id="uuid-output-heading" className="text-sm font-medium text-zinc-300">
            Generated UUIDs ({uuids.length})
          </h2>
          <div className="flex gap-2">
            <CopyButton text={allUuidsText} label="Copy All" />
            <button
              type="button"
              onClick={regenerate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-500 transition"
            >
              Regenerate
            </button>
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-zinc-850 bg-zinc-950 font-mono text-sm leading-relaxed p-4 divide-y divide-zinc-900/60">
          {uuids.map((uuid, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 first:pt-0 last:pb-0 group">
              <span className="text-emerald-300 break-all select-all pr-4">{uuid}</span>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(uuid)
                }}
                className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 transition"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Configuration Options */}
      <section className="grid gap-6 md:grid-cols-2" aria-label="UUID Options">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              UUID Version
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateOption('version', 'v4')}
                className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                  options.version === 'v4'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                v4 (Random)
              </button>
              <button
                type="button"
                onClick={() => updateOption('version', 'v7')}
                className={`rounded-lg border py-2.5 text-sm font-medium transition ${
                  options.version === 'v7'
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                v7 (Timestamp-ordered)
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              v7 is recommended for database primary keys due to its temporal sorting capability.
            </p>
          </div>

          <div>
            <label htmlFor="uuid-quantity" className="mb-2 block text-sm font-medium text-zinc-300">
              Quantity: {options.quantity}
            </label>
            <input
              id="uuid-quantity"
              type="range"
              min={1}
              max={100}
              value={options.quantity}
              onChange={(e) => updateOption('quantity', Number(e.target.value))}
              className="w-full accent-emerald-500 mb-2"
            />
            <input
              type="number"
              min={1}
              max={100}
              value={options.quantity}
              onChange={(e) => {
                const val = Math.max(1, Math.min(100, Number(e.target.value) || 1))
                updateOption('quantity', val)
              }}
              className="w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100"
              aria-label="UUID quantity count"
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="block text-sm font-medium text-zinc-300">Format Settings</label>
          
          <label
            htmlFor="opt-hyphens"
            className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700"
          >
            <div className="flex flex-col">
              <span className="text-sm text-zinc-200">Include Hyphens</span>
              <span className="text-xs text-zinc-500">e.g. f81d4fae-7dec-11d0-a765-00a0c91e6bf6</span>
            </div>
            <input
              id="opt-hyphens"
              type="checkbox"
              checked={options.hyphens}
              onChange={(e) => updateOption('hyphens', e.target.checked)}
              className="size-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
            />
          </label>

          <label
            htmlFor="opt-uppercase"
            className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700"
          >
            <div className="flex flex-col">
              <span className="text-sm text-zinc-200">Uppercase Letters</span>
              <span className="text-xs text-zinc-500">e.g. F81D4FAE-...</span>
            </div>
            <input
              id="opt-uppercase"
              type="checkbox"
              checked={options.uppercase}
              onChange={(e) => updateOption('uppercase', e.target.checked)}
              className="size-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
            />
          </label>

          <label
            htmlFor="opt-braces"
            className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700"
          >
            <div className="flex flex-col">
              <span className="text-sm text-zinc-200">Wrap in Braces</span>
              <span className="text-xs text-zinc-500">e.g. &#123;f81d4fae-...&#125;</span>
            </div>
            <input
              id="opt-braces"
              type="checkbox"
              checked={options.braces}
              onChange={(e) => updateOption('braces', e.target.checked)}
              className="size-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
            />
          </label>
        </div>
      </section>
    </div>
  )
}
