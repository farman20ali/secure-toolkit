import { describe, expect, it } from 'vitest'
import { transformStep } from './encoding-lab-logic'

describe('transformStep', () => {
  it('encodes and decodes Base64 correctly', () => {
    const original = 'Hello Secure Toolkit!'
    const encoded = transformStep(original, 'base64', 'encode')
    expect(encoded).toBe('SGVsbG8gU2VjdXJlIFRvb2xraXQh')

    const decoded = transformStep(encoded, 'base64', 'decode')
    expect(decoded).toBe(original)
  })

  it('encodes and decodes Hex correctly', () => {
    const original = 'ABC'
    const hex = transformStep(original, 'hex', 'encode')
    expect(hex).toBe('41 42 43')

    const decoded = transformStep(hex, 'hex', 'decode')
    expect(decoded).toBe(original)
  })

  it('encodes and decodes Binary correctly', () => {
    const original = 'A'
    const bin = transformStep(original, 'binary', 'encode')
    expect(bin).toBe('01000001')

    const decoded = transformStep(bin, 'binary', 'decode')
    expect(decoded).toBe(original)
  })

  it('encodes Base64URL correctly', () => {
    const original = 'Subject?value>123'
    const b64url = transformStep(original, 'base64url', 'encode')
    expect(b64url).not.toContain('+')
    expect(b64url).not.toContain('/')
    expect(b64url).not.toContain('=')
  })
})
