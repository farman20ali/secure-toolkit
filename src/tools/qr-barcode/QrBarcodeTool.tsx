import { useState, useRef, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import JsBarcode from 'jsbarcode'
import { CopyButton } from '../../components/CopyButton'
import { analyzeQrSecurity, validateBarcode } from './qr-barcode-logic'

export default function QrBarcodeTool() {
  const [activeTab, setActiveTab] = useState<'qr-gen' | 'qr-scan' | 'barcode'>('qr-gen')

  const [qrType, setQrType] = useState<'url' | 'wifi' | 'text' | 'totp'>('url')
  const [qrInputText, setQrInputText] = useState('https://example.com/login')
  const [wifiSsid, setWifiSsid] = useState('MyNetwork')
  const [wifiPass, setWifiPass] = useState('Secret123')
  const [wifiType, setWifiType] = useState('WPA')
  const [totpSecret, setTotpSecret] = useState('JBSWY3DPEHPK3PXP')
  const [totpLabel, setTotpLabel] = useState('user@example.com')

  const [qrDataUrl, setQrDataUrl] = useState<string>('')
  const [scannedText, setScannedText] = useState<string>('')
  const [scanError, setScanError] = useState<string>('')

  const [barcodeFormat, setBarcodeFormat] = useState<'CODE128' | 'EAN13' | 'EAN8' | 'UPC'>('CODE128')
  const [barcodeValue, setBarcodeValue] = useState('4006381333931')
  const barcodeSvgRef = useRef<SVGSVGElement | null>(null)

  const getQrPayload = useCallback(() => {
    if (qrType === 'wifi') {
      return `WIFI:S:${wifiSsid};T:${wifiType};P:${wifiPass};;`
    }
    if (qrType === 'totp') {
      return `otpauth://totp/${encodeURIComponent(totpLabel)}?secret=${encodeURIComponent(totpSecret)}&issuer=SecureToolkit`
    }
    return qrInputText
  }, [qrType, wifiSsid, wifiType, wifiPass, totpLabel, totpSecret, qrInputText])

  useEffect(() => {
    if (activeTab === 'qr-gen') {
      const payload = getQrPayload()
      if (payload) {
        QRCode.toDataURL(payload, { width: 300, margin: 2 })
          .then((url) => setQrDataUrl(url))
          .catch(() => setQrDataUrl(''))
      } else {
        setQrDataUrl('')
      }
    }
  }, [getQrPayload, activeTab])

  useEffect(() => {
    if (activeTab === 'barcode' && barcodeSvgRef.current && barcodeValue) {
      try {
        JsBarcode(barcodeSvgRef.current, barcodeValue, {
          format: barcodeFormat,
          width: 2,
          height: 80,
          displayValue: true,
          background: '#09090b',
          lineColor: '#f4f4f5',
        })
      } catch {
        // invalid barcode value
      }
    }
  }, [activeTab, barcodeFormat, barcodeValue])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setScanError('')
    setScannedText('')

    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setScanError('Failed to initialize 2D canvas context.')
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const code = jsQR(imageData.data, imageData.width, imageData.height)
        if (code) {
          setScannedText(code.data)
        } else {
          setScanError('No readable QR code found in the uploaded image.')
        }
      }
      img.src = event.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  const securityReport = scannedText ? analyzeQrSecurity(scannedText) : null
  const barcodeValidation = validateBarcode(barcodeFormat, barcodeValue)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>📱</span>
          <span>QR & Barcode Security Lab</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-600 dark:text-zinc-400">
          Generate, scan, decode, and security-analyze QR codes and barcodes for dangerous URLs, embedded credentials, and format validity—100% locally.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-zinc-800 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('qr-gen')}
          className={`border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'qr-gen'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          QR Generator
        </button>
        <button
          onClick={() => setActiveTab('qr-scan')}
          className={`border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'qr-scan'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          Decode & Security Analyzer
        </button>
        <button
          onClick={() => setActiveTab('barcode')}
          className={`border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors ${
            activeTab === 'barcode'
              ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-zinc-200'
          }`}
        >
          Barcode Toolkit
        </button>
      </div>

      {/* TAB 1: QR Generator */}
      {activeTab === 'qr-gen' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Payload Type
              </label>
              <select
                value={qrType}
                onChange={(e) => setQrType(e.target.value as any)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="url">URL Link</option>
                <option value="text">Plain Text</option>
                <option value="wifi">Wi-Fi Connection</option>
                <option value="totp">TOTP 2FA URI</option>
              </select>
            </div>

            {qrType === 'url' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Destination URL
                </label>
                <input
                  type="text"
                  value={qrInputText}
                  onChange={(e) => setQrInputText(e.target.value)}
                  placeholder="https://example.com"
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            )}

            {qrType === 'text' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Custom Text Content
                </label>
                <textarea
                  rows={4}
                  value={qrInputText}
                  onChange={(e) => setQrInputText(e.target.value)}
                  placeholder="Enter text to encode into QR code..."
                  className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                />
              </div>
            )}

            {qrType === 'wifi' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Network SSID
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Wi-Fi Password
                  </label>
                  <input
                    type="password"
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Encryption Mode
                  </label>
                  <select
                    value={wifiType}
                    onChange={(e) => setWifiType(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  >
                    <option value="WPA">WPA / WPA2 / WPA3</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open (No Password)</option>
                  </select>
                </div>
              </div>
            )}

            {qrType === 'totp' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Account Label
                  </label>
                  <input
                    type="text"
                    value={totpLabel}
                    onChange={(e) => setTotpLabel(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Base32 Secret Key
                  </label>
                  <input
                    type="text"
                    value={totpSecret}
                    onChange={(e) => setTotpSecret(e.target.value.toUpperCase())}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                </div>
              </div>
            )}

            <div className="pt-2">
              <span className="text-xs text-slate-500 dark:text-zinc-500">Payload Preview:</span>
              <p className="mt-0.5 truncate font-mono text-xs text-slate-700 dark:text-zinc-400">
                {getQrPayload()}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            {qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="Generated QR Code" className="h-52 w-52 rounded-md bg-white p-2 shadow-sm border border-slate-200 dark:border-zinc-700" />
                <a
                  href={qrDataUrl}
                  download="qr-code.png"
                  className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow-xs"
                >
                  Download QR Code
                </a>
              </>
            ) : (
              <span className="text-xs text-slate-400 dark:text-zinc-500">Enter payload to render QR code</span>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: QR Scanner & Security Analyzer */}
      {activeTab === 'qr-scan' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/30">
            <input
              type="file"
              accept="image/*"
              id="qr-upload"
              onChange={handleImageUpload}
              className="hidden"
            />
            <label
              htmlFor="qr-upload"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-500 transition-colors"
            >
              <span>📁 Upload QR Image (PNG, JPG, WEBP)</span>
            </label>
            <p className="mt-2 text-xs text-slate-500 dark:text-zinc-500">
              Select any QR code image to inspect its raw data and perform instant browser-local security analysis.
            </p>
          </div>

          {scanError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
              ⚠️ {scanError}
            </div>
          )}

          {scannedText && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                    Decoded QR Payload Content
                  </h3>
                  <CopyButton value={scannedText} label="Copy Payload" />
                </div>
                <div className="mt-2 rounded-md bg-slate-100 p-3 font-mono text-xs text-emerald-600 dark:bg-zinc-950 dark:text-emerald-400 break-all">
                  {scannedText}
                </div>
              </div>

              {securityReport && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                    🛡️ Security & Privacy Analysis Report
                  </h3>

                  <div className="space-y-3">
                    {securityReport.issues.map((issue, idx) => {
                      const badgeStyles = {
                        danger: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800',
                        warning: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
                        info: 'bg-slate-100 text-slate-900 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
                        success: 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
                      }[issue.level]

                      return (
                        <div key={idx} className={`rounded-lg border p-3 ${badgeStyles}`}>
                          <div className="font-semibold text-xs">{issue.title}</div>
                          <div className="mt-0.5 text-xs opacity-90">{issue.desc}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Barcode Toolkit */}
      {activeTab === 'barcode' && (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2 rounded-xl border border-slate-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Barcode Format
              </label>
              <select
                value={barcodeFormat}
                onChange={(e) => {
                  const newFmt = e.target.value as any
                  setBarcodeFormat(newFmt)
                  if (newFmt === 'EAN13') setBarcodeValue('4006381333931')
                  else if (newFmt === 'EAN8') setBarcodeValue('73513537')
                  else if (newFmt === 'UPC') setBarcodeValue('012345678905')
                  else setBarcodeValue('CODE128-DEMO')
                }}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="CODE128">Code 128 (Alphanumeric)</option>
                <option value="EAN13">EAN-13 (13 Digits + Checksum)</option>
                <option value="EAN8">EAN-8 (8 Digits + Checksum)</option>
                <option value="UPC">UPC-A (12 Digits + Checksum)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                Barcode Value
              </label>
              <input
                type="text"
                value={barcodeValue}
                onChange={(e) => setBarcodeValue(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-emerald-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>

            <div className="pt-2">
              {barcodeValidation.valid ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 font-semibold">
                  ✓ Valid format & checksum verification passed for {barcodeFormat}.
                </div>
              ) : (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400 font-semibold">
                  ⚠️ Validation Alert: {barcodeValidation.reason}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50 shadow-xs">
            <svg ref={barcodeSvgRef} className="max-w-full"></svg>
          </div>
        </div>
      )}
    </div>
  )
}
