export function analyzeQrSecurity(data: string) {
  const issues: { level: 'danger' | 'warning' | 'info' | 'success'; title: string; desc: string }[] = []
  
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
      issues.push({ level: 'success', title: 'HTTPS Enabled', desc: 'The URL uses secure transport layer encryption.' })
    } else if (urlObj.protocol === 'http:') {
      issues.push({ level: 'warning', title: 'Insecure HTTP Protocol', desc: 'This URL transmits data in plain text without SSL/TLS encryption.' })
    }

    if (urlObj.username || urlObj.password) {
      issues.push({
        level: 'danger',
        title: 'Embedded Authentication Credentials',
        desc: `Target URL contains embedded username/password (${urlObj.username}). This can be used for URL spoofing attacks!`
      })
    }

    if (data.includes('xn--') || urlObj.hostname.startsWith('xn--') || urlObj.hostname.includes('.xn--')) {
      issues.push({
        level: 'danger',
        title: 'Punycode / Homograph Attack Risk',
        desc: 'The domain name uses Punycode internationalization, which may impersonate legitimate brand domains.'
      })
    }

    const isIpHost = /^(\d{1,3}\.){3}\d{1,3}$/.test(urlObj.hostname)
    if (isIpHost) {
      issues.push({
        level: 'warning',
        title: 'Direct IP Host Target',
        desc: 'Destination is a raw IP address rather than a verified domain name.'
      })
    }

    const searchParams = urlObj.searchParams
    const redirectKeys = ['redirect', 'url', 'dest', 'destination', 'next', 'target', 'r', 'out']
    const hasRedirect = Array.from(searchParams.keys()).some((k) => redirectKeys.includes(k.toLowerCase()))
    if (hasRedirect) {
      issues.push({
        level: 'warning',
        title: 'Potential Redirect Parameter',
        desc: 'URL contains query parameters typically used for open redirects. Verify the destination parameter.'
      })
    }

    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid']
    const hasTracking = Array.from(searchParams.keys()).some((k) => trackingKeys.includes(k.toLowerCase()))
    if (hasTracking) {
      issues.push({
        level: 'info',
        title: 'Tracking Parameters Included',
        desc: 'URL includes web analytics tracking IDs (UTM / ad click IDs).'
      })
    }

    return { isUrl: true, issues, protocol: urlObj.protocol, host: urlObj.hostname, path: urlObj.pathname + urlObj.search }
  } else {
    if (/^(javascript|data|file|vbscript):/i.test(data)) {
      issues.push({
        level: 'danger',
        title: 'Suspicious Executable URI Scheme',
        desc: `Content starts with dangerous scheme: ${data.slice(0, 15)}... Do not execute script payloads!`
      })
    } else if (data.startsWith('WIFI:')) {
      issues.push({ level: 'info', title: 'Wi-Fi Configuration Payload', desc: 'Contains Wi-Fi SSID & authentication password format.' })
    } else if (data.startsWith('BEGIN:VCARD')) {
      issues.push({ level: 'info', title: 'vCard Contact Card', desc: 'Contains electronic contact info card data.' })
    } else if (data.startsWith('otpauth://')) {
      issues.push({ level: 'info', title: 'TOTP 2FA Secret Key', desc: 'Contains multi-factor authentication secret configuration.' })
    } else {
      issues.push({ level: 'info', title: 'Plain Text Payload', desc: `Length: ${data.length} characters.` })
    }
    return { isUrl: false, issues }
  }
}

export function validateBarcode(format: string, value: string): { valid: boolean; reason?: string } {
  if (!value) return { valid: false, reason: 'Value cannot be empty' }

  if (format === 'EAN13') {
    if (!/^\d{13}$/.test(value)) return { valid: false, reason: 'EAN-13 must be exactly 13 digits' }
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
    if (!/^\d{8}$/.test(value)) return { valid: false, reason: 'EAN-8 must be exactly 8 digits' }
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
    if (!/^\d{12}$/.test(value)) return { valid: false, reason: 'UPC-A must be exactly 12 digits' }
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

  return { valid: true }
}
