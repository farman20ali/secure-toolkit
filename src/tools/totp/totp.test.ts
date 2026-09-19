import { describe, expect, it } from 'vitest'
import { generateTotpCode, parseOtpauthUri } from './totp-logic'

describe('generateTotpCode', () => {
  it('generates valid 6-digit TOTP code for standard base32 secret', () => {
    const result = generateTotpCode('JBSWY3DPEHPK3PXP')
    expect(result.code).toMatch(/^\d{6}$/)
    expect(result.secondsRemaining).toBeGreaterThanOrEqual(1)
    expect(result.secondsRemaining).toBeLessThanOrEqual(30)
  })

  it('handles spaces in secret string gracefully', () => {
    const result = generateTotpCode('JBSW Y3DP EHPK 3PXP')
    expect(result.code).toMatch(/^\d{6}$/)
  })
})

describe('parseOtpauthUri', () => {
  it('parses valid otpauth URI correctly', () => {
    const uri = 'otpauth://totp/GitHub:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=GitHub&digits=6&period=30'
    const parsed = parseOtpauthUri(uri)
    expect(parsed).not.toBeNull()
    expect(parsed?.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(parsed?.issuer).toBe('GitHub')
  })
})
