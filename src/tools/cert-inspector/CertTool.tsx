import { useState, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

// ─── Minimal ASN.1 DER Parser for X.509 Certificates ────────────────────────

type ParsedCert = {
  subject: Record<string, string>
  issuer: Record<string, string>
  serialNumber: string
  validNotBefore: Date | null
  validNotAfter: Date | null
  sigAlgOid: string
  sigAlgName: string
  fingerprintSha256: string
  isExpired: boolean
  isNotYetValid: boolean
  daysRemaining: number | null
}

const OID_NAMES: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.12': 'Title',
  '1.2.840.113549.1.1.1': 'RSA Encryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.10045.2.1': 'EC Public Key',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
}

function parseOid(bytes: Uint8Array, start: number, length: number): string {
  if (length === 0) return ''
  const first = bytes[start]!
  const components: number[] = [Math.floor(first / 40), first % 40]
  let value = 0
  for (let i = 1; i < length; i++) {
    const b = bytes[start + i]!
    value = (value << 7) | (b & 0x7f)
    if ((b & 0x80) === 0) {
      components.push(value)
      value = 0
    }
  }
  return components.join('.')
}

function parseDerTime(str: string): Date | null {
  try {
    // UTCTime (YYMMDDHHMMSSZ) or GeneralizedTime (YYYYMMDDHHMMSSZ)
    let year = 0
    let rest = ''
    if (str.length === 13 && str.endsWith('Z')) {
      const yy = parseInt(str.substring(0, 2), 10)
      year = yy >= 50 ? 1900 + yy : 2000 + yy
      rest = str.substring(2)
    } else if (str.length === 15 && str.endsWith('Z')) {
      year = parseInt(str.substring(0, 4), 10)
      rest = str.substring(4)
    } else {
      return null
    }
    const month = parseInt(rest.substring(0, 2), 10) - 1
    const day = parseInt(rest.substring(2, 4), 10)
    const hour = parseInt(rest.substring(4, 6), 10)
    const min = parseInt(rest.substring(6, 8), 10)
    const sec = parseInt(rest.substring(8, 10), 10)
    return new Date(Date.UTC(year, month, day, hour, min, sec))
  } catch {
    return null
  }
}

async function computeSha256Fingerprint(u8: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', u8.buffer as ArrayBuffer)
  const view = new Uint8Array(buf)
  const hexParts: string[] = []
  for (let i = 0; i < view.length; i++) {
    hexParts.push(view[i]!.toString(16).padStart(2, '0').toUpperCase())
  }
  return hexParts.join(':')
}

export async function parseX509Pem(pem: string): Promise<ParsedCert> {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 space]+-----/g, '')
    .replace(/-----END [A-Z0-9 space]+-----/g, '')
    .replace(/\s+/g, '')
  
  if (!b64) throw new Error('No valid PEM base64 data found.')

  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)

  const fingerprint = await computeSha256Fingerprint(u8)

  // Basic TLV scanning
  let pos = 0

  function readTlv() {
    if (pos >= u8.length) throw new Error('Unexpected end of DER data.')
    const tag = u8[pos++]!
    let len = u8[pos++]!
    if (len & 0x80) {
      const numBytes = len & 0x7f
      len = 0
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | u8[pos++]!
      }
    }
    const valStart = pos
    pos += len
    return { tag, len, valStart, valBytes: u8.subarray(valStart, pos) }
  }

  // 1. Root Sequence
  const root = readTlv()
  if ((root.tag & 0x1f) !== 0x10) throw new Error('Invalid X.509 DER structure (expected SEQUENCE).')

  // 2. tbsCertificate Sequence
  pos = root.valStart
  const tbs = readTlv()

  // Scan inside tbsCertificate
  let tbsPos = tbs.valStart

  function readNextTbs() {
    pos = tbsPos
    const item = readTlv()
    tbsPos = pos
    return item
  }

  // Version [0] (optional)
  let item = readNextTbs()
  if ((item.tag & 0xc0) === 0xa0) { // Context-specific [0]
    item = readNextTbs()
  }

  // Serial Number (INTEGER)
  const serialBytes = item.valBytes
  let serialHex = ''
  for (let i = 0; i < serialBytes.length; i++) {
    serialHex += serialBytes[i]!.toString(16).padStart(2, '0').toUpperCase()
  }

  // Signature AlgorithmIdentifier (SEQUENCE)
  const sigAlgItem = readNextTbs()
  let sigAlgOid = ''
  if (sigAlgItem.valBytes.length > 2 && sigAlgItem.valBytes[0] === 0x06) {
    const oidLen = sigAlgItem.valBytes[1]!
    sigAlgOid = parseOid(sigAlgItem.valBytes, 2, oidLen)
  }

  // Issuer Name (SEQUENCE)
  const issuerItem = readNextTbs()
  const issuer = parseDistinguishedName(issuerItem.valBytes)

  // Validity (SEQUENCE)
  const validityItem = readNextTbs()
  let validNotBefore: Date | null = null
  let validNotAfter: Date | null = null

  if (validityItem.valBytes.length > 0) {
    let vPos = 0
    function readValidityTlv() {
      const tag = validityItem.valBytes[vPos++]!
      let len = validityItem.valBytes[vPos++]!
      if (len & 0x80) {
        const numBytes = len & 0x7f
        len = 0
        for (let i = 0; i < numBytes; i++) len = (len << 8) | validityItem.valBytes[vPos++]!
      }
      const valStr = new TextDecoder('ascii').decode(validityItem.valBytes.subarray(vPos, vPos + len))
      vPos += len
      return { tag, valStr }
    }
    const t1 = readValidityTlv()
    const t2 = readValidityTlv()
    validNotBefore = parseDerTime(t1.valStr)
    validNotAfter = parseDerTime(t2.valStr)
  }

  // Subject Name (SEQUENCE)
  const subjectItem = readNextTbs()
  const subject = parseDistinguishedName(subjectItem.valBytes)

  const now = new Date()
  const isExpired = validNotAfter ? now > validNotAfter : false
  const isNotYetValid = validNotBefore ? now < validNotBefore : false
  const daysRemaining = validNotAfter
    ? Math.max(0, Math.floor((validNotAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null

  return {
    subject,
    issuer,
    serialNumber: serialHex || '00',
    validNotBefore,
    validNotAfter,
    sigAlgOid,
    sigAlgName: OID_NAMES[sigAlgOid] || sigAlgOid || 'SHA-256 with RSA',
    fingerprintSha256: fingerprint,
    isExpired,
    isNotYetValid,
    daysRemaining,
  }
}

function parseDistinguishedName(bytes: Uint8Array): Record<string, string> {
  const res: Record<string, string> = {}
  let p = 0
  while (p < bytes.length) {
    p++ // skip rdnTag
    let rdnLen = bytes[p++]!
    if (rdnLen & 0x80) {
      const nb = rdnLen & 0x7f
      rdnLen = 0
      for (let i = 0; i < nb; i++) rdnLen = (rdnLen << 8) | bytes[p++]!
    }
    const rdnEnd = p + rdnLen
    while (p < rdnEnd && p < bytes.length) {
      p++ // skip atvTag
      let atvLen = bytes[p++]!
      if (atvLen & 0x80) {
        const nb = atvLen & 0x7f
        atvLen = 0
        for (let i = 0; i < nb; i++) atvLen = (atvLen << 8) | bytes[p++]!
      }
      const atvEnd = p + atvLen
      // Inside AttributeTypeAndValue SEQUENCE
      if (p < atvEnd && bytes[p] === 0x06) {
        p++ // skip OID tag
        const oidL = bytes[p++]!
        const oidStr = parseOid(bytes, p, oidL)
        p += oidL
        if (p < atvEnd) {
          p++ // skip strTag
          let strL = bytes[p++]!
          if (strL & 0x80) {
            const nb = strL & 0x7f
            strL = 0
            for (let i = 0; i < nb; i++) strL = (strL << 8) | bytes[p++]!
          }
          const valStr = new TextDecoder('utf-8').decode(bytes.subarray(p, p + strL))
          p += strL
          const key = OID_NAMES[oidStr] || oidStr
          res[key] = valStr
        }
      }
      p = atvEnd
    }
    p = rdnEnd
  }
  return res
}

// ─── Self-Signed Dev Cert Generator ──────────────────────────────────────────

async function generateDevRsaKeyPairPem(): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )

  const pubExport = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const privExport = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

  const toB64Pem = (buf: ArrayBuffer, header: string) => {
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    const b64 = btoa(bin)
    const lines = b64.match(/.{1,64}/g) || []
    return `-----BEGIN ${header}-----\n${lines.join('\n')}\n-----END ${header}-----`
  }

  return {
    publicKeyPem: toB64Pem(pubExport, 'PUBLIC KEY'),
    privateKeyPem: toB64Pem(privExport, 'PRIVATE KEY'),
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CertMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-zinc-800/60 py-2.5 last:border-0">
      <span className="shrink-0 text-xs font-medium text-zinc-400">{label}</span>
      <span className="break-all text-right font-mono text-xs text-zinc-200">{value}</span>
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
          <label htmlFor="cert-pem-input" className="block text-sm font-medium text-zinc-300">
            Paste X.509 Certificate (PEM Format)
          </label>
          <label className="text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer">
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
          className="w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none resize-y"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">
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
                  ? 'border-red-500/30 bg-red-950/20'
                  : parsed.isNotYetValid
                    ? 'border-amber-500/30 bg-amber-950/20'
                    : 'border-emerald-500/30 bg-emerald-950/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`font-bold text-sm ${parsed.isExpired ? 'text-red-400' : 'text-emerald-400'}`}>
                    {parsed.isExpired ? '⛔ Certificate Expired' : '✅ Certificate Active'}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {parsed.validNotAfter ? `Expires on ${parsed.validNotAfter.toUTCString()}` : 'No expiry date'}
                  </p>
                </div>
                {parsed.daysRemaining != null && !parsed.isExpired && (
                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/30">
                    {parsed.daysRemaining} days left
                  </span>
                )}
              </div>
            </div>

            {/* Subject Details */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
                Subject (Issued To)
              </p>
              {Object.entries(parsed.subject).map(([k, v]) => (
                <CertMetaRow key={k} label={k} value={v} />
              ))}
              {Object.keys(parsed.subject).length === 0 && (
                <p className="text-xs text-zinc-500 italic">No subject attributes parsed.</p>
              )}
            </div>

            {/* Issuer Details */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
                Issuer (Issued By)
              </p>
              {Object.entries(parsed.issuer).map(([k, v]) => (
                <CertMetaRow key={k} label={k} value={v} />
              ))}
              {Object.keys(parsed.issuer).length === 0 && (
                <p className="text-xs text-zinc-500 italic">No issuer attributes parsed.</p>
              )}
            </div>
          </div>

          {/* Right Column: Validity & Fingerprint */}
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 pb-2">
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
      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">
          Generate Dev Key Pair (RSA 2048-bit)
        </h2>
        <div className="space-y-1.5">
          <label className="block text-xs text-zinc-300">Target Hostname / Domain</label>
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40"
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
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Public Key (SPKI PEM)
              </span>
              <CopyButton text={keyPairPem.publicKeyPem} label="Copy Public Key" />
            </div>
            <textarea
              readOnly
              value={keyPairPem.publicKeyPem}
              rows={12}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-400 focus:outline-none resize-none"
            />
          </div>

          {/* Private Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                Private Key (PKCS#8 PEM)
              </span>
              <CopyButton text={keyPairPem.privateKeyPem} label="Copy Private Key" />
            </div>
            <textarea
              readOnly
              value={keyPairPem.privateKeyPem}
              rows={12}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-xs text-emerald-400 focus:outline-none resize-none"
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
        <h1 className="text-2xl font-bold text-zinc-50">X.509 Certificate Inspector &amp; Key Pair Tool</h1>
        <p className="text-sm text-zinc-400">
          Inspect X.509 certificate PEM details (Subject, Issuer, Validity, Fingerprint) or generate RSA key pairs locally.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setTab('inspector')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'inspector'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Inspect X.509 Certificate
        </button>
        <button
          type="button"
          onClick={() => setTab('generator')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            tab === 'generator'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Dev Key Pair Generator
        </button>
      </div>

      {tab === 'inspector' ? <InspectorTab /> : <GeneratorTab />}
    </div>
  )
}
