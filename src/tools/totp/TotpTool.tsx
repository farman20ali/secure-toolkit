import { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import { CopyButton } from '../../components/CopyButton'
import { generateTotpCode, parseOtpauthUri } from './totp-logic'
import { encodeBase32, decodeBase32 } from '../encoding/encoding-lab-logic'

// Generate a cryptographically random Base32 secret using Web Crypto API (browser-only, zero network)
function generateRandomBase32Secret(bytes = 20): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  // Encode raw bytes to Base32 (RFC 4648)
  const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32[(value << (5 - bits)) & 31]
  while (output.length % 8 !== 0) output += '='
  return output.replace(/=+$/, '') // strip padding for TOTP use
}

function isValidBase32(value: string): boolean {
  return /^[A-Z2-7]+=*$/.test(value.toUpperCase().replace(/\s/g, '')) && value.replace(/\s/g, '').length >= 8
}

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

  // Base32 converter state
  const [b32Input, setB32Input] = useState('')
  const [b32Mode, setB32Mode] = useState<'encode' | 'decode'>('encode')
  const [b32Output, setB32Output] = useState('')
  const [b32Error, setB32Error] = useState('')

  const secretClean = secret.replaceAll(/\s/g, '').toUpperCase()
  const secretValid = isValidBase32(secretClean)

  const currentOtpauthUri = `otpauth://totp/${encodeURIComponent(
    issuer ? `${issuer}:${label}` : label
  )}?secret=${encodeURIComponent(secretClean)}&issuer=${encodeURIComponent(
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
    if (currentOtpauthUri && secretValid) {
      QRCode.toDataURL(currentOtpauthUri, { width: 220, margin: 2 })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''))
    }
  }, [currentOtpauthUri, secretValid])

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

  const handleGenerateSecret = () => {
    const newSecret = generateRandomBase32Secret(20) // 160-bit = secure TOTP standard
    setSecret(newSecret)
  }

  // Live Base32 converter
  useEffect(() => {
    setB32Error('')
    setB32Output('')
    if (!b32Input.trim()) return
    try {
      if (b32Mode === 'encode') {
        setB32Output(encodeBase32(b32Input))
      } else {
        setB32Output(decodeBase32(b32Input))
      }
    } catch {
      setB32Error('Invalid input for decoding.')
    }
  }, [b32Input, b32Mode])

  const progressPercent = (secondsRemaining / period) * 100
  const progressColor = progressPercent > 50 ? 'bg-emerald-500' : progressPercent > 25 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>⏱️</span>
          <span>TOTP Generator &amp; QR Tool</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm font-medium text-slate-600 dark:text-zinc-400">
          Generate live 2FA TOTP passcodes, create cryptographically-random Base32 secrets, convert Base32 ↔ text, and export setup QR codes.
        </p>
      </div>

      {/* Live Passcode Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center sm:text-left">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            Current Passcode ({label})
          </span>
          <div className={`font-mono text-4xl sm:text-5xl font-extrabold tracking-widest ${secretValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-600'}`}>
            {otpCode.slice(0, 3)} {otpCode.slice(3)}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="h-2 w-36 sm:w-48 overflow-hidden rounded-full bg-slate-200 dark:bg-zinc-800">
              <div
                className={`h-full transition-all duration-1000 ${progressColor}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">
              {secondsRemaining}s remaining
            </span>
          </div>
          {!secretValid && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Enter a valid Base32 secret to generate live codes.
            </p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          {qrCodeDataUrl && secretValid ? (
            <img src={qrCodeDataUrl} alt="TOTP QR Code" className="h-32 w-32 rounded-lg bg-white p-1.5 shadow-sm border border-slate-200 dark:border-zinc-700" />
          ) : (
            <div className="h-32 w-32 rounded-lg bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 dark:text-zinc-600 text-xs text-center border border-slate-200 dark:border-zinc-700">
              QR appears<br />after valid secret
            </div>
          )}
          <span className="text-[11px] text-slate-500 dark:text-zinc-500">Scan with Authenticator App</span>
          {qrCodeDataUrl && secretValid && (
            <a
              href={qrCodeDataUrl}
              download={`totp-${issuer}-${label}.png`}
              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              ⬇ Download QR
            </a>
          )}
        </div>
      </div>

      {/* Import URI */}
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

      {/* Configuration */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">TOTP Configuration</h2>

        {/* Secret row with generate button */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Base32 Secret Key
            </label>
            <div className="flex items-center gap-2">
              {/* Validity badge */}
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${
                secretValid
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-900'
                  : 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/30 dark:text-red-400 dark:ring-red-900'
              }`}>
                {secretValid ? '✓ Valid Base32' : '✗ Invalid Base32'}
              </span>
              <button
                onClick={handleGenerateSecret}
                className="rounded-md bg-emerald-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 transition-colors flex items-center gap-1 shadow-xs"
                title="Generate a cryptographically random 160-bit Base32 secret using Web Crypto API"
              >
                <span>⚡</span>
                <span>Generate Secret</span>
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              type="text"
              value={secret}
              onChange={(e) => setSecret(e.target.value.toUpperCase())}
              className={`w-full rounded-md border px-3 py-2 font-mono text-sm focus:outline-none dark:bg-zinc-950 dark:text-zinc-100 ${
                secretValid
                  ? 'border-emerald-400 bg-white focus:border-emerald-500 dark:border-emerald-700'
                  : 'border-red-400 bg-red-50/50 focus:border-red-500 dark:border-red-800 dark:bg-red-950/10'
              }`}
              placeholder="e.g. JBSWY3DPEHPK3PXP"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <CopyButton value={secret} label="Copy Secret" />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-zinc-500">
            RFC 4648 Base32 alphabet (A–Z, 2–7). Click <strong>⚡ Generate Secret</strong> to create a secure 160-bit random key using your browser's Web Crypto API — nothing is sent anywhere.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 pt-2 border-t border-slate-200 dark:border-zinc-800">
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
              Time Window / Period
            </label>
            <input
              type="number"
              value={period}
              onChange={(e) => setPeriod(parseInt(e.target.value, 10) || 30)}
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>
        </div>
      </div>

      {/* OTPAuth URI row */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-zinc-800 dark:bg-zinc-950 shadow-xs gap-3">
        <span className="font-mono text-xs text-slate-700 dark:text-zinc-400 truncate flex-1">
          {currentOtpauthUri}
        </span>
        <CopyButton value={currentOtpauthUri} label="Copy OTPAuth URI" />
      </div>

      {/* Base32 Converter Panel */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/50 dark:bg-emerald-950/20 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-emerald-900 dark:text-emerald-400 flex items-center gap-2">
              <span>🔡</span>
              <span>Base32 Encoder / Decoder</span>
            </h2>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-500 mt-0.5">
              Convert plain text → Base32 to use as a TOTP secret, or decode a Base32 secret to readable text. Pure JS, runs in your browser.
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2">
          {(['encode', 'decode'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setB32Mode(m)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition border ${
                b32Mode === m
                  ? 'border-emerald-500 bg-emerald-600 text-white'
                  : 'border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-400'
              }`}
            >
              {m === 'encode' ? 'Text → Base32' : 'Base32 → Text'}
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-400">
              {b32Mode === 'encode' ? 'Plain Text Input' : 'Base32 Input'}
            </label>
            <textarea
              rows={3}
              value={b32Input}
              onChange={(e) => setB32Input(e.target.value)}
              placeholder={b32Mode === 'encode' ? 'Enter text to encode as Base32…' : 'Paste Base32 string to decode…'}
              className="w-full rounded-lg border border-emerald-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none resize-none dark:border-emerald-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-emerald-800 dark:text-emerald-400">
                {b32Mode === 'encode' ? 'Base32 Output' : 'Decoded Text'}
              </label>
              <div className="flex items-center gap-2">
                {b32Output && b32Mode === 'encode' && (
                  <button
                    onClick={() => setSecret(b32Output.replace(/=+$/, ''))}
                    className="rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500 transition"
                    title="Use this as the TOTP secret"
                  >
                    Use as Secret ↑
                  </button>
                )}
                {b32Output && <CopyButton value={b32Output} label="Copy" />}
              </div>
            </div>
            <div className={`min-h-[76px] rounded-lg border px-3 py-2 font-mono text-sm break-all ${
              b32Error
                ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400'
                : 'border-emerald-300 bg-white text-emerald-800 dark:border-emerald-800 dark:bg-zinc-950 dark:text-emerald-300'
            }`}>
              {b32Error ? `⚠️ ${b32Error}` : b32Output || <span className="text-slate-400 dark:text-zinc-600 text-xs italic">Output appears here…</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
