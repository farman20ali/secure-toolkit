import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'
import { scanContentForSecrets, type SecretFinding } from './secret-scanner-logic'

export default function SecretScannerTool() {
  const [inputText, setInputText] = useState<string>(`// Sample code for local secret scanning
const AWS_ACCESS_KEY = "AKIAIOSFODNN7EXAMPLE";
const OPENAI_KEY = "sk-proj-1234567890abcdef1234567890abcdef";
const DATABASE_URL = "postgres://admin:superSecretPass123@db.internal:5432/production";
const user = { username: "alex", password: "MySuperSecretPassword2026!" };
`)

  const findings = scanContentForSecrets(inputText)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setInputText((event.target?.result as string) || '')
    }
    reader.readAsText(file)
  }

  const getRedactedContent = () => {
    let result = inputText
    findings.forEach((f: SecretFinding) => {
      result = result.split(f.match).join(f.redacted)
    })
    return result
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🕵️</span>
          <span>Secret & Credential Detector</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
          Scan source code, config files, .env variables, or JSON payloads locally for leaked API keys, tokens, passwords, and private keys.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <label className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs transition-colors">
          📁 Load File (.env, .js, .ts, .json, .yml)
          <input type="file" onChange={handleFileUpload} className="hidden" />
        </label>

        <span className="text-xs text-slate-500 dark:text-zinc-500 font-mono">
          🔒 100% Client-Side Scanning — zero network transmission
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Source Text / Code Input
          </label>
          <textarea
            rows={14}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste code, .env file, or JSON content here..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Scan Results ({findings.length} detected)
            </h2>
            {findings.length > 0 && (
              <CopyButton value={getRedactedContent()} label="Copy Redacted File" />
            )}
          </div>

          {findings.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-xs font-semibold text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400">
              ✓ No hardcoded secrets, API keys, or credentials detected.
            </div>
          ) : (
            <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
              {findings.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-1.5 dark:border-red-900/50 dark:bg-zinc-900/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-red-600 dark:text-red-400">
                      ⚠️ {item.type}
                    </span>
                    <span className="rounded bg-red-100 px-2 py-0.5 text-[10px] font-mono font-semibold text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800">
                      Line {item.line} • {item.confidence} Confidence
                    </span>
                  </div>
                  <div className="font-mono text-xs text-slate-700 bg-white p-2 rounded border border-slate-200 dark:bg-zinc-950 dark:text-zinc-300 dark:border-zinc-800 break-all">
                    Redacted: <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{item.redacted}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
