export interface UrlSecurityReport {
  isValid: boolean
  protocol?: string
  hostname?: string
  port?: string
  pathname?: string
  username?: string
  password?: string
  params: { key: string; value: string }[]
  findings: { level: 'danger' | 'warning' | 'info' | 'success'; title: string; desc: string }[]
}

export function analyzeUrlStructure(inputUrl: string): UrlSecurityReport {
  const findings: UrlSecurityReport['findings'] = []

  let parsed: URL
  try {
    parsed = new URL(inputUrl)
  } catch {
    return {
      isValid: false,
      params: [],
      findings: [{ level: 'danger', title: 'Invalid URL Format', desc: 'Could not parse string into standard URL object.' }],
    }
  }

  // Protocol check
  if (parsed.protocol === 'https:') {
    findings.push({ level: 'success', title: 'HTTPS Enabled', desc: 'Secure transport layer encryption.' })
  } else if (parsed.protocol === 'http:') {
    findings.push({ level: 'warning', title: 'Insecure HTTP Protocol', desc: 'Data transmitted in unencrypted plaintext.' })
  } else {
    findings.push({ level: 'info', title: `Custom Scheme (${parsed.protocol})`, desc: 'Non-standard web protocol scheme.' })
  }

  // Basic auth check
  if (parsed.username || parsed.password) {
    findings.push({
      level: 'danger',
      title: 'Embedded Authentication Credentials',
      desc: `URL contains embedded username (${parsed.username}) and password. High risk of phishing or credential spoofing!`
    })
  }

  // Punycode / IP check
  if (inputUrl.includes('xn--') || parsed.hostname.startsWith('xn--') || parsed.hostname.includes('.xn--')) {
    findings.push({
      level: 'danger',
      title: 'Punycode Homograph Domain',
      desc: 'Internationalized domain name detected. Potential homograph impersonation attack.'
    })
  }

  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(parsed.hostname)) {
    findings.push({
      level: 'warning',
      title: 'Raw IP Host Target',
      desc: 'Hostname is a direct IP address rather than a verified domain name.'
    })
  }

  // Query params
  const params: { key: string; value: string }[] = []
  parsed.searchParams.forEach((val, key) => {
    params.push({ key, value: val })

    const lowerKey = key.toLowerCase()
    if (['redirect', 'url', 'dest', 'next', 'target', 'out', 'r'].includes(lowerKey)) {
      findings.push({
        level: 'warning',
        title: `Potential Open Redirect Parameter ("${key}")`,
        desc: `Value "${val}" may redirect user to an external unverified destination.`
      })
    }

    if (val.includes('<script>') || val.includes('SELECT ') || val.includes('../')) {
      findings.push({
        level: 'danger',
        title: `Suspicious Web Payload Pattern in "${key}"`,
        desc: 'Parameter value contains script tag, SQL keyword, or directory traversal sequence.'
      })
    }
  })

  return {
    isValid: true,
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === 'https:' ? '443' : '80'),
    pathname: parsed.pathname,
    username: parsed.username,
    password: parsed.password,
    params,
    findings,
  }
}
