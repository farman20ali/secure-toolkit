import { useCallback, useEffect, useMemo, useState } from 'react'
import bcrypt from 'bcryptjs'
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
  useCustomSymbols: false,
  customSymbols: '',
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

// ─── Bcrypt & Key Derivation Tab ─────────────────────────────────────────────

function BcryptTab() {
  // Hash Generator
  const [plainPassword, setPlainPassword] = useState('MySecureP@ssw0rd!')
  const [costFactor, setCostFactor] = useState(10)
  const [generatedHash, setGeneratedHash] = useState('')
  const [isHashing, setIsHashing] = useState(false)

  // Password Verification
  const [verifyPass, setVerifyPass] = useState('')
  const [verifyHash, setVerifyHash] = useState('')
  const [matchResult, setMatchResult] = useState<'idle' | 'match' | 'mismatch' | 'error'>('idle')
  const [matchMessage, setMatchMessage] = useState('')

  // PBKDF2 Derivation
  const [pbkdfPassword, setPbkdfPassword] = useState('secret-passphrase')
  const [pbkdfSalt, setPbkdfSalt] = useState('custom-salt-value')
  const [pbkdfIterations, setPbkdfIterations] = useState(100000)
  const [pbkdfHashAlg, setPbkdfHashAlg] = useState<'SHA-256' | 'SHA-512'>('SHA-256')
  const [derivedKeyHex, setDerivedKeyHex] = useState('')

  const handleGenerateBcrypt = () => {
    if (!plainPassword) return
    setIsHashing(true)
    setTimeout(() => {
      try {
        const salt = bcrypt.genSaltSync(costFactor)
        const hash = bcrypt.hashSync(plainPassword, salt)
        setGeneratedHash(hash)
      } catch (e: any) {
        setGeneratedHash(`Error generating Bcrypt hash: ${e.message}`)
      } finally {
        setIsHashing(false)
      }
    }, 0)
  }

  const handleVerifyBcrypt = () => {
    if (!verifyPass || !verifyHash.trim()) return
    try {
      const isMatch = bcrypt.compareSync(verifyPass, verifyHash.trim())
      if (isMatch) {
        setMatchResult('match')
        setMatchMessage('✅ Password matches the specified Bcrypt hash!')
      } else {
        setMatchResult('mismatch')
        setMatchMessage('❌ Password does NOT match the hash.')
      }
    } catch (e: any) {
      setMatchResult('error')
      setMatchMessage(`Verification error: ${e.message || 'Invalid Bcrypt hash format.'}`)
    }
  }

  const handleDerivePbkdf2 = useCallback(async () => {
    if (!pbkdfPassword || !pbkdfSalt) return
    try {
      const keyData = new TextEncoder().encode(pbkdfPassword)
      const saltData = new TextEncoder().encode(pbkdfSalt)
      const baseKey = await crypto.subtle.importKey('raw', keyData, 'PBKDF2', false, ['deriveBits'])
      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltData,
          iterations: pbkdfIterations,
          hash: pbkdfHashAlg,
        },
        baseKey,
        256, // 32 bytes
      )
      const u8 = new Uint8Array(derivedBits)
      let hex = ''
      for (let i = 0; i < u8.length; i++) hex += u8[i]!.toString(16).padStart(2, '0')
      setDerivedKeyHex(hex)
    } catch {
      setDerivedKeyHex('Failed to derive key.')
    }
  }, [pbkdfPassword, pbkdfSalt, pbkdfIterations, pbkdfHashAlg])

  useEffect(() => {
    handleDerivePbkdf2()
  }, [handleDerivePbkdf2])

  return (
    <div className="space-y-8">
      {/* 1. Bcrypt Hash Generator */}
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Bcrypt Hash Generator
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Plaintext Password</label>
            <input
              type="text"
              value={plainPassword}
              onChange={(e) => setPlainPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Cost Factor (Rounds): {costFactor}</label>
            <input
              type="range"
              min={4}
              max={14}
              value={costFactor}
              onChange={(e) => setCostFactor(Number(e.target.value))}
              className="w-full accent-emerald-500"
            />
            <span className="text-[11px] text-zinc-500">Default: 10 (higher rounds = slower calculation)</span>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerateBcrypt}
            disabled={isHashing || !plainPassword}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
          >
            {isHashing ? 'Hashing...' : 'Generate Bcrypt Hash'}
          </button>
        </div>

        {generatedHash && (
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-400">Generated $2b$ Hash Output:</span>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-emerald-400 break-all select-all">
              <span>{generatedHash}</span>
              <CopyButton text={generatedHash} />
            </div>
          </div>
        )}
      </section>

      {/* 2. Bcrypt Password Verifier */}
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Verify Password against Bcrypt Hash
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Candidate Password</label>
            <input
              type="text"
              value={verifyPass}
              onChange={(e) => setVerifyPass(e.target.value)}
              placeholder="Password to test..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Existing Bcrypt Hash ($2a$, $2b$, $2y$)</label>
            <input
              type="text"
              value={verifyHash}
              onChange={(e) => setVerifyHash(e.target.value)}
              placeholder="$2b$10$..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleVerifyBcrypt}
            disabled={!verifyPass || !verifyHash.trim()}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
          >
            Verify Match
          </button>
        </div>

        {matchResult !== 'idle' && (
          <div
            className={`rounded-lg border p-3.5 text-xs font-semibold ${
              matchResult === 'match'
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                : matchResult === 'mismatch'
                  ? 'border-red-500/30 bg-red-950/20 text-red-300'
                  : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
            }`}
          >
            {matchMessage}
          </div>
        )}
      </section>

      {/* 3. PBKDF2 Key Derivation Estimator */}
      <section className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          PBKDF2 Key Derivation
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Passphrase</label>
            <input
              type="text"
              value={pbkdfPassword}
              onChange={(e) => setPbkdfPassword(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Salt</label>
            <input
              type="text"
              value={pbkdfSalt}
              onChange={(e) => setPbkdfSalt(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Iterations</label>
            <select
              value={pbkdfIterations}
              onChange={(e) => setPbkdfIterations(Number(e.target.value))}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value={10000}>10,000 (Legacy)</option>
              <option value={100000}>100,000 (Recommended)</option>
              <option value={310000}>310,000 (OWASP Standard)</option>
              <option value={600000}>600,000 (High Security)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs text-zinc-300">Hash Algorithm</label>
            <select
              value={pbkdfHashAlg}
              onChange={(e) => setPbkdfHashAlg(e.target.value as 'SHA-256' | 'SHA-512')}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
            >
              <option value="SHA-256">SHA-256 (256-bit)</option>
              <option value="SHA-512">SHA-512 (512-bit)</option>
            </select>
          </div>
        </div>

        {derivedKeyHex && (
          <div className="space-y-1.5">
            <span className="text-xs text-zinc-400">Derived Key Output (256-bit Hex):</span>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-emerald-400 break-all select-all">
              <span>{derivedKeyHex}</span>
              <CopyButton text={derivedKeyHex} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PasswordTool() {
  const [tab, setTab] = useState<'generator' | 'bcrypt'>('generator')
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS)
  const [password, setPassword] = useState('')
  const [poolSize, setPoolSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
  const [customSymbolsInput, setCustomSymbolsInput] = useState(
    DEFAULT_OPTIONS.customSymbols,
  )

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
        <h1 className="text-2xl font-bold text-zinc-50">Password &amp; Hash Utilities</h1>
        <p className="text-sm text-zinc-400">
          Generate cryptographically strong passwords, calculate Bcrypt hashes, verify matches, and test PBKDF2 derivations.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('generator')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'generator'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Password Generator
        </button>
        <button
          type="button"
          onClick={() => setTab('bcrypt')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'bcrypt'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Bcrypt &amp; Key Derivation
        </button>
      </div>

      {tab === 'bcrypt' ? (
        <BcryptTab />
      ) : (
        <>
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
              <ToggleRow
                id="opt-custom-symbols-enabled"
                label="Use custom symbols"
                checked={!!options.useCustomSymbols}
                onChange={(v) => updateOption('useCustomSymbols', v)}
              />
              {options.useCustomSymbols && (
                <div className="mt-2">
                  <label
                    htmlFor="custom-symbols"
                    className="mb-1 block text-xs text-zinc-400"
                  >
                    Custom symbols
                  </label>
                  <input
                    id="custom-symbols"
                    type="text"
                    value={customSymbolsInput}
                    onChange={(e) => setCustomSymbolsInput(e.target.value)}
                    onBlur={() => updateOption('customSymbols', customSymbolsInput)}
                    placeholder="e.g. ~€±_@"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
                    aria-label="Custom symbols"
                  />
                  <p className="pt-1 text-xs text-zinc-500">
                    These characters will be used in addition to the standard
                    symbol set.
                  </p>
                </div>
              )}
              <p className="pt-1 text-xs text-zinc-500">
                Combined pool size (preview): {combinedPreview} characters
              </p>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
