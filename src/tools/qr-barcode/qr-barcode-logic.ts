// ─── Payload Builders ────────────────────────────────────────────────────────

export function buildWifiQrPayload(ssid: string, pass: string, type: string = 'WPA'): string {
  if (!ssid) return ''
  return `WIFI:S:${ssid};T:${type};P:${pass};;`
}

export function buildTotpQrPayload(label: string, secret: string, issuer: string = 'SecureToolkit'): string {
  if (!secret) return ''
  const cleanLabel = label || 'user@example.com'
  return `otpauth://totp/${encodeURIComponent(cleanLabel)}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}`
}

export interface VCardData {
  fn: string
  tel?: string
  email?: string
  org?: string
  title?: string
}

export function buildVCardQrPayload(card: VCardData): string {
  if (!card.fn) return ''
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${card.fn}`,
  ]
  if (card.tel) lines.push(`TEL:${card.tel}`)
  if (card.email) lines.push(`EMAIL:${card.email}`)
  if (card.org) lines.push(`ORG:${card.org}`)
  if (card.title) lines.push(`TITLE:${card.title}`)
  lines.push('END:VCARD')
  return lines.join('\n')
}

export function buildEmailQrPayload(to: string, subject?: string, body?: string): string {
  if (!to) return ''
  const params = new URLSearchParams()
  if (subject) params.set('subject', subject)
  if (body) params.set('body', body)
  const qs = params.toString()
  return `mailto:${to}${qs ? '?' + qs : ''}`
}

export function buildSmsQrPayload(number: string, message?: string): string {
  if (!number) return ''
  return `smsto:${number}:${message || ''}`
}

export function buildCryptoQrPayload(coin: 'bitcoin' | 'ethereum' | 'solana', address: string, amount?: string): string {
  if (!address) return ''
  const prefix = coin === 'ethereum' ? 'ethereum:' : coin === 'solana' ? 'solana:' : 'bitcoin:'
  return amount ? `${prefix}${address}?amount=${amount}` : `${prefix}${address}`
}

// ─── Forensic Payload Parsers ────────────────────────────────────────────────

export function parseWifiPayload(data: string): { ssid: string; pass: string; type: string } | null {
  if (!data.startsWith('WIFI:')) return null
  const ssidMatch = data.match(/S:([^;]+);/)
  const passMatch = data.match(/P:([^;]+);/)
  const typeMatch = data.match(/T:([^;]+);/)
  return {
    ssid: ssidMatch ? ssidMatch[1]! : '',
    pass: passMatch ? passMatch[1]! : '',
    type: typeMatch ? typeMatch[1]! : 'WPA',
  }
}

export function parseVCardPayload(data: string): VCardData | null {
  if (!data.includes('BEGIN:VCARD')) return null
  const getVal = (key: string) => {
    const match = data.match(new RegExp(`${key}:([^\\r\\n]+)`, 'i'))
    return match ? match[1]!.trim() : undefined
  }
  const fn = getVal('FN') || getVal('N')
  if (!fn) return null
  return {
    fn,
    tel: getVal('TEL'),
    email: getVal('EMAIL'),
    org: getVal('ORG'),
    title: getVal('TITLE'),
  }
}

export function parseTotpPayload(data: string): { label: string; secret: string; issuer?: string } | null {
  if (!data.startsWith('otpauth://')) return null
  try {
    const url = new URL(data)
    const label = decodeURIComponent(url.pathname.replace(/^\/\/totp\//, '').replace(/^\//, ''))
    const secret = url.searchParams.get('secret') || ''
    const issuer = url.searchParams.get('issuer') || undefined
    return { label, secret, issuer }
  } catch {
    return null
  }
}

export function parseCryptoPayload(data: string): { coin: string; address: string; amount?: string } | null {
  const match = data.match(/^(bitcoin|ethereum|solana):([a-zA-Z0-9]+)(\?.*)?$/i)
  if (!match) return null
  const coin = match[1]!.toLowerCase()
  const address = match[2]!
  let amount: string | undefined
  if (match[3]) {
    const params = new URLSearchParams(match[3])
    amount = params.get('amount') || undefined
  }
  return { coin, address, amount }
}

// ─── Security Forensic Inspector ─────────────────────────────────────────────

export interface QrSecurityReport {
  isUrl: boolean
  protocol?: string
  host?: string
  path?: string
  wifiParsed?: { ssid: string; pass: string; type: string } | null
  vcardParsed?: VCardData | null
  totpParsed?: { label: string; secret: string; issuer?: string } | null
  cryptoParsed?: { coin: string; address: string; amount?: string } | null
  decodedBase64?: string | null
  issues: { level: 'danger' | 'warning' | 'info' | 'success'; title: string; desc: string }[]
}

export function analyzeQrSecurity(data: string): QrSecurityReport {
  const issues: QrSecurityReport['issues'] = []

  if (!data) return { isUrl: false, issues }

  let urlObj: URL | null = null
  try {
    const tempUrl = new URL(data)
    if (['http:', 'https:'].includes(tempUrl.protocol)) {
      urlObj = tempUrl
    }
  } catch {
    // Not a standard HTTP/HTTPS URL
  }

  if (urlObj) {
    if (urlObj.protocol === 'https:') {
      issues.push({ level: 'success', title: 'HTTPS Enabled', desc: 'The destination URL uses encrypted TLS connection.' })
    } else if (urlObj.protocol === 'http:') {
      issues.push({ level: 'warning', title: 'Insecure HTTP Protocol', desc: 'Transmits data in plain text without SSL/TLS encryption.' })
    }

    if (urlObj.username || urlObj.password) {
      issues.push({
        level: 'danger',
        title: 'Embedded Authentication Credentials',
        desc: `Target URL contains embedded username/password (${urlObj.username}). High risk of URL spoofing / credential stealing!`
      })
    }

    if (data.includes('xn--') || urlObj.hostname.startsWith('xn--') || urlObj.hostname.includes('.xn--')) {
      issues.push({
        level: 'danger',
        title: 'Punycode / Homograph Attack Risk',
        desc: 'Domain uses Punycode character encoding, which can visually impersonate trusted brand domains.'
      })
    }

    const isIpHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(urlObj.hostname)
    if (isIpHost) {
      issues.push({
        level: 'warning',
        title: 'Direct IP Target Host',
        desc: 'Destination is a raw IP address rather than a verified domain name.'
      })
    }

    const searchParams = urlObj.searchParams
    const redirectKeys = ['redirect', 'url', 'dest', 'destination', 'next', 'target', 'r', 'out']
    const hasRedirect = Array.from(searchParams.keys()).some((k) => redirectKeys.includes(k.toLowerCase()))
    if (hasRedirect) {
      issues.push({
        level: 'warning',
        title: 'Potential Open Redirect Parameter',
        desc: 'URL contains query parameters typically used for open redirects. Verify destination domain.'
      })
    }

    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid']
    const hasTracking = Array.from(searchParams.keys()).some((k) => trackingKeys.includes(k.toLowerCase()))
    if (hasTracking) {
      issues.push({
        level: 'info',
        title: 'Web Analytics Tracking Included',
        desc: 'URL includes ad click or UTM campaign tracking identifiers.'
      })
    }

    return {
      isUrl: true,
      issues,
      protocol: urlObj.protocol,
      host: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
    }
  }

  // Non-URL Payloads
  if (/^(javascript|data|file|vbscript):/i.test(data)) {
    issues.push({
      level: 'danger',
      title: 'Executable Payload / Script Scheme',
      desc: `Payload starts with executable scheme (${data.slice(0, 15)}...). Do not execute!`
    })
  }

  const wifiParsed = parseWifiPayload(data)
  if (wifiParsed) {
    if (wifiParsed.type === 'WEP' || wifiParsed.type === 'nopass') {
      issues.push({
        level: 'warning',
        title: `Insecure Wi-Fi Security (${wifiParsed.type})`,
        desc: 'WEP and Open networks do not provide secure transport encryption.'
      })
    } else {
      issues.push({ level: 'success', title: 'Wi-Fi Access Point Payload', desc: `SSID: "${wifiParsed.ssid}" (${wifiParsed.type})` })
    }
  }

  const vcardParsed = parseVCardPayload(data)
  if (vcardParsed) {
    issues.push({ level: 'info', title: 'vCard Contact Card', desc: `Contact: ${vcardParsed.fn}${vcardParsed.email ? ` (${vcardParsed.email})` : ''}` })
  }

  const totpParsed = parseTotpPayload(data)
  if (totpParsed) {
    issues.push({ level: 'info', title: 'TOTP 2FA Secret URI', desc: `Account: ${totpParsed.label} (${totpParsed.issuer || '2FA'})` })
  }

  const cryptoParsed = parseCryptoPayload(data)
  if (cryptoParsed) {
    issues.push({ level: 'info', title: `${cryptoParsed.coin.toUpperCase()} Crypto Address`, desc: `Address: ${cryptoParsed.address}` })
  }

  // Auto-decode Base64 if present
  let decodedBase64: string | null = null
  if (/^[A-Za-z0-9+/=]{16,}$/.test(data.trim())) {
    try {
      const decoded = atob(data.trim())
      if (/^[\x20-\x7E\s]+$/.test(decoded)) {
        decodedBase64 = decoded
        issues.push({ level: 'info', title: 'Base64 Encoded Content Detected', desc: 'Payload contains base64 encoded text string.' })
      }
    } catch {
      // Not base64
    }
  }

  if (issues.length === 0) {
    issues.push({ level: 'info', title: 'Plain Text Payload', desc: `Length: ${data.length} characters.` })
  }

  return {
    isUrl: false,
    issues,
    wifiParsed,
    vcardParsed,
    totpParsed,
    cryptoParsed,
    decodedBase64,
  }
}

// ─── Barcode Validator ───────────────────────────────────────────────────────

export function validateBarcode(format: string, value: string): { valid: boolean; reason?: string } {
  if (!value) return { valid: false, reason: 'Barcode value cannot be empty' }

  if (format === 'EAN13') {
    if (!/^\d{13}$/.test(value)) return { valid: false, reason: 'EAN-13 must be exactly 13 numeric digits' }
    const sum = value
      .slice(0, 12)
      .split('')
      .reduce((acc, digit, idx) => acc + parseInt(digit, 10) * (idx % 2 === 0 ? 1 : 3), 0)
    const checkDigit = (10 - (sum % 10)) % 10
    if (checkDigit !== parseInt(value[12], 10)) {
      return { valid: false, reason: `Invalid EAN-13 checksum (expected ${checkDigit}, got ${value[12]})` }
    }
    return { valid: true }
  }

  if (format === 'EAN8') {
    if (!/^\d{8}$/.test(value)) return { valid: false, reason: 'EAN-8 must be exactly 8 numeric digits' }
    const sum = value
      .slice(0, 7)
      .split('')
      .reduce((acc, digit, idx) => acc + parseInt(digit, 10) * (idx % 2 === 0 ? 3 : 1), 0)
    const checkDigit = (10 - (sum % 10)) % 10
    if (checkDigit !== parseInt(value[7], 10)) {
      return { valid: false, reason: `Invalid EAN-8 checksum (expected ${checkDigit}, got ${value[7]})` }
    }
    return { valid: true }
  }

  if (format === 'UPC') {
    if (!/^\d{12}$/.test(value)) return { valid: false, reason: 'UPC-A must be exactly 12 numeric digits' }
    const sum = value
      .slice(0, 11)
      .split('')
      .reduce((acc, digit, idx) => acc + parseInt(digit, 10) * (idx % 2 === 0 ? 3 : 1), 0)
    const checkDigit = (10 - (sum % 10)) % 10
    if (checkDigit !== parseInt(value[11], 10)) {
      return { valid: false, reason: `Invalid UPC-A checksum (expected ${checkDigit}, got ${value[11]})` }
    }
    return { valid: true }
  }

  if (format === 'CODE39') {
    if (!/^[0-9A-Z\-.$/+%\s]+$/i.test(value)) {
      return { valid: false, reason: 'Code 39 only supports uppercase alphanumeric & symbols (- . $ / + % space)' }
    }
    return { valid: true }
  }

  if (format === 'ITF14') {
    if (!/^\d{14}$/.test(value)) return { valid: false, reason: 'ITF-14 must be exactly 14 numeric digits' }
    return { valid: true }
  }

  return { valid: true }
}
