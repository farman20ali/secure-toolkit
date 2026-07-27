import { describe, expect, it } from 'vitest'
import { parseClientDataJson } from './PasskeyTool'

describe('Passkey & WebAuthn Tool', () => {
  it('parses valid clientDataJSON string', () => {
    const json = JSON.stringify({
      type: 'webauthn.create',
      challenge: 'dGhpcyBpcyBhIHRlc3Q',
      origin: 'http://localhost:5173',
    })
    const parsed = parseClientDataJson(json)
    expect(parsed.type).toBe('webauthn.create')
    expect(parsed.challenge).toBe('dGhpcyBpcyBhIHRlc3Q')
    expect(parsed.origin).toBe('http://localhost:5173')
  })

  it('throws error for invalid clientDataJSON missing required fields', () => {
    const invalidJson = JSON.stringify({ foo: 'bar' })
    expect(() => parseClientDataJson(invalidJson)).toThrow()
  })
})
