import { describe, expect, it } from 'vitest'
import { analyzeUrlStructure } from './url-analyzer-logic'

describe('analyzeUrlStructure', () => {
  it('analyzes HTTPS URL with open redirect parameter', () => {
    const res = analyzeUrlStructure('https://example.com/login?redirect=https://evil.com')
    expect(res.isValid).toBe(true)
    expect(res.protocol).toBe('https:')
    expect(res.findings.some((f) => f.title.includes('Open Redirect Parameter'))).toBe(true)
  })

  it('detects embedded basic-auth credentials', () => {
    const res = analyzeUrlStructure('https://admin:secret123@example.com/')
    expect(res.findings.some((f) => f.title === 'Embedded Authentication Credentials')).toBe(true)
  })

  it('detects punycode domain spoofing', () => {
    const res = analyzeUrlStructure('https://xn--e1afmkfd.org/')
    expect(res.findings.some((f) => f.title === 'Punycode Homograph Domain')).toBe(true)
  })
})
