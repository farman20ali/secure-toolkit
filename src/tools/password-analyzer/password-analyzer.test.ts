import { describe, expect, it } from 'vitest'
import { analyzePassword } from './password-analyzer-logic'

describe('analyzePassword', () => {
  it('analyzes weak password correctly', () => {
    const res = analyzePassword('123456')
    expect(res.label).toBe('Very Weak')
    expect(res.hasUpper).toBe(false)
    expect(res.patternWarnings.length).toBeGreaterThan(0)
  })

  it('analyzes strong password correctly', () => {
    const res = analyzePassword('P@ssw0rd2026!SecureKey')
    expect(res.label).toBe('Very Strong')
    expect(res.hasUpper).toBe(true)
    expect(res.hasLower).toBe(true)
    expect(res.hasNumber).toBe(true)
    expect(res.hasSymbol).toBe(true)
    expect(res.entropyBits).toBeGreaterThan(60)
  })
})
