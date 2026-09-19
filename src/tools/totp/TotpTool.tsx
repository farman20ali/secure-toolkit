import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { CopyButton } from '../../components/CopyButton'
import { generateTotpCode, parseOtpauthUri } from './totp-logic'

export default function TotpTool() {
  const [secret, setSecret] = useState('JBSWY3DPEHPK3PXP')
  const [issuer, setIssuer] = useState('SecureToolkit')
  const [label, setLabel] = useState('user@example.com')
  const [algorithm, setAlgorithm] = useState('SHA1')
  const [digits, setDigits] = useState(6)
  const [period, setPeriod] = useState(30)

  const [otpCode, setOtpCode] = useState('------')
  const [secondsRemaining, setSecondsRemaining] = useState(30)

  const [uriInput, setUriInput] = useState('')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')

  const currentOtpauthUri = `otpauth://totp/${encodeURIComponent(
    issuer ? `${issuer}:${label}` : label
  )}?secret=${encodeURIComponent(secret.replaceAll(/\s/g, '').toUpperCase())}&issuer=${encodeURIComponent(
    issuer
  )}&algorithm=${algorithm}&digits=${digits}&period=${period}`

  useEffect(() => {
    const updateToken = () => {
      const result = generateTotpCode(secret, algorithm, digits, period)
      setOtpCode(result.code)
      setSecondsRemaining(result.secondsRemaining)
    }

    updateToken()
    const timer = setInterval(updateToken, 1000)
    return () => clearInterval(timer)
  }, [secret, algorithm, digits, period])

  useEffect(() => {
    if (currentOtpauthUri) {
      QRCode.toDataURL(currentOtpauthUri, { width: 220, margin: 2 })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''))
    }
  }, [currentOtpauthUri])

  const handleParseUri = () => {
    if (!uriInput) return
    const parsed = parseOtpauthUri(uriInput)
    if (parsed) {
      setSecret(parsed.secret)
      setIssuer(parsed.issuer || 'App')
      setLabel(parsed.label || 'User')
      setAlgorithm(parsed.algorithm || 'SHA1')
      setDigits(parsed.digits || 6)
      setPeriod(parsed.period || 30)
    }
  }

  const progressPercent = (secondsRemaining / period) * 100

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>⏱️</span>
          <span>TOTP Generator & QR Tool</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Generate live 2FA TOTP passcodes, interactive OTPAuth URIs, countdown clocks, and mobile setup QR codes.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Current Passcode ({label})
          </span>
          <div className="font-mono text-4xl sm:text-5xl font-extrabold tracking-widest text-emerald-600 dark:text-emerald-400">
            {otpCode.slice(0, 3)} {otpCode.slice(3)}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="h-2 w-36 sm:w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className="h-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">
              {secondsRemaining}s remaining
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center">
          {qrCodeDataUrl ? (
            <img src={qrCodeDataUrl} alt="TOTP QR Code" className="h-32 w-32 rounded-lg bg-white p-1.5 shadow-sm border border-slate-200 dark:border-zinc-700" />
          ) : null}
          <span className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">Scan with Authenticator App</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
          Import otpauth:// URI
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={uriInput}
            onChange={(e) => setUriInput(e.target.value)}
            placeholder="otpauth://totp/Example:user@domain.com?secret=JBSWY3DPEHPK3PXP..."
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
          <button
            onClick={handleParseUri}
            className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs transition-colors"
          >
            Import
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Base32 Secret Key
          </label>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value.toUpperCase())}
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Issuer / Service Name
          </label>
          <input
            type="text"
            value={issuer}
            onChange={(e) => setIssuer(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Account Label / Email
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            HMAC Algorithm
          </label>
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value="SHA1">SHA-1 (Default Standard)</option>
            <option value="SHA256">SHA-256</option>
            <option value="SHA512">SHA-512</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Digits
          </label>
          <select
            value={digits}
            onChange={(e) => setDigits(parseInt(e.target.value, 10))}
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <option value={6}>6 Digits</option>
            <option value={8}>8 Digits</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Time Window (Period)
          </label>
          <input
            type="number"
            value={period}
            onChange={(e) => setPeriod(parseInt(e.target.value, 10) || 30)}
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 shadow-xs">
        <span className="font-mono text-xs text-slate-700 dark:text-zinc-400 truncate">
          {currentOtpauthUri}
        </span>
        <CopyButton value={currentOtpauthUri} label="Copy OTPAuth URI" />
      </div>
    </div>
  )
}
