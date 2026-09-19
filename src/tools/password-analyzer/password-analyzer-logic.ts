export interface PasswordAnalysis {
  length: number
  hasUpper: boolean
  hasLower: boolean
  hasNumber: boolean
  hasSymbol: boolean
  entropyBits: number
  patternWarnings: string[]
  score: number // 0 to 100
  label: 'Very Weak' | 'Weak' | 'Moderate' | 'Strong' | 'Very Strong'
}

export function analyzePassword(password: string): PasswordAnalysis {
  if (!password) {
    return {
      length: 0,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSymbol: false,
      entropyBits: 0,
      patternWarnings: [],
      score: 0,
      label: 'Very Weak',
    }
  }

  const length = password.length
  const hasUpper = /[A-Z]/.test(password)
  const hasLower = /[a-z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  let poolSize = 0
  if (hasLower) poolSize += 26
  if (hasUpper) poolSize += 26
  if (hasNumber) poolSize += 10
  if (hasSymbol) poolSize += 32

  const entropyBits = Math.round(length * (Math.log2(poolSize || 1) * 10)) / 10

  const patternWarnings: string[] = []
  if (/(1234|2345|3456|4567|5678|6789|qwerty|asdf|zxcv)/i.test(password)) {
    patternWarnings.push('Contains common keyboard or sequential string patterns.')
  }
  if (/(.)\1{2,}/.test(password)) {
    patternWarnings.push('Contains repeated character sequences (e.g., "aaa").')
  }
  if (length < 8) {
    patternWarnings.push('Length is under recommended 8-character minimum.')
  }

  let score = 0
  if (length >= 8) score += 20
  if (length >= 12) score += 20
  if (length >= 16) score += 10
  if (hasUpper) score += 12.5
  if (hasLower) score += 12.5
  if (hasNumber) score += 12.5
  if (hasSymbol) score += 12.5

  if (patternWarnings.length > 0) {
    score = Math.max(0, score - patternWarnings.length * 15)
  }

  let label: PasswordAnalysis['label'] = 'Very Weak'
  if (score >= 80) label = 'Very Strong'
  else if (score >= 60) label = 'Strong'
  else if (score >= 40) label = 'Moderate'
  else if (score >= 20) label = 'Weak'

  return {
    length,
    hasUpper,
    hasLower,
    hasNumber,
    hasSymbol,
    entropyBits,
    patternWarnings,
    score,
    label,
  }
}
