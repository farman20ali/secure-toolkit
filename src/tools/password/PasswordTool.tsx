import { useCallback, useEffect, useMemo, useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { StrengthMeter } from '../../components/StrengthMeter'
import {
  generatePassword,
  getCombinedPool,
  type PasswordOptions,
} from './generatePassword'

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
}

const ERROR_MESSAGES = {
  no_charset: 'Enable at least one character set.',
  length_too_short:
    'Password length must be at least the number of enabled character sets.',
  empty_pool:
    'Character pool is empty. Disable “Exclude ambiguous” or enable more sets.',
} as const

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 hover:border-zinc-700"
    >
      <span className="text-sm text-zinc-200">{label}</span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
      />
    </label>
  )
}

export default function PasswordTool() {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS)
  const [password, setPassword] = useState('')
  const [poolSize, setPoolSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)

  const regenerate = useCallback(() => {
    const result = generatePassword(options)
    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error])
      setPassword('')
      setPoolSize(0)
      return
    }
    setError(null)
    setPassword(result.password)
    setPoolSize(result.poolSize)
  }, [options])

  useEffect(() => {
    regenerate()
  }, [regenerate])

  const combinedPreview = useMemo(
    () => getCombinedPool(options).length,
    [options],
  )

  const updateOption = <K extends keyof PasswordOptions>(
    key: K,
    value: PasswordOptions[K],
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Password Generator</h1>
        <p className="text-sm text-zinc-400">
          Uses <code className="text-zinc-300">crypto.getRandomValues()</code>{' '}
          in your browser. Passwords are never stored or transmitted.
        </p>
      </header>

      <section
        className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        aria-labelledby="password-output-heading"
      >
        <h2 id="password-output-heading" className="sr-only">
          Generated password
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div
            className="flex min-h-12 flex-1 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-4 py-3 font-mono text-lg tracking-wide text-emerald-300"
            aria-live="polite"
            aria-atomic="true"
          >
            {error ? (
              <span className="text-sm text-amber-400">{error}</span>
            ) : visible ? (
              password
            ) : (
              '•'.repeat(password.length || 12)
            )}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm hover:bg-zinc-700"
              aria-pressed={visible}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
            <CopyButton text={password} disabled={!!error} />
            <button
              type="button"
              onClick={regenerate}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-500"
            >
              Regenerate
            </button>
          </div>
        </div>

        {!error && password && (
          <StrengthMeter length={password.length} poolSize={poolSize} />
        )}
      </section>

      <section className="grid gap-6 md:grid-cols-2" aria-label="Options">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="password-length"
              className="mb-2 block text-sm font-medium text-zinc-300"
            >
              Length: {options.length}
            </label>
            <input
              id="password-length"
              type="range"
              min={8}
              max={128}
              value={options.length}
              onChange={(e) =>
                updateOption('length', Number(e.target.value))
              }
              className="w-full accent-emerald-500"
            />
            <input
              type="number"
              min={8}
              max={128}
              value={options.length}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n)) {
                  updateOption('length', Math.min(128, Math.max(8, n)))
                }
              }}
              className="mt-2 w-24 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              aria-label="Password length"
            />
          </div>

          <ToggleRow
            id="opt-exclude-ambiguous"
            label="Exclude ambiguous (0, O, 1, l, I)"
            checked={options.excludeAmbiguous}
            onChange={(v) => updateOption('excludeAmbiguous', v)}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-300">Character sets</p>
          <ToggleRow
            id="opt-upper"
            label="Uppercase (A–Z)"
            checked={options.uppercase}
            onChange={(v) => updateOption('uppercase', v)}
          />
          <ToggleRow
            id="opt-lower"
            label="Lowercase (a–z)"
            checked={options.lowercase}
            onChange={(v) => updateOption('lowercase', v)}
          />
          <ToggleRow
            id="opt-digits"
            label="Numbers (0–9)"
            checked={options.digits}
            onChange={(v) => updateOption('digits', v)}
          />
          <ToggleRow
            id="opt-symbols"
            label="Symbols"
            checked={options.symbols}
            onChange={(v) => updateOption('symbols', v)}
          />
          <p className="pt-1 text-xs text-zinc-500">
            Combined pool size (preview): {combinedPreview} characters
          </p>
        </div>
      </section>
    </div>
  )
}
