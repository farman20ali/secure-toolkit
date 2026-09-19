import { useState, useEffect, useCallback, useRef } from 'react'
import {
  cleanGoogleAppPassword,
  generateHandshakeSimulation,
  generateNodeJsScript,
  generateOpenSslCommand,
  generatePhpScript,
  generatePowerShellScript,
  generatePythonScript,
  parseRecipientList,
  SMTP_PRESETS,
  type SmtpAttachment,
  type SmtpConfig,
  validateSmtpConfig,
  parseCSV,
  detectEmailColumn,
  buildMergePreview,
  type CsvParseResult,
} from './smtp-tester.logic'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Derive a sensible default relay URL from the current browser location.
 *  In local dev the Vite proxy forwards /api/* → http://127.0.0.1:3001,
 *  so we use a relative path to stay same-origin and avoid CORS issues.
 */
function deriveRelayUrl(): string {
  if (typeof window === 'undefined') return '/api/smtp-test-relay'
  const { hostname, protocol } = window.location
  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('172.')
  if (isLocal) return '/api/smtp-test-relay'
  return `${protocol}//${hostname}:3001/api/smtp-test-relay`
}

type RelayStatus = 'idle' | 'checking' | 'online' | 'offline'
type SendMode = 'simulate' | 'relay'

// ── component ─────────────────────────────────────────────────────────────────

export default function SmtpTesterTool() {
  const [selectedPresetId, setSelectedPresetId] = useState<string>('google')
  const [activeTab, setActiveTab] = useState<'composer' | 'handshake' | 'code' | 'http-relay'>('composer')
  const [activeCodeLang, setActiveCodeLang] = useState<'node' | 'python' | 'powershell' | 'openssl' | 'php'>('node')
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [sendMode, setSendMode] = useState<SendMode>('simulate')

  const [config, setConfig] = useState<SmtpConfig>({
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls',
    authType: 'app_password',
    username: 'your-email@gmail.com',
    password: '',
    fromEmail: 'your-email@gmail.com',
    toEmail: 'recipient1@example.com, recipient2@example.com',
    ccEmail: '',
    bccEmail: '',
    subject: 'Verification Test: Secure-Toolkit SMTP Mailer',
    body: 'Hello,\n\nThis is a test email sent from the Secure-Toolkit SMTP Mail Verification Lab to verify server credentials, TLS encryption, and delivery performance.\n\nBest regards,\nDeveloper Security Toolkit',
    isHtml: false,
  })

  // Relay state
  const [userConsent, setUserConsent] = useState(false)
  const [relayUrl, setRelayUrl] = useState(() => {
    return localStorage.getItem('smtp_relay_url') ?? deriveRelayUrl()
  })
  const [relayStatus, setRelayStatus] = useState<RelayStatus>('idle')
  const [relayTesting, setRelayTesting] = useState(false)
  const [relayResult, setRelayResult] = useState<{ success?: boolean; message?: string; error?: string } | null>(null)
  const [showCcBcc, setShowCcBcc] = useState(false)

  // Attachments state (unified)
  const [attachments, setAttachments] = useState<SmtpAttachment[]>([])

  const handleAddFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        setAttachments((prev) => [
          ...prev,
          { filename: file.name, content: base64, contentType: file.type || 'application/octet-stream', size: file.size },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleRemoveAttachment = (index: number) =>
    setAttachments((prev) => prev.filter((_, i) => i !== index))

  // ── CSV Mail Merge state ──────────────────────────────────────────────────
  const [csvData, setCsvData] = useState<CsvParseResult | null>(null)
  const [csvEmailCol, setCsvEmailCol] = useState<string>('')
  const [csvCcCol, setCsvCcCol] = useState<string>('')
  const [csvBccCol, setCsvBccCol] = useState<string>('')
  const [staticMergeCc, setStaticMergeCc] = useState<string>('')
  const [staticMergeBcc, setStaticMergeBcc] = useState<string>('')
  const [mergeDelayMs, setMergeDelayMs] = useState<number>(300)
  const [previewRowIdx, setPreviewRowIdx] = useState<number>(0)
  const abortMergeRef = useRef<boolean>(false)
  const [mergeProgress, setMergeProgress] = useState<null | {
    sent: number
    total: number
    log: { to: string; ok: boolean; msg: string }[]
  }>(null)
  const [mergeSending, setMergeSending] = useState(false)

  // API docs active tab in Tab 4
  const [activeRelayDocTab, setActiveRelayDocTab] = useState<'insomnia' | 'postman' | 'curl-single' | 'curl-bulk'>('insomnia')

  const handleCsvFile = (file: File | null) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = parseCSV(reader.result as string)
      setCsvData(result)
      setPreviewRowIdx(0)
      const autoCol = detectEmailColumn(result.headers)
      setCsvEmailCol(autoCol ?? (result.headers[0] || ''))
      setMergeProgress(null)
    }
    reader.readAsText(file)
  }

  const clearCsv = () => {
    setCsvData(null)
    setCsvEmailCol('')
    setCsvCcCol('')
    setCsvBccCol('')
    setMergeProgress(null)
    setPreviewRowIdx(0)
  }

  // ── relay health check ────────────────────────────────────────────────────
  const checkRelayHealth = useCallback(async (url: string = relayUrl) => {
    setRelayStatus('checking')
    try {
      const ctrl = new AbortController()
      const tid = setTimeout(() => ctrl.abort(), 4000)
      const res = await fetch(url, { method: 'GET', signal: ctrl.signal })
      clearTimeout(tid)
      setRelayStatus(res.ok ? 'online' : 'offline')
    } catch {
      setRelayStatus('offline')
    }
  }, [relayUrl])

  useEffect(() => {
    if (sendMode === 'relay') {
      checkRelayHealth()
    }
  }, [sendMode, checkRelayHealth])

  // ── handlers ─────────────────────────────────────────────────────────────
  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId)
    const preset = SMTP_PRESETS.find((p) => p.id === presetId)
    if (preset) {
      setConfig((prev) => ({
        ...prev,
        host: preset.host,
        port: preset.port,
        security: preset.security,
        authType: preset.authType,
      }))
    }
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const insertVariable = (varName: string, target: 'subject' | 'body') => {
    const token = `{{${varName}}}`
    if (target === 'subject') {
      setConfig((prev) => ({ ...prev, subject: `${prev.subject} ${token}` }))
    } else {
      setConfig((prev) => ({ ...prev, body: `${prev.body} ${token}` }))
    }
  }

  const recipientsList = parseRecipientList(config.toEmail)
  const securityChecks = validateSmtpConfig(config)
  const handshakeSteps = generateHandshakeSimulation(config)
  const cleanedPass = cleanGoogleAppPassword(config.password)

  const getScriptForLang = (lang: 'node' | 'python' | 'powershell' | 'openssl' | 'php' = activeCodeLang) => {
    switch (lang) {
      case 'node':       return generateNodeJsScript(config)
      case 'python':     return generatePythonScript(config)
      case 'powershell': return generatePowerShellScript(config)
      case 'openssl':    return generateOpenSslCommand(config)
      case 'php':        return generatePhpScript(config)
      default:           return ''
    }
  }

  // Dispatch single test email
  const handleSendViaRelay = async () => {
    if (!userConsent) return
    setRelayTesting(true)
    setRelayResult(null)

    try {
      const ccList = config.ccEmail?.trim() ? config.ccEmail.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : undefined
      const bccList = config.bccEmail?.trim() ? config.bccEmail.split(/[,;]+/).map((s) => s.trim()).filter(Boolean) : undefined
      const res = await fetch(relayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: config.host,
          port: config.port,
          security: config.security,
          user: config.username,
          pass: cleanedPass,
          from: config.fromEmail || config.username,
          to: recipientsList.length === 1 ? recipientsList[0] : recipientsList,
          cc: ccList && ccList.length === 1 ? ccList[0] : ccList,
          bcc: bccList && bccList.length === 1 ? bccList[0] : bccList,
          subject: config.subject,
          body: config.body,
          isHtml: config.isHtml,
          attachments: attachments.map(({ filename, content, contentType }) => ({ filename, content, contentType })),
        }),
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        setRelayResult({
          success: false,
          error: `SMTP Server Error (${res.status}): ${data.error || 'Authentication or socket delivery failed'}`,
        })
      } else {
        setRelayResult({
          success: true,
          message: `Email dispatched! Message-ID: ${data.messageId} — Server: ${data.response || '250 OK'}`,
        })
        setRelayStatus('online')
      }
    } catch (err: any) {
      setRelayStatus('offline')
      setRelayResult({
        success: false,
        error: `Could not reach relay at ${relayUrl}. (${err.message})`,
      })
    } finally {
      setRelayTesting(false)
    }
  }

  // Dispatch bulk CSV mail merge
  const handleSendMerge = async () => {
    if (!csvData || !csvEmailCol || !userConsent) return
    setMergeSending(true)
    abortMergeRef.current = false
    const log: { to: string; ok: boolean; msg: string }[] = []
    setMergeProgress({ sent: 0, total: csvData.rows.length, log })

    for (let i = 0; i < csvData.rows.length; i++) {
      if (abortMergeRef.current) {
        log.push({ to: '— Bulk Dispatch Stopped —', ok: false, msg: `Execution halted by user at row ${i + 1}` })
        break
      }
      const row = csvData.rows[i]
      const ccSource = csvCcCol ? csvCcCol : (staticMergeCc || config.ccEmail || undefined)
      const bccSource = csvBccCol ? csvBccCol : (staticMergeBcc || config.bccEmail || undefined)
      const preview = buildMergePreview(row, csvEmailCol, config.subject, config.body, ccSource, bccSource)
      const to = preview.to

      try {
        const payload: any = {
          host: config.host,
          port: config.port,
          security: config.security,
          user: config.username,
          pass: cleanedPass,
          from: config.fromEmail || config.username,
          to,
          subject: preview.subject,
          body: preview.body,
          isHtml: config.isHtml,
          attachments: attachments.map(({ filename, content, contentType }) => ({ filename, content, contentType })),
        }
        if (preview.cc) payload.cc = preview.cc
        if (preview.bcc) payload.bcc = preview.bcc

        const res = await fetch(relayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        log.push({
          to,
          ok: data.success,
          msg: data.success ? `Delivered (${data.messageId ?? 'ok'})` : (data.error ?? 'Unknown error'),
        })
      } catch (err: any) {
        log.push({ to, ok: false, msg: err.message })
      }
      setMergeProgress({ sent: i + 1, total: csvData.rows.length, log: [...log] })

      if (i < csvData.rows.length - 1 && mergeDelayMs > 0 && !abortMergeRef.current) {
        await new Promise((resolve) => setTimeout(resolve, mergeDelayMs))
      }
    }
    setMergeSending(false)
  }

  // ── sub-components (inline) ───────────────────────────────────────────────
  const StatusDot = () => {
    const map: Record<RelayStatus, { color: string; label: string; animate: boolean }> = {
      idle:     { color: 'bg-slate-400',   label: 'Not checked', animate: false },
      checking: { color: 'bg-amber-400',   label: 'Checking…',   animate: true  },
      online:   { color: 'bg-emerald-500', label: 'Online',      animate: false },
      offline:  { color: 'bg-rose-500',    label: 'Offline',     animate: false },
    }
    const { color, label, animate } = map[relayStatus]
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
        <span className={`w-2 h-2 rounded-full ${color} ${animate ? 'animate-pulse' : ''}`} />
        {label}
      </span>
    )
  }

  // Calculate live preview data
  const currentPreview = (() => {
    if (csvData && csvData.rows.length > 0) {
      const activeRow = csvData.rows[previewRowIdx] ?? {}
      const ccSource = csvCcCol ? csvCcCol : (staticMergeCc || config.ccEmail || undefined)
      const bccSource = csvBccCol ? csvBccCol : (staticMergeBcc || config.bccEmail || undefined)
      return buildMergePreview(activeRow, csvEmailCol, config.subject, config.body, ccSource, bccSource)
    }
    return {
      to: config.toEmail,
      subject: config.subject,
      body: config.body,
      cc: config.ccEmail,
      bcc: config.bccEmail,
    }
  })()

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">📧</span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                SMTP Security &amp; Mail Tester Studio
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Unified email composer with single test dispatch, CSV mail merge, attachments, protocol simulation, and API relay automation.
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-lg font-medium text-emerald-700 bg-emerald-100 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/60">
            🔒 Client-Side Safe
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        {[
          { id: 'composer',   label: '1. Mail Composer & Dispatch', icon: '🚀' },
          { id: 'handshake',  label: '2. Protocol Simulator',       icon: '⚡' },
          { id: 'code',       label: '3. Terminal Scripts',          icon: '💻' },
          { id: 'http-relay', label: '4. Relay Server & API Docs',  icon: '🌐' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 1 — UNIFIED MAIL COMPOSER & DISPATCH
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left 2 Columns: Credentials, Recipient Mode (Single/CSV), Body, Attachments, Dispatch */}
          <div className="lg:col-span-2 space-y-6">

            {/* Section 1: SMTP Credentials & Sender Config */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>⚙️</span> SMTP Server Credentials &amp; Sender Profile
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  Step 1
                </span>
              </div>

              {/* Quick presets */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  Quick Provider Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SMTP_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handlePresetChange(p.id)}
                      className={`p-2.5 rounded-xl text-left border text-xs font-medium transition-all ${
                        selectedPresetId === p.id
                          ? 'border-blue-500 bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-200'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{p.host ? `${p.host}:${p.port}` : 'Custom'}</div>
                    </button>
                  ))}
                </div>
                {SMTP_PRESETS.find((p) => p.id === selectedPresetId)?.note && (
                  <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 dark:text-amber-400/90 dark:bg-amber-950/30 dark:border-amber-800/40 p-2.5 rounded-lg">
                    💡 {SMTP_PRESETS.find((p) => p.id === selectedPresetId)?.note}
                  </p>
                )}
              </div>

              {/* Host & Port */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">SMTP Host Server</label>
                  <input
                    type="text"
                    value={config.host}
                    onChange={(e) => setConfig({ ...config, host: e.target.value })}
                    placeholder="e.g. smtp.gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Port</label>
                  <input
                    type="number"
                    value={config.port}
                    onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 587 })}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Security Mode */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Security / Encryption Mode</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 'starttls', label: 'STARTTLS (Port 587)' },
                    { id: 'tls',      label: 'Direct SSL/TLS (Port 465)' },
                    { id: 'none',     label: 'Unencrypted (Port 25)' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setConfig({ ...config, security: mode.id as any })}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
                        config.security === mode.id
                          ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-600/20 dark:text-blue-300'
                          : 'border-slate-300 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:border-slate-700'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Username & Password */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Username / Account</label>
                  <input
                    type="text"
                    value={config.username}
                    onChange={(e) => setConfig({ ...config, username: e.target.value })}
                    placeholder="user@gmail.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">
                    Password / App Password
                  </label>
                  <input
                    type="password"
                    value={config.password}
                    onChange={(e) => setConfig({ ...config, password: e.target.value })}
                    placeholder="abcd efgh ijkl mnop"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono text-xs"
                  />
                  {config.host.includes('gmail') && (
                    <div className="mt-1 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between">
                      <span>Cleaned (no spaces):</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                        {cleanedPass || '16-char key'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sender Email Address (From) */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Sender Email Address (From)</label>
                <input
                  type="email"
                  value={config.fromEmail}
                  onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                  placeholder="e.g. notifications@yourdomain.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Section 2: Recipients & Mail Mode (Single vs CSV Mail Merge) */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>👥</span> Recipients &amp; Dispatch Mode
                </h2>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-lg font-semibold border ${
                    csvData
                      ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800'
                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                  }`}>
                    {csvData ? `📊 CSV Bulk Mail Merge (${csvData.rows.length} rows)` : '✉️ Direct / Single Mode'}
                  </span>
                </div>
              </div>

              {/* CSV Upload / Drag-and-drop Card */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>📁</span> CSV File Upload <span className="text-slate-400 font-normal">(Optional — adds bulk merge capability)</span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {csvData
                        ? `Loaded: ${csvData.rows.length} rows • Columns: ${csvData.headers.join(', ')}`
                        : 'Upload a CSV to dynamically personalize emails with {{variable}} tags.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <label className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white cursor-pointer transition-all shadow-md shadow-violet-600/20 flex items-center gap-1.5">
                      <span>📄</span> {csvData ? 'Replace CSV' : 'Upload CSV'}
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => handleCsvFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                    {csvData && (
                      <button
                        onClick={clearCsv}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition-all"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* If CSV is loaded: Mapping & Variables */}
                {csvData && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Recipient Email Column (To) *
                        </label>
                        <select
                          value={csvEmailCol}
                          onChange={(e) => setCsvEmailCol(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white font-semibold focus:outline-none"
                        >
                          {csvData.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          CC Column (Optional)
                        </label>
                        <select
                          value={csvCcCol}
                          onChange={(e) => setCsvCcCol(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="">— None / Static CC below —</option>
                          {csvData.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          BCC Column (Optional)
                        </label>
                        <select
                          value={csvBccCol}
                          onChange={(e) => setCsvBccCol(e.target.value)}
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                        >
                          <option value="">— None / Static BCC below —</option>
                          {csvData.headers.map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Variable Pills */}
                    <div>
                      <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                        Insert template variables into Subject or Body:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {csvData.headers.map((h) => (
                          <div key={h} className="inline-flex rounded-lg border border-violet-200 dark:border-violet-800 overflow-hidden text-[11px]">
                            <span className="font-mono bg-violet-50 dark:bg-violet-950/60 text-violet-800 dark:text-violet-300 px-2 py-0.5 select-all">
                              {`{{${h}}}`}
                            </span>
                            <button
                              type="button"
                              onClick={() => insertVariable(h, 'subject')}
                              title="Add to Subject"
                              className="px-1.5 py-0.5 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900 dark:hover:bg-violet-800 text-violet-800 dark:text-violet-200 font-bold border-l border-violet-200 dark:border-violet-800"
                            >
                              +Sub
                            </button>
                            <button
                              type="button"
                              onClick={() => insertVariable(h, 'body')}
                              title="Add to Body"
                              className="px-1.5 py-0.5 bg-violet-100 hover:bg-violet-200 dark:bg-violet-900 dark:hover:bg-violet-800 text-violet-800 dark:text-violet-200 font-bold border-l border-violet-200 dark:border-violet-800"
                            >
                              +Body
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* If no CSV: standard direct 'To' input */}
              {!csvData && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-400">To — Recipient(s)</label>
                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      {recipientsList.length} recipient(s)
                    </span>
                  </div>
                  <input
                    type="text"
                    value={config.toEmail}
                    onChange={(e) => setConfig({ ...config, toEmail: e.target.value })}
                    placeholder="user1@example.com, user2@example.com"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 block">
                    Separate multiple recipient addresses with commas or upload a CSV above for mail merge.
                  </span>
                </div>
              )}

              {/* CC / BCC Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowCcBcc((v) => !v)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1"
                >
                  {showCcBcc ? '▾ Hide' : '▸ Add / Configure'} CC &amp; BCC Recipients
                </button>

                {showCcBcc && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">
                        CC <span className="text-slate-400 font-normal">(Carbon Copy — visible)</span>
                      </label>
                      <input
                        type="text"
                        value={config.ccEmail ?? ''}
                        disabled={!!csvCcCol}
                        onChange={(e) => setConfig({ ...config, ccEmail: e.target.value })}
                        placeholder={csvCcCol ? `Mapped from column "${csvCcCol}"` : "cc1@example.com, cc2@example.com"}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">
                        BCC <span className="text-slate-400 font-normal">(Blind Copy — hidden)</span>
                      </label>
                      <input
                        type="text"
                        value={config.bccEmail ?? ''}
                        disabled={!!csvBccCol}
                        onChange={(e) => setConfig({ ...config, bccEmail: e.target.value })}
                        placeholder={csvBccCol ? `Mapped from column "${csvBccCol}"` : "bcc@example.com"}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Subject & Message Body */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>✏️</span> Email Subject &amp; Content Body
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, isHtml: !config.isHtml })}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                      config.isHtml
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {config.isHtml ? '🌐 HTML Mode' : '📝 Plain Text'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={config.subject}
                  onChange={(e) => setConfig({ ...config, subject: e.target.value })}
                  placeholder="e.g. Invoice {{invoice_id}} for {{name}}"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-400 mb-1">
                  Message Body ({config.isHtml ? 'HTML markup allowed' : 'Plain text'})
                </label>
                <textarea
                  value={config.body}
                  onChange={(e) => setConfig({ ...config, body: e.target.value })}
                  rows={6}
                  placeholder="Write your email body here. Use {{variable_name}} to substitute CSV values..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3.5 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 resize-y"
                />
              </div>
            </div>

            {/* Section 4: Unified File Attachments */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span>📎</span> File Attachments
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({attachments.length} attached)
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Attached files will be dispatched with {csvData ? 'every mail merge recipient' : 'your test email'}.
                  </p>
                </div>

                <label
                  htmlFor="attachment-input"
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <span>+ Attach Files</span>
                  <input
                    id="attachment-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      handleAddFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

              {attachments.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 shadow-sm"
                    >
                      <span>📄</span>
                      <span className="font-medium max-w-[160px] truncate">{att.filename}</span>
                      {att.size !== undefined && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          ({(att.size / 1024).toFixed(1)} KB)
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(i)}
                        className="text-rose-500 hover:text-rose-700 dark:text-rose-400 text-sm font-bold ml-1"
                        title="Remove attachment"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No files attached yet. Click above to attach PDFs, images, or documents.</p>
              )}
            </div>

            {/* Section 5: Unified Dispatch Center */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🚀</span> Dispatch &amp; Live Execution Center
                </h2>
                <div className="flex rounded-xl p-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setSendMode('simulate')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      sendMode === 'simulate'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    ⚡ Simulate
                  </button>
                  <button
                    onClick={() => setSendMode('relay')}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                      sendMode === 'relay'
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    🚀 Live Dispatch
                  </button>
                </div>
              </div>

              {/* Relay settings */}
              {sendMode === 'relay' ? (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Relay Server URL
                      </label>
                      <div className="flex items-center gap-2">
                        <StatusDot />
                        <button
                          onClick={() => checkRelayHealth(relayUrl)}
                          className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          Ping
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        { label: '🏠 Local (Vite proxy)', url: '/api/smtp-test-relay' },
                        { label: '🖥️ Local (direct)', url: 'http://127.0.0.1:3001/api/smtp-test-relay' },
                      ].map(({ label, url }) => (
                        <button
                          key={url}
                          onClick={() => {
                            setRelayUrl(url)
                            setRelayStatus('idle')
                            localStorage.setItem('smtp_relay_url', url)
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium transition-all ${
                            relayUrl === url
                              ? 'bg-blue-100 border-blue-400 text-blue-800 dark:bg-blue-950/60 dark:border-blue-700 dark:text-blue-300'
                              : 'bg-slate-100 border-slate-300 text-slate-600 hover:border-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                      <span className="text-[10px] text-slate-400 self-center">or custom remote gateway</span>
                    </div>

                    <input
                      type="url"
                      value={relayUrl}
                      onChange={(e) => {
                        setRelayUrl(e.target.value)
                        setRelayStatus('idle')
                      }}
                      onBlur={(e) => localStorage.setItem('smtp_relay_url', e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Offline helper */}
                  {relayStatus === 'offline' && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/50 text-xs text-rose-900 dark:text-rose-300 space-y-2">
                      <p className="font-bold">🔴 Relay server is offline or unreachable. To start it:</p>
                      <div className="flex items-center gap-2">
                        <code className="font-mono bg-rose-100 dark:bg-rose-900/50 px-2 py-1 rounded border border-rose-300 dark:border-rose-700 text-[11px]">
                          node script/server-relay.js
                        </code>
                        <button
                          onClick={() => handleCopy('node script/server-relay.js', 'relay-cmd')}
                          className="text-[11px] px-2 py-1 rounded bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100 font-semibold hover:opacity-80 transition-opacity"
                        >
                          {copiedField === 'relay-cmd' ? '✓ Copied!' : 'Copy Command'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Consent checkbox */}
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userConsent}
                      onChange={(e) => setUserConsent(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed select-none">
                      I understand and consent to sending this email payload via the relay server. Credentials will be passed securely to the relay to authenticate with the SMTP host.
                    </span>
                  </label>

                  {/* Rate Throttle (If CSV Mode) */}
                  {csvData && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Bulk Inter-Message Throttle Delay:
                      </span>
                      <select
                        value={mergeDelayMs}
                        onChange={(e) => setMergeDelayMs(Number(e.target.value))}
                        disabled={mergeSending}
                        className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-medium focus:outline-none"
                      >
                        <option value={0}>0ms (Instant Burst)</option>
                        <option value={200}>200ms (Fast)</option>
                        <option value={500}>500ms (Recommended)</option>
                        <option value={1000}>1000ms / 1s (Safe)</option>
                        <option value={2000}>2000ms / 2s (Anti-Greylist)</option>
                      </select>
                    </div>
                  )}

                  {/* Dispatch Button(s) */}
                  <div className="flex flex-wrap gap-3 items-center">
                    {csvData ? (
                      !mergeSending ? (
                        <button
                          type="button"
                          onClick={handleSendMerge}
                          disabled={!userConsent || !csvEmailCol || relayStatus === 'offline' || relayStatus === 'checking'}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md shadow-violet-600/20 flex items-center gap-2"
                        >
                          <span>🚀</span> Dispatch {csvData.rows.length} Bulk Emails
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => { abortMergeRef.current = true }}
                          className="px-6 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-all shadow-md shadow-rose-600/20 flex items-center gap-2"
                        >
                          <span>🛑</span> Stop Sending
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendViaRelay}
                        disabled={!userConsent || relayTesting || relayStatus === 'offline' || relayStatus === 'checking'}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2"
                      >
                        {relayTesting ? (
                          <><span className="animate-spin">🔄</span> Dispatching…</>
                        ) : (
                          <><span>🚀</span> Send Live Test Email</>
                        )}
                      </button>
                    )}

                    {!userConsent && (
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        ← Check consent box to enable
                      </span>
                    )}
                  </div>

                  {/* Single Send Result */}
                  {!csvData && relayResult && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
                        relayResult.success
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300'
                      }`}
                    >
                      {relayResult.success ? '✅ ' : '❌ '}
                      {relayResult.message || relayResult.error}
                    </div>
                  )}

                  {/* Bulk Progress & Real-Time Log */}
                  {csvData && mergeProgress && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {mergeSending
                            ? `Dispatching… ${mergeProgress.sent} / ${mergeProgress.total}`
                            : `Finished — ${mergeProgress.sent} processed`}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                          ✅ {mergeProgress.log.filter((l) => l.ok).length} ok &nbsp;·&nbsp;
                          ❌ {mergeProgress.log.filter((l) => !l.ok).length} failed
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                        <div
                          className="h-2.5 rounded-full bg-violet-500 transition-all duration-300"
                          style={{ width: `${(mergeProgress.sent / mergeProgress.total) * 100}%` }}
                        />
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 mt-2 font-mono text-[11px]">
                        {mergeProgress.log.map((entry, i) => (
                          <div
                            key={i}
                            className={`flex items-start gap-2 px-2.5 py-1 rounded-lg ${
                              entry.ok
                                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40'
                            }`}
                          >
                            <span>{entry.ok ? '✅' : '❌'}</span>
                            <span className="font-semibold">{entry.to}</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate">{entry.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Simulation Mode Notice */
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 dark:bg-blue-950/30 dark:border-blue-800/40 text-xs text-blue-900 dark:text-blue-300 space-y-2">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚡</span> Simulation Mode Active
                  </div>
                  <p className="leading-relaxed">
                    Browser security policies (CORS &amp; raw TCP restrictions) prevent web browsers from opening direct SMTP sockets to port 587/465.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => setActiveTab('handshake')}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
                    >
                      View Protocol Simulation →
                    </button>
                    <button
                      onClick={() => setActiveTab('code')}
                      className="px-3 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-xs hover:opacity-80 transition-opacity"
                    >
                      Get Terminal Script →
                    </button>
                    <button
                      onClick={() => setSendMode('relay')}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
                    >
                      Enable Live Dispatch →
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Live Outgoing Email Preview & Security Audit */}
          <div className="space-y-6">

            {/* Live Outgoing Email Preview */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>👁️</span> Live Outgoing Preview
                </h2>
                {csvData && csvData.rows.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setPreviewRowIdx((i) => Math.max(0, i - 1))}
                      disabled={previewRowIdx === 0}
                      className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 font-bold text-xs"
                    >
                      ‹
                    </button>
                    <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400">
                      Row {previewRowIdx + 1}/{csvData.rows.length}
                    </span>
                    <button
                      onClick={() => setPreviewRowIdx((i) => Math.min(csvData.rows.length - 1, i + 1))}
                      disabled={previewRowIdx === csvData.rows.length - 1}
                      className="w-6 h-6 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-30 font-bold text-xs"
                    >
                      ›
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500 w-14 shrink-0">From:</span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 truncate">
                    {config.fromEmail || config.username || 'Not set'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500 w-14 shrink-0">To:</span>
                  <span className={`font-mono truncate ${currentPreview.to ? 'text-slate-900 dark:text-white font-semibold' : 'text-rose-500 italic'}`}>
                    {currentPreview.to || '— specify recipient email —'}
                  </span>
                </div>
                {currentPreview.cc && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-14 shrink-0">CC:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{currentPreview.cc}</span>
                  </div>
                )}
                {currentPreview.bcc && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-500 w-14 shrink-0">BCC:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300 truncate">{currentPreview.bcc}</span>
                  </div>
                )}
                {attachments.length > 0 && (
                  <div className="flex items-start gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-500 w-14 shrink-0">Files:</span>
                    <div className="flex flex-wrap gap-1">
                      {attachments.map((a, i) => (
                        <span key={i} className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                          📎 {a.filename}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-semibold text-slate-500 block mb-1">Subject:</span>
                  <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-medium text-slate-900 dark:text-white text-xs">
                    {currentPreview.subject || '(No subject)'}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 block mb-1">Body Preview:</span>
                  <pre className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-slate-800 dark:text-slate-200 text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                    {currentPreview.body || '(Empty body)'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Credential Security Audit Card */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🛡️</span> Security &amp; Compliance Audit
              </h2>

              <div className="space-y-2.5">
                {securityChecks.length === 0 ? (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300 rounded-xl text-xs">
                    ✅ Configuration looks valid and aligned with security standards.
                  </div>
                ) : (
                  securityChecks.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        item.severity === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/50 dark:text-emerald-300'
                          : item.severity === 'warning'
                          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-300'
                          : item.severity === 'error'
                          ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/30 dark:border-rose-800/50 dark:text-rose-300'
                          : 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800/50 dark:text-blue-300'
                      }`}
                    >
                      <div className="font-semibold flex items-center gap-1.5">
                        <span>
                          {item.severity === 'success' ? '✅' : item.severity === 'warning' ? '⚠️' : item.severity === 'error' ? '❌' : 'ℹ️'}
                        </span>
                        <span>{item.title}</span>
                      </div>
                      <div className="leading-relaxed text-slate-700 dark:text-slate-300 text-[11px]">{item.message}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick 1-Click Terminal Script preview */}
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>💻</span> 1-Click Diagnostic Script
                </h3>
                <button
                  onClick={() => handleCopy(getScriptForLang(activeCodeLang), activeCodeLang)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all"
                >
                  {copiedField === activeCodeLang ? '✓ Copied!' : '📋 Copy'}
                </button>
              </div>

              <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                {[
                  { id: 'node', label: 'Node' },
                  { id: 'python', label: 'Python' },
                  { id: 'powershell', label: 'PS1' },
                  { id: 'openssl', label: 'OpenSSL' },
                  { id: 'php', label: 'PHP' },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setActiveCodeLang(lang.id as any)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      activeCodeLang === lang.id
                        ? 'bg-slate-200 text-slate-900 font-bold dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-emerald-400 overflow-x-auto max-h-40 leading-relaxed">
                {getScriptForLang(activeCodeLang)}
              </pre>
            </div>

          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 2 — PROTOCOL HANDSHAKE SIMULATOR
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'handshake' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>⚡</span> Step-by-Step SMTP Handshake Protocol Simulation
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                Visualizing client commands and expected ESMTP server response codes for {recipientsList.length} recipient(s).
              </p>
            </div>
            <span className="text-xs font-mono text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/60 px-3 py-1 rounded-lg border border-blue-200 dark:border-blue-800/60 font-semibold">
              {config.host}:{config.port}
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs max-h-[500px] overflow-y-auto pr-2">
            {handshakeSteps.map((s) => (
              <div
                key={s.step}
                className={`p-3 rounded-xl border transition-all ${
                  s.direction === 'client'
                    ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800/40 dark:text-blue-300 ml-4 sm:ml-8'
                    : s.direction === 'server'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300 mr-4 sm:mr-8'
                    : 'bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase font-semibold">
                    Step {s.step} • {s.direction.toUpperCase()}
                  </span>
                  {s.code && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                      Code {s.code}
                    </span>
                  )}
                </div>
                <div className="text-sm font-semibold whitespace-pre-wrap text-slate-900 dark:text-slate-100">{s.text}</div>
                <div className="text-[11px] font-sans text-slate-600 dark:text-slate-400 mt-1 italic">{s.explanation}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 3 — TERMINAL SCRIPTS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'code' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>💻</span> Terminal Diagnostic &amp; Execution Scripts
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                Run directly in your terminal — credentials, host, and body are pre-filled from your config above.
              </p>
            </div>
            <button
              onClick={() => handleCopy(getScriptForLang(), activeCodeLang)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20"
            >
              {copiedField === activeCodeLang ? '✓ Copied!' : '📋 Copy Script'}
            </button>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
            {[
              { id: 'node',       label: '🟢 Node.js (Nodemailer)' },
              { id: 'python',     label: '🐍 Python (smtplib)' },
              { id: 'powershell', label: '⚡ PowerShell (Windows)' },
              { id: 'openssl',    label: '🛠️ OpenSSL CLI' },
              { id: 'php',        label: '🐘 PHP (PHPMailer)' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setActiveCodeLang(lang.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCodeLang === lang.id
                    ? 'bg-slate-200 text-slate-900 font-semibold dark:bg-slate-800 dark:text-white border border-slate-300 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-[450px]">
            {getScriptForLang()}
          </pre>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TAB 4 — RELAY SERVER & API DOCS
      ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'http-relay' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-5 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🌐</span> Relay Server Configuration &amp; API Client Collection
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
              The relay server is a lightweight Node.js daemon that executes SMTP socket dispatches on behalf of the browser or third-party API clients.
            </p>
          </div>

          {/* Architecture overview */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {[
              { step: '1', icon: '🌐', title: 'Browser / API Client', desc: 'Prepares email parameters, variables, attachments, and triggers HTTP POST.' },
              { step: '2', icon: '📡', title: 'Relay Server', desc: 'Accepts REST payload, pools TCP sockets, performs TLS handshake & AUTH.' },
              { step: '3', icon: '📧', title: 'Target SMTP Server', desc: 'Receives standard ESMTP DATA stream and delivers to inboxes.' },
            ].map((item) => (
              <div key={item.step} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{item.icon}</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.title}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Endpoint configuration */}
          <div className="space-y-4 max-w-2xl">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Relay Endpoint URL</label>
                <div className="flex items-center gap-2">
                  <StatusDot />
                  <button
                    onClick={() => checkRelayHealth(relayUrl)}
                    className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
                  >
                    Ping
                  </button>
                </div>
              </div>
              <input
                type="url"
                value={relayUrl}
                onChange={(e) => { setRelayUrl(e.target.value); setRelayStatus('idle') }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Relay script reference */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900 dark:text-white">
                  📄 Relay script <code className="font-mono text-blue-600 dark:text-blue-400">script/server-relay.js</code>
                </p>
                <button
                  onClick={() => handleCopy('node script/server-relay.js', 'relay-cmd-tab4')}
                  className="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
                >
                  {copiedField === 'relay-cmd-tab4' ? '✓ Copied!' : '📋 Copy Start Command'}
                </button>
              </div>
              <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-56">
{`// Run this once in a terminal at your project root:
//   node script/server-relay.js
//   or: npm run relay

const express    = require('express');
const cors       = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','OPTIONS'] }));
app.use(express.json());

// Endpoints:
// GET  /api/smtp-test-relay   -> Health check
// POST /api/smtp-test-relay   -> Send single email (with attachments & cc/bcc)
// POST /api/smtp-bulk-relay   -> Send bulk batch emails (with connection pooling)`}
              </pre>
            </div>
          </div>

          {/* ── Insomnia / Postman / cURL API Spec Section ── */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🚀</span> Insomnia &amp; Postman API Collection
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs mt-0.5">
                  Test dispatching single and bulk emails directly via Insomnia, Postman, or cURL.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const text =
                      activeRelayDocTab === 'insomnia'
                        ? JSON.stringify({
                            _type: 'export',
                            __export_format: 4,
                            __export_date: new Date().toISOString(),
                            __export_source: 'insomnia.desktop.app:v2023.5.8',
                            resources: [
                              {
                                _id: 'wrk_smtp',
                                _type: 'workspace',
                                name: 'SMTP CORS Relay Collection',
                                description: 'Collection for testing SMTP CORS Relay'
                              },
                              {
                                _id: 'req_health',
                                _type: 'request',
                                parentId: 'wrk_smtp',
                                name: '1. Health Check',
                                method: 'GET',
                                url: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}`
                              },
                              {
                                _id: 'req_single',
                                _type: 'request',
                                parentId: 'wrk_smtp',
                                name: '2. Send Single Email',
                                method: 'POST',
                                url: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}`,
                                headers: [{ name: 'Content-Type', value: 'application/json' }],
                                body: {
                                  mimeType: 'application/json',
                                  text: JSON.stringify({
                                    host: config.host,
                                    port: config.port,
                                    security: config.security,
                                    user: config.username,
                                    pass: cleanedPass,
                                    from: config.fromEmail || config.username,
                                    to: config.toEmail || 'recipient@example.com',
                                    cc: config.ccEmail || undefined,
                                    bcc: config.bccEmail || undefined,
                                    subject: 'Test Email via Insomnia',
                                    body: 'Hello from Insomnia API client!',
                                    isHtml: config.isHtml,
                                  }, null, 2)
                                }
                              },
                              {
                                _id: 'req_bulk',
                                _type: 'request',
                                parentId: 'wrk_smtp',
                                name: '3. Send Bulk Batch Emails',
                                method: 'POST',
                                url: `${(relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl).replace('smtp-test-relay', 'smtp-bulk-relay')}`,
                                headers: [{ name: 'Content-Type', value: 'application/json' }],
                                body: {
                                  mimeType: 'application/json',
                                  text: JSON.stringify({
                                    host: config.host,
                                    port: config.port,
                                    security: config.security,
                                    user: config.username,
                                    pass: cleanedPass,
                                    from: config.fromEmail || config.username,
                                    delayMs: 300,
                                    items: [
                                      { to: 'alice@example.com', subject: 'Invoice #101', body: 'Dear Alice, your total is $120.00' },
                                      { to: 'bob@example.com', subject: 'Invoice #102', body: 'Dear Bob, your total is $85.50' }
                                    ]
                                  }, null, 2)
                                }
                              }
                            ]
                          }, null, 2)
                        : activeRelayDocTab === 'postman'
                        ? JSON.stringify({
                            info: {
                              name: 'SMTP CORS Relay API',
                              schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
                            },
                            item: [
                              {
                                name: '1. Health Check',
                                request: {
                                  method: 'GET',
                                  url: { raw: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}` }
                                }
                              },
                              {
                                name: '2. Send Single Email',
                                request: {
                                  method: 'POST',
                                  header: [{ key: 'Content-Type', value: 'application/json' }],
                                  body: {
                                    mode: 'raw',
                                    raw: JSON.stringify({
                                      host: config.host,
                                      port: config.port,
                                      security: config.security,
                                      user: config.username,
                                      pass: cleanedPass,
                                      from: config.fromEmail || config.username,
                                      to: config.toEmail || 'recipient@example.com',
                                      cc: config.ccEmail || undefined,
                                      bcc: config.bccEmail || undefined,
                                      subject: 'Test Email via Postman',
                                      body: 'Hello from Postman!',
                                      isHtml: config.isHtml,
                                    }, null, 2)
                                  },
                                  url: { raw: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}` }
                                }
                              },
                              {
                                name: '3. Send Bulk Batch Emails',
                                request: {
                                  method: 'POST',
                                  header: [{ key: 'Content-Type', value: 'application/json' }],
                                  body: {
                                    mode: 'raw',
                                    raw: JSON.stringify({
                                      host: config.host,
                                      port: config.port,
                                      security: config.security,
                                      user: config.username,
                                      pass: cleanedPass,
                                      from: config.fromEmail || config.username,
                                      delayMs: 300,
                                      items: [
                                        { to: 'alice@example.com', subject: 'Invoice #101', body: 'Dear Alice, your total is $120.00' },
                                        { to: 'bob@example.com', subject: 'Invoice #102', body: 'Dear Bob, your total is $85.50' }
                                      ]
                                    }, null, 2)
                                  },
                                  url: { raw: `${(relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl).replace('smtp-test-relay', 'smtp-bulk-relay')}` }
                                }
                              }
                            ]
                          }, null, 2)
                        : activeRelayDocTab === 'curl-single'
                        ? `curl -X POST "${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    host: config.host,
    port: config.port,
    security: config.security,
    user: config.username,
    pass: cleanedPass,
    from: config.fromEmail || config.username,
    to: config.toEmail || 'recipient@example.com',
    cc: config.ccEmail || undefined,
    bcc: config.bccEmail || undefined,
    subject: 'Test Email via cURL',
    body: 'Hello from cURL terminal dispatch!',
    isHtml: config.isHtml,
  }, null, 2)}'`
                        : `curl -X POST "${(relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl).replace('smtp-test-relay', 'smtp-bulk-relay')}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    host: config.host,
    port: config.port,
    security: config.security,
    user: config.username,
    pass: cleanedPass,
    from: config.fromEmail || config.username,
    delayMs: 300,
    items: [
      { to: 'alice@example.com', subject: 'Invoice #101', body: 'Dear Alice, your order is ready!' },
      { to: 'bob@example.com', subject: 'Invoice #102', body: 'Dear Bob, your order is ready!' }
    ]
  }, null, 2)}'`
                    handleCopy(text, `api-doc-${activeRelayDocTab}`)
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-md shadow-violet-600/20"
                >
                  {copiedField === `api-doc-${activeRelayDocTab}` ? '✓ Copied to Clipboard!' : '📋 Copy Collection / Payload'}
                </button>
              </div>
            </div>

            {/* Doc Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              {[
                { id: 'insomnia',    label: '🟣 Insomnia v4 (JSON Export)' },
                { id: 'postman',     label: '🟠 Postman v2.1 (JSON Export)' },
                { id: 'curl-single', label: '⚡ cURL (Single Email)' },
                { id: 'curl-bulk',   label: '📦 cURL (Bulk Batch Array)' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveRelayDocTab(t.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeRelayDocTab === t.id
                      ? 'bg-slate-200 text-slate-900 font-semibold dark:bg-slate-800 dark:text-white border border-slate-300 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Code Block for Doc */}
            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto leading-relaxed max-h-72">
              {activeRelayDocTab === 'insomnia' &&
                JSON.stringify({
                  _type: 'export',
                  __export_format: 4,
                  __export_date: new Date().toISOString(),
                  __export_source: 'insomnia.desktop.app:v2023.5.8',
                  resources: [
                    {
                      _id: 'wrk_smtp',
                      _type: 'workspace',
                      name: 'SMTP CORS Relay Collection',
                      description: 'Collection for testing SMTP CORS Relay'
                    },
                    {
                      _id: 'req_health',
                      _type: 'request',
                      parentId: 'wrk_smtp',
                      name: '1. Health Check',
                      method: 'GET',
                      url: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}`
                    },
                    {
                      _id: 'req_single',
                      _type: 'request',
                      parentId: 'wrk_smtp',
                      name: '2. Send Single Email',
                      method: 'POST',
                      url: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}`,
                      headers: [{ name: 'Content-Type', value: 'application/json' }],
                      body: {
                        mimeType: 'application/json',
                        text: JSON.stringify({
                          host: config.host,
                          port: config.port,
                          security: config.security,
                          user: config.username,
                          pass: cleanedPass,
                          from: config.fromEmail || config.username,
                          to: config.toEmail || 'recipient@example.com',
                          cc: config.ccEmail || undefined,
                          bcc: config.bccEmail || undefined,
                          subject: 'Test Email via Insomnia',
                          body: 'Hello from Insomnia API client!',
                          isHtml: config.isHtml,
                        }, null, 2)
                      }
                    },
                    {
                      _id: 'req_bulk',
                      _type: 'request',
                      parentId: 'wrk_smtp',
                      name: '3. Send Bulk Batch Emails',
                      method: 'POST',
                      url: `${(relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl).replace('smtp-test-relay', 'smtp-bulk-relay')}`,
                      headers: [{ name: 'Content-Type', value: 'application/json' }],
                      body: {
                        mimeType: 'application/json',
                        text: JSON.stringify({
                          host: config.host,
                          port: config.port,
                          security: config.security,
                          user: config.username,
                          pass: cleanedPass,
                          from: config.fromEmail || config.username,
                          delayMs: 300,
                          items: [
                            { to: 'alice@example.com', subject: 'Invoice #101', body: 'Dear Alice, your total is $120.00' },
                            { to: 'bob@example.com', subject: 'Invoice #102', body: 'Dear Bob, your total is $85.50' }
                          ]
                        }, null, 2)
                      }
                    }
                  ]
                }, null, 2)}

              {activeRelayDocTab === 'postman' &&
                JSON.stringify({
                  info: {
                    name: 'SMTP CORS Relay API',
                    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
                  },
                  item: [
                    {
                      name: '1. Health Check',
                      request: {
                        method: 'GET',
                        url: { raw: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}` }
                      }
                    },
                    {
                      name: '2. Send Single Email',
                      request: {
                        method: 'POST',
                        header: [{ key: 'Content-Type', value: 'application/json' }],
                        body: {
                          mode: 'raw',
                          raw: JSON.stringify({
                            host: config.host,
                            port: config.port,
                            security: config.security,
                            user: config.username,
                            pass: cleanedPass,
                            from: config.fromEmail || config.username,
                            to: config.toEmail || 'recipient@example.com',
                            cc: config.ccEmail || undefined,
                            bcc: config.bccEmail || undefined,
                            subject: 'Test Email via Postman',
                            body: 'Hello from Postman!',
                            isHtml: config.isHtml,
                          }, null, 2)
                        },
                        url: { raw: `${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}` }
                      }
                    },
                    {
                      name: '3. Send Bulk Batch Emails',
                      request: {
                        method: 'POST',
                        header: [{ key: 'Content-Type', value: 'application/json' }],
                        body: {
                          mode: 'raw',
                          raw: JSON.stringify({
                            host: config.host,
                            port: config.port,
                            security: config.security,
                            user: config.username,
                            pass: cleanedPass,
                            from: config.fromEmail || config.username,
                            delayMs: 300,
                            items: [
                              { to: 'alice@example.com', subject: 'Invoice #101', body: 'Dear Alice, your total is $120.00' },
                              { to: 'bob@example.com', subject: 'Invoice #102', body: 'Dear Bob, your total is $85.50' }
                            ]
                          }, null, 2)
                        },
                        url: { raw: `${(relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl).replace('smtp-test-relay', 'smtp-bulk-relay')}` }
                      }
                    }
                  ]
                }, null, 2)}

              {activeRelayDocTab === 'curl-single' &&
                `curl -X POST "${relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    host: config.host,
    port: config.port,
    security: config.security,
    user: config.username,
    pass: cleanedPass,
    from: config.fromEmail || config.username,
    to: config.toEmail || 'recipient@example.com',
    cc: config.ccEmail || undefined,
    bcc: config.bccEmail || undefined,
    subject: 'Test Email via cURL',
    body: 'Hello from cURL terminal dispatch!',
    isHtml: config.isHtml,
  }, null, 2)}'`}

              {activeRelayDocTab === 'curl-bulk' &&
                `curl -X POST "${(relayUrl.startsWith('http') ? relayUrl : 'http://127.0.0.1:3001' + relayUrl).replace('smtp-test-relay', 'smtp-bulk-relay')}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    host: config.host,
    port: config.port,
    security: config.security,
    user: config.username,
    pass: cleanedPass,
    from: config.fromEmail || config.username,
    delayMs: 300,
    items: [
      { to: 'alice@example.com', subject: 'Invoice #101', body: 'Dear Alice, your order is ready!' },
      { to: 'bob@example.com', subject: 'Invoice #102', body: 'Dear Bob, your order is ready!' }
    ]
  }, null, 2)}'`}
            </pre>
          </div>
        </div>
      )}

    </div>
  )
}
