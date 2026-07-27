import { describe, expect, it } from 'vitest'
import { parseClientDataJson, parseAuthenticatorData } from './PasskeyTool'

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

  it('parses authenticatorData buffer flags and sign counter correctly', () => {
    const buffer = new Uint8Array(37)
    buffer[32] = 0x05 // UP (0x01) + UV (0x04)
    buffer[36] = 42   // Sign count 42
    const parsed = parseAuthenticatorData(buffer.buffer)
    expect(parsed.flags.userPresent).toBe(true)
    expect(parsed.flags.userVerified).toBe(true)
    expect(parsed.signCount).toBe(42)
  })
})
