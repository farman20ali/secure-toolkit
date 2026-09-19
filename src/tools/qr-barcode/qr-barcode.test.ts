import { describe, expect, it } from 'vitest'
import {
  analyzeQrSecurity,
  validateBarcode,
  buildWifiQrPayload,
  buildVCardQrPayload,
  buildCryptoQrPayload,
  parseWifiPayload,
  parseVCardPayload,
  parseTotpPayload,
  parseCryptoPayload,
} from './qr-barcode-logic'

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
    expect(report.issues.some((i) => i.title === 'Potential Open Redirect Parameter')).toBe(true)
  })

  it('detects dangerous script URI schemes', () => {
    const report = analyzeQrSecurity('javascript:alert(document.cookie)')
    expect(report.isUrl).toBe(false)
    expect(report.issues.some((i) => i.title.includes('Executable Payload'))).toBe(true)
  })

  it('parses Wi-Fi QR payloads correctly', () => {
    const payload = buildWifiQrPayload('MyNet', 'Pass123', 'WPA')
    expect(payload).toBe('WIFI:S:MyNet;T:WPA;P:Pass123;;')
    const parsed = parseWifiPayload(payload)
    expect(parsed).toEqual({ ssid: 'MyNet', pass: 'Pass123', type: 'WPA' })
  })

  it('parses vCard contact payloads correctly', () => {
    const vcard = buildVCardQrPayload({ fn: 'Alex Dev', tel: '+12345', email: 'alex@example.com' })
    const parsed = parseVCardPayload(vcard)
    expect(parsed?.fn).toBe('Alex Dev')
    expect(parsed?.tel).toBe('+12345')
    expect(parsed?.email).toBe('alex@example.com')
  })

  it('parses TOTP 2FA URIs correctly', () => {
    const uri = 'otpauth://totp/user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=SecureToolkit'
    const parsed = parseTotpPayload(uri)
    expect(parsed?.label).toBe('user@example.com')
    expect(parsed?.secret).toBe('JBSWY3DPEHPK3PXP')
    expect(parsed?.issuer).toBe('SecureToolkit')
  })

  it('parses Crypto address payloads correctly', () => {
    const payload = buildCryptoQrPayload('bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', '0.5')
    const parsed = parseCryptoPayload(payload)
    expect(parsed?.coin).toBe('bitcoin')
    expect(parsed?.address).toBe('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')
    expect(parsed?.amount).toBe('0.5')
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

  it('validates Code 39 characters correctly', () => {
    expect(validateBarcode('CODE39', 'CODE39-TEST-123').valid).toBe(true)
    expect(validateBarcode('CODE39', 'code39#invalid').valid).toBe(false)
  })

  it('validates ITF-14 14-digit format', () => {
    expect(validateBarcode('ITF14', '12345678901234').valid).toBe(true)
    expect(validateBarcode('ITF14', '123').valid).toBe(false)
  })
})
