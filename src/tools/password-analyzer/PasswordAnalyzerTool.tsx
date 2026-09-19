import { useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
import { CopyButton } from '../../components/CopyButton'
import { analyzePassword } from './password-analyzer-logic'

export default function PasswordAnalyzerTool() {
  const [password, setPassword] = useState('P@ssw0rd2026!Secure')
  const [bcryptHash, setBcryptHash] = useState('')
  const [bcryptCost, setBcryptCost] = useState(10)
  const [pbkdf2Hash, setPbkdf2Hash] = useState('')

  const analysis = analyzePassword(password)

  useEffect(() => {
    if (password) {
      try {
        const salt = bcrypt.genSaltSync(bcryptCost)
        const hash = bcrypt.hashSync(password, salt)
        setBcryptHash(hash)
      } catch {
        setBcryptHash('')
      }

      const enc = new TextEncoder()
      window.crypto.subtle
        .importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits'])
        .then((key) =>
          window.crypto.subtle.deriveBits(
            {
              name: 'PBKDF2',
              salt: enc.encode('secure-toolkit-salt'),
              iterations: 100000,
              hash: 'SHA-256',
            },
            key,
            256
          )
        )
        .then((derived) => {
          const hex = Array.from(new Uint8Array(derived))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('')
          setPbkdf2Hash(hex)
        })
        .catch(() => setPbkdf2Hash(''))
    } else {
      setBcryptHash('')
      setPbkdf2Hash('')
    }
  }, [password, bcryptCost])

  const labelColor = {
    'Very Weak': 'text-red-900 border-red-300 bg-red-50 dark:text-red-300 dark:border-red-800 dark:bg-red-950/40',
    'Weak': 'text-amber-900 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950/40',
    'Moderate': 'text-amber-900 border-amber-300 bg-amber-50 dark:text-amber-300 dark:border-amber-800 dark:bg-amber-950/40',
    'Strong': 'text-emerald-900 border-emerald-300 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:bg-emerald-950/40',
    'Very Strong': 'text-emerald-900 border-emerald-400 bg-emerald-100 dark:text-emerald-300 dark:border-emerald-500 dark:bg-emerald-950/60',
  }[analysis.label]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🛡️</span>
          <span>Password Security & Hashing Analyzer</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Calculate password entropy, pattern risks, character diversity, and test client-side bcrypt/PBKDF2 password hashes.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Input Password
        </label>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Type password to evaluate..."
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-base text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      {password && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={`rounded-xl border p-4 text-center ${labelColor}`}>
              <div className="text-xs uppercase tracking-wider opacity-80 font-semibold">Strength Rating</div>
              <div className="mt-1 text-2xl font-extrabold">{analysis.label}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">Entropy Rating</div>
              <div className="mt-1 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{analysis.entropyBits} bits</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 text-center dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
              <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-400 font-semibold">Total Length</div>
              <div className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-zinc-200">{analysis.length} chars</div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Character Diversity Checklist
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs font-semibold">
              <div className={`p-2.5 rounded-lg border text-center ${analysis.hasUpper ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'}`}>
                {analysis.hasUpper ? '✓ Uppercase (A-Z)' : '✗ Uppercase missing'}
              </div>
              <div className={`p-2.5 rounded-lg border text-center ${analysis.hasLower ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'}`}>
                {analysis.hasLower ? '✓ Lowercase (a-z)' : '✗ Lowercase missing'}
              </div>
              <div className={`p-2.5 rounded-lg border text-center ${analysis.hasNumber ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'}`}>
                {analysis.hasNumber ? '✓ Numbers (0-9)' : '✗ Numbers missing'}
              </div>
              <div className={`p-2.5 rounded-lg border text-center ${analysis.hasSymbol ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400' : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-500'}`}>
                {analysis.hasSymbol ? '✓ Symbols (!@#$)' : '✗ Symbols missing'}
              </div>
            </div>

            {analysis.patternWarnings.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  ⚠️ Pattern & Dictionary Risk Warnings
                </h4>
                {analysis.patternWarnings.map((warning, i) => (
                  <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    • {warning}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Browser-Derived KDF Hashes
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200">bcrypt Hash</span>
                    <select
                      value={bcryptCost}
                      onChange={(e) => setBcryptCost(parseInt(e.target.value, 10))}
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
                    >
                      <option value={8}>Cost 8</option>
                      <option value={10}>Cost 10</option>
                      <option value={12}>Cost 12</option>
                    </select>
                  </div>
                  {bcryptHash && <CopyButton value={bcryptHash} label="Copy bcrypt" />}
                </div>
                <div className="mt-1 rounded-lg bg-slate-100 p-2.5 font-mono text-xs text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400 break-all border border-slate-200 dark:border-zinc-800">
                  {bcryptHash || 'Generating...'}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900 dark:text-zinc-200">PBKDF2 (SHA-256, 100k iterations)</span>
                  {pbkdf2Hash && <CopyButton value={pbkdf2Hash} label="Copy PBKDF2" />}
                </div>
                <div className="mt-1 rounded-lg bg-slate-100 p-2.5 font-mono text-xs text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400 break-all border border-slate-200 dark:border-zinc-800">
                  {pbkdf2Hash || 'Generating...'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
