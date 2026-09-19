import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { decodeToken, encodeBase64Url } from './jwt-logic'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeToken(
  header: Record<string, unknown>,
  payload: Record<string, unknown>,
  sig = 'fakesig',
): string {
  return `${encodeBase64Url(JSON.stringify(header))}.${encodeBase64Url(JSON.stringify(payload))}.${sig}`
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('decodeToken — happy path', () => {
  it('decodes header and payload from a valid HS256 token', () => {
    const token = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: '42', name: 'Alice' })
    const result = decodeToken(token)
    expect(result.header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(result.payload).toEqual({ sub: '42', name: 'Alice' })
    expect(result.signature).toBe('fakesig')
  })

  it('strips surrounding double-quotes before decoding', () => {
    const inner = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: 'test' })
    const result = decodeToken(`"${inner}"`)
    expect(result.payload.sub).toBe('test')
  })

  it('strips surrounding single-quotes before decoding', () => {
    const inner = makeToken({ alg: 'HS256', typ: 'JWT' }, { sub: 'test' })
    const result = decodeToken(`'${inner}'`)
    expect(result.payload.sub).toBe('test')
  })

  it('round-trips UTF-8 payload values correctly', () => {
    const token = makeToken({ alg: 'HS256' }, { name: '日本語テスト', emoji: '🔐' })
    const result = decodeToken(token)
    expect(result.payload.name).toBe('日本語テスト')
    expect(result.payload.emoji).toBe('🔐')
  })
})

describe('decodeToken — expiry / date fields', () => {
  beforeEach(() => {
    // Freeze time to 2025-01-01T00:00:00Z (Unix 1735689600)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks token as active when exp is in the future', () => {
    const token = makeToken({ alg: 'HS256' }, { exp: 1735689600 + 3600 }) // +1 h
    const result = decodeToken(token)
    expect(result.expired).toBe(false)
    expect(result.expDate).toBeInstanceOf(Date)
  })

  it('marks token as expired when exp is in the past', () => {
    const token = makeToken({ alg: 'HS256' }, { exp: 1735689600 - 1 }) // 1 s before
    const result = decodeToken(token)
    expect(result.expired).toBe(true)
  })

  it('sets expired to null when no exp claim is present', () => {
    const token = makeToken({ alg: 'HS256' }, { sub: 'no-exp' })
    const result = decodeToken(token)
    expect(result.expired).toBeNull()
    expect(result.expDate).toBeNull()
  })

  it('parses iat and nbf into Date objects', () => {
    const iat = 1735689600
    const nbf = 1735689600 + 60
    const token = makeToken({ alg: 'HS256' }, { iat, nbf })
    const result = decodeToken(token)
    expect(result.iatDate?.getTime()).toBe(iat * 1000)
    expect(result.nbfDate?.getTime()).toBe(nbf * 1000)
  })
})

describe('decodeToken — malformed inputs', () => {
  it('throws a descriptive error for tokens with fewer than 3 parts', () => {
    expect(() => decodeToken('only.two')).toThrow(/3 dot-separated parts/)
  })

  it('throws a descriptive error for tokens with more than 3 parts', () => {
    const token = 'a.b.c.d.e'
    expect(() => decodeToken(token)).toThrow(/too many dots/)
  })

  it('throws when the header segment is not valid base64url JSON', () => {
    expect(() => decodeToken('!!!.payload.sig')).toThrow(/Header segment/)
  })

  it('throws when the payload segment is not valid base64url JSON', () => {
    const validHeader = encodeBase64Url(JSON.stringify({ alg: 'HS256' }))
    expect(() => decodeToken(`${validHeader}.!!!.sig`)).toThrow(/Payload segment/)
  })

  it('throws for an empty string', () => {
    expect(() => decodeToken('')).toThrow()
  })

  it('throws for a whitespace-only string', () => {
    expect(() => decodeToken('   ')).toThrow()
  })

  it('throws when token exceeds 8 KiB', () => {
    const huge = 'a'.repeat(8193)
    expect(() => decodeToken(huge)).toThrow(/too large/)
  })
})
