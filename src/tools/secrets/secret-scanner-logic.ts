export interface SecretFinding {
  line: number
  type: string
  match: string
  redacted: string
  confidence: 'High' | 'Medium'
}

const SECRET_PATTERNS: { name: string; regex: RegExp; confidence: 'High' | 'Medium' }[] = [
  { name: 'AWS Access Key ID', regex: /\b(AKIA[0-9A-Z]{16})\b/g, confidence: 'High' },
  { name: 'AWS Secret Access Key', regex: /\b([A-Za-z0-9/+=]{40})\b/g, confidence: 'Medium' },
  { name: 'GitHub Access Token', regex: /\b(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g, confidence: 'High' },
  { name: 'OpenAI API Key', regex: /\b(sk-[a-zA-Z0-9_-]{20,})\b/g, confidence: 'High' },
  { name: 'Stripe API Key', regex: /\b(sk_live_[0-9a-zA-Z]{24}|rk_live_[0-9a-zA-Z]{24})\b/g, confidence: 'High' },
  { name: 'Slack Bot Token', regex: /\b(xoxb-[0-9]{11,13}-[0-9]{11,13}-[a-zA-Z0-9]{24})\b/g, confidence: 'High' },
  { name: 'Private Key Block', regex: /(-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----)/g, confidence: 'High' },
  { name: 'JWT Token', regex: /\b(eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,})\b/g, confidence: 'High' },
  { name: 'Database Connection URI', regex: /\b((postgres|postgresql|mongodb|mysql|redis):\/\/[^\s"']+)\b/gi, confidence: 'High' },
  { name: 'Generic Password / Secret Field', regex: /\b(password|passwd|secret|api_key|apikey|auth_token)\s*[:=]\s*["']([^"'\s]{8,})["']/gi, confidence: 'Medium' },
]

export function redactSecret(secret: string): string {
  if (secret.length <= 8) return '****'
  return secret.slice(0, 4) + '…' + secret.slice(-4)
}

export function scanContentForSecrets(content: string): SecretFinding[] {
  if (!content) return []

  const lines = content.split('\n')
  const findings: SecretFinding[] = []
  const seenMatches = new Set<string>()

  lines.forEach((lineText, lineIdx) => {
    SECRET_PATTERNS.forEach((pattern) => {
      pattern.regex.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.regex.exec(lineText)) !== null) {
        const secretStr = match[1] || match[0]
        const key = `${lineIdx + 1}:${secretStr}`
        if (!seenMatches.has(key)) {
          seenMatches.add(key)
          findings.push({
            line: lineIdx + 1,
            type: pattern.name,
            match: secretStr,
            redacted: redactSecret(secretStr),
            confidence: pattern.confidence,
          })
        }
      }
    })
  })

  return findings
}
