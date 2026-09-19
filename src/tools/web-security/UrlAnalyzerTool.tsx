import { useState } from 'react'
import { CopyButton } from '../../components/CopyButton'

import { analyzeUrlStructure } from './url-analyzer-logic'

export default function UrlAnalyzerTool() {
  const [urlInput, setUrlInput] = useState('https://user:pass123@login.example.com/oauth/auth?redirect=https://evil.com/phish&utm_source=email')

  const report = analyzeUrlStructure(urlInput)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🌐</span>
          <span>URL Security & Parameter Analyzer</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Deep-inspect web URLs, detect embedded basic-auth credentials, punycode homographs, open redirects, and suspicious query parameters.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
          Target URL Input
        </label>
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://example.com/path?key=value"
          className="w-full rounded-md border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>

      {report.isValid ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Parsed URL Components
            </h3>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 font-mono text-xs">
              <div className="rounded bg-white p-3 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-500 block">Protocol</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{report.protocol}</span>
              </div>
              <div className="rounded bg-white p-3 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-500 block">Hostname</span>
                <span className="text-slate-900 dark:text-zinc-200 font-semibold">{report.hostname}</span>
              </div>
              <div className="rounded bg-white p-3 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-500 block">Port</span>
                <span className="text-slate-800 dark:text-zinc-200">{report.port}</span>
              </div>
              <div className="rounded bg-white p-3 border border-slate-200 dark:bg-zinc-950 dark:border-zinc-800">
                <span className="text-slate-500 dark:text-zinc-500 block">Path</span>
                <span className="text-slate-800 dark:text-zinc-200 truncate">{report.pathname}</span>
              </div>
            </div>

            {(report.username || report.password) && (
              <div className="rounded border border-red-300 bg-red-50 p-3.5 text-xs font-mono text-red-900 space-y-1 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                <div>⚠️ <strong>Embedded Credentials Found:</strong></div>
                <div>Username: <span className="text-red-700 dark:text-red-400 font-bold">{report.username}</span></div>
                <div>Password: <span className="text-red-700 dark:text-red-400 font-bold">{report.password}</span></div>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
              Security Observation Report
            </h3>

            <div className="space-y-3">
              {report.findings.map((f, i) => {
                const styles = {
                  danger: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
                  warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
                  info: 'bg-slate-100 text-slate-900 border-slate-200 dark:bg-zinc-800/40 dark:text-zinc-300 dark:border-zinc-700',
                  success: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
                }[f.level]

                return (
                  <div key={i} className={`rounded-md border p-3.5 ${styles}`}>
                    <div className="font-semibold text-sm">{f.title}</div>
                    <div className="mt-0.5 text-xs opacity-90">{f.desc}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {report.params.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-zinc-400">
                  Query Parameters ({report.params.length})
                </h3>
                <CopyButton value={JSON.stringify(report.params, null, 2)} label="Copy Query JSON" />
              </div>

              <div className="divide-y divide-slate-200 border border-slate-200 rounded bg-white text-xs font-mono dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                {report.params.map((p, i) => (
                  <div key={i} className="flex justify-between p-2.5">
                    <span className="text-emerald-700 font-semibold dark:text-emerald-400">{p.key}</span>
                    <span className="text-slate-800 dark:text-zinc-300 break-all">{p.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          ⚠️ Enter a valid web URL (including http:// or https://) to inspect.
        </div>
      )}
    </div>
  )
}
