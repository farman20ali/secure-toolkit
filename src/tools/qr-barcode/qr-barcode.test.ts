import { describe, expect, it } from 'vitest'
import { analyzeQrSecurity, validateBarcode } from './qr-barcode-logic'

describe('analyzeQrSecurity', () => {
  it('detects secure HTTPS URLs', () => {
    const report = analyzeQrSecurity('https://secure-toolkit.local/test')
    expect(report.isUrl).toBe(true)
    expect(report.issues.some((i) => i.title === 'HTTPS Enabled')).toBe(true)
  })

  it('detects embedded basic-auth credentials', () => {
    const report = analyzeQrSecurity('https://admin:password123@example.com/login')
    expect(report.issues.some((i) => i.title === 'Embedded Authentication Credentials')).toBe(true)
  })

  it('detects punycode domain homograph risk', () => {
    const report = analyzeQrSecurity('https://xn--e1afmkfd.xn--p1ai')
    expect(report.issues.some((i) => i.title === 'Punycode / Homograph Attack Risk')).toBe(true)
  })

  it('detects open redirect query parameter', () => {
    const report = analyzeQrSecurity('https://example.com/login?redirect=https://evil.com')
    expect(report.issues.some((i) => i.title === 'Potential Redirect Parameter')).toBe(true)
  })

  it('detects dangerous script URI schemes', () => {
    const report = analyzeQrSecurity('javascript:alert(document.cookie)')
    expect(report.isUrl).toBe(false)
    expect(report.issues.some((i) => i.title === 'Suspicious Executable URI Scheme')).toBe(true)
  })
})

describe('validateBarcode', () => {
  it('validates EAN-13 checksum correctly', () => {
    expect(validateBarcode('EAN13', '4006381333931').valid).toBe(true)
    expect(validateBarcode('EAN13', '4006381333930').valid).toBe(false)
  })

  it('validates EAN-8 checksum correctly', () => {
    expect(validateBarcode('EAN8', '73513537').valid).toBe(true)
    expect(validateBarcode('EAN8', '73513530').valid).toBe(false)
  })

  it('validates UPC-A checksum correctly', () => {
    expect(validateBarcode('UPC', '012345678905').valid).toBe(true)
    expect(validateBarcode('UPC', '012345678900').valid).toBe(false)
  })
})
