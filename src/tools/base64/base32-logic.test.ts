import { describe, expect, it } from 'vitest'
import { encodeBase32, decodeBase32, generateRandomBase32Secret } from './base32-logic'

describe('base32-logic', () => {
  it('encodes and decodes text round-trip correctly', () => {
    const samples = ['f', 'fo', 'foo', 'foob', 'fooba', 'foobar', 'Hello World', 'Hello, World! 🔐']
    for (const sample of samples) {
      const encoded = encodeBase32(sample)
      const decoded = decodeBase32(encoded)
      expect(decoded).toBe(sample)
    }
  })

  it('safely decodes binary TOTP secret keys to hex bytes without throwing invalid TextDecoder errors', () => {
    const rawSecret = 'JBSWY3DPEHPK3PXP'
    const result = decodeBase32(rawSecret)
    expect(result).toBe('48 65 6C 6C 6F 21 DE AD BE EF')
  })

  it('encodes hex variant round-trip correctly', () => {
    const text = 'SecureToolkit'
    const encoded = encodeBase32(text, 'hex')
    const decoded = decodeBase32(encoded, 'hex')
    expect(decoded).toBe(text)
  })

  it('handles lowercase and unpadded inputs cleanly', () => {
    expect(decodeBase32('mzxw6ytboi')).toBe('foobar')
  })

  it('generates a valid 16-char random Base32 secret', () => {
    const secret = generateRandomBase32Secret(16)
    expect(secret).toHaveLength(16)
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true)
  })
})
