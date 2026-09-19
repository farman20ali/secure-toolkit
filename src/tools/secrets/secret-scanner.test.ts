import { describe, expect, it } from 'vitest'
import { redactSecret, scanContentForSecrets } from './secret-scanner-logic'

describe('scanContentForSecrets', () => {
  it('detects AWS Access Key ID', () => {
    const code = 'const key = "AKIAIOSFODNN7EXAMPLE";'
    const results = scanContentForSecrets(code)
    expect(results.some((r) => r.type === 'AWS Access Key ID')).toBe(true)
    expect(results[0].line).toBe(1)
  })

  it('detects OpenAI API key', () => {
    const code = 'export const OPENAI_API_KEY = "sk-proj-1234567890abcdef1234567890abcdef";'
    const results = scanContentForSecrets(code)
    expect(results.some((r) => r.type === 'OpenAI API Key')).toBe(true)
  })

  it('detects private key blocks', () => {
    const code = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----'
    const results = scanContentForSecrets(code)
    expect(results.some((r) => r.type === 'Private Key Block')).toBe(true)
  })

  it('redacts secrets safely', () => {
    expect(redactSecret('sk-proj-1234567890abcdef')).toBe('sk-p…cdef')
    expect(redactSecret('123456')).toBe('****')
  })
})
