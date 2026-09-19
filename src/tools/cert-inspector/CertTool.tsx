import { useState, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

import {
  parseX509Pem,
  generateDevRsaKeyPairPem,
  type ParsedCert,
} from './cert-logic'

// ─── Sub-components ──────────────────────────────────────────────────────────

function CertMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 dark:border-zinc-800/60 py-2.5 last:border-0">
      <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-zinc-400">{label}</span>
      <span className="break-all text-right font-mono text-xs text-slate-800 dark:text-zinc-200">{value}</span>
    </div>
  )
}

// ─── Certificate Inspector Tab ───────────────────────────────────────────────

function InspectorTab() {
  const [pem, setPem] = useState('')
  const [parsed, setParsed] = useState<ParsedCert | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleParse = useCallback(async (inputPem: string) => {
    if (!inputPem.trim()) { setParsed(null); setError(null); return }
    try {
      const cert = await parseX509Pem(inputPem)
      setParsed(cert)
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to parse X.509 certificate.')
      setParsed(null)
    }
  }, [])

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      if (typeof evt.target?.result === 'string') {
        setPem(evt.target.result)
        handleParse(evt.target.result)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="cert-pem-input" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
            Paste X.509 Certificate (PEM Format)
          </label>
          <label className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-xs">
            + Upload .crt / .pem / .cer
            <input
              type="file"
              accept=".pem,.crt,.cer,.der"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
        <textarea
          id="cert-pem-input"
          value={pem}
          onChange={(e) => {
            setPem(e.target.value)
            handleParse(e.target.value)
          }}
          placeholder="-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIU..."
          rows={6}
          className="w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 resize-y"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900 dark:border-red-500/25 dark:bg-red-950/10 dark:text-red-400">
          {error}
        </div>
      )}

      {parsed && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column: Status & Subject */}
          <div className="space-y-5">
            {/* Expiry Status */}
            <div
              className={`rounded-xl border p-5 ${
                parsed.isExpired
                  ? 'border-red-300 bg-red-50 dark:border-red-500/30 dark:bg-red-950/20'
                  : parsed.isNotYetValid
                    ? 'border-amber-300 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/20'
                    : 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-bold text-sm ${parsed.isExpired ? 'text-red-900 dark:text-red-400' : 'text-emerald-900 dark:text-emerald-400'}`}>
                    {parsed.isExpired ? '⛔ Certificate Expired' : '✅ Certificate Active'}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
                    {parsed.validNotAfter ? `Expires on ${parsed.validNotAfter.toUTCString()}` : 'No expiry date'}
                  </p>
                </div>
                {parsed.daysRemaining != null && !parsed.isExpired && (
                  <span className="rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 text-xs font-bold border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                    {parsed.daysRemaining} days left
                  </span>
                )}
              </div>
            </div>

            {/* Subject Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/30 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-800 pb-2">
                Subject (Issued To)
              </p>
              {Object.entries(parsed.subject).map(([k, v]) => (
                <CertMetaRow key={k} label={k} value={v} />
              ))}
              {Object.keys(parsed.subject).length === 0 && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No subject attributes parsed.</p>
              )}
            </div>

            {/* Issuer Details */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/30 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-800 pb-2">
                Issuer (Issued By)
              </p>
              {Object.entries(parsed.issuer).map(([k, v]) => (
                <CertMetaRow key={k} label={k} value={v} />
              ))}
              {Object.keys(parsed.issuer).length === 0 && (
                <p className="text-xs text-slate-400 dark:text-zinc-500 italic">No issuer attributes parsed.</p>
              )}
            </div>
          </div>

          {/* Right Column: Validity & Fingerprint */}
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3 dark:border-zinc-800 dark:bg-zinc-900/30 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500 border-b border-slate-200 dark:border-zinc-800 pb-2">
                Certificate Properties &amp; Fingerprint
              </p>
              <CertMetaRow label="Serial Number" value={parsed.serialNumber} />
              <CertMetaRow label="Signature Algorithm" value={parsed.sigAlgName} />
              {parsed.validNotBefore && (
                <CertMetaRow label="Valid From" value={parsed.validNotBefore.toUTCString()} />
              )}
              {parsed.validNotAfter && (
                <CertMetaRow label="Valid Until" value={parsed.validNotAfter.toUTCString()} />
              )}
              <CertMetaRow label="SHA-256 Fingerprint" value={parsed.fingerprintSha256} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dev Key & Cert Generator Tab ────────────────────────────────────────────

function GeneratorTab() {
  const [domain, setDomain] = useState('localhost')
  const [keyPairPem, setKeyPairPem] = useState<{ publicKeyPem: string; privateKeyPem: string } | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      const pair = await generateDevRsaKeyPairPem()
      setKeyPairPem(pair)
    } catch (e: any) {
      console.error(e)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-zinc-400">
          Generate Dev Key Pair (RSA 2048-bit)
        </h2>
        <div className="space-y-1.5">
          <label className="block text-xs text-slate-700 dark:text-zinc-300">Target Hostname / Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition disabled:opacity-40"
          >
            {isGenerating ? 'Generating Key Pair...' : 'Generate RSA Key Pair'}
          </button>
        </div>
      </div>

      {keyPairPem && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Public Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500">
                Public Key (SPKI PEM)
              </span>
              <CopyButton value={keyPairPem.publicKeyPem} label="Copy Public Key" />
            </div>
            <textarea
              readOnly
              value={keyPairPem.publicKeyPem}
              rows={12}
              className="w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-xs text-emerald-700 focus:outline-none resize-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-400"
            />
          </div>

          {/* Private Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-zinc-500">
                Private Key (PKCS#8 PEM)
              </span>
              <CopyButton value={keyPairPem.privateKeyPem} label="Copy Private Key" />
            </div>
            <textarea
              readOnly
              value={keyPairPem.privateKeyPem}
              rows={12}
              className="w-full rounded-lg border border-slate-300 bg-white p-4 font-mono text-xs text-emerald-700 focus:outline-none resize-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-emerald-400"
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CertTool() {
  const [tab, setTab] = useState<'inspector' | 'generator'>('inspector')

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>📜</span>
          <span>X.509 Certificate Inspector &amp; Key Pair Tool</span>
        </h1>
        <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
          Inspect X.509 PEM certificates (Subject, Issuer, Validity, Fingerprint) or generate RSA keys locally.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('inspector')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'inspector'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300'
          }`}
        >
          Inspect X.509 Certificate
        </button>
        <button
          type="button"
          onClick={() => setTab('generator')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'generator'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-500 dark:hover:text-zinc-300'
          }`}
        >
          Dev Key Pair Generator
        </button>
      </div>

      {tab === 'inspector' ? <InspectorTab /> : <GeneratorTab />}
    </div>
  )
}
