import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'

// ─── Inline pure-JS helpers (mirrors JwtDecoderTool.tsx) ─────────────────────
// We re-implement the tiny helpers here so tests do not import React components.

function encodeBase64Url(data: string): string {
  const bytes = new TextEncoder().encode(data)
  let binString = ''
  for (let i = 0; i < bytes.length; i++) binString += String.fromCharCode(bytes[i]!)
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

type DecodedToken = {
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  expired: boolean | null
  expDate: Date | null
  iatDate: Date | null
  nbfDate: Date | null
}

function decodeToken(token: string): DecodedToken {
  const raw = token.trim()
  if (raw.length > 8192) throw new Error('Token is too large to decode safely (max 8 KiB).')
  const cleaned = raw.replace(/^"|"$/g, '').replace(/^'|'$/g, '')
  const parts = cleaned.split('.')
  if (parts.length !== 3) {
    throw new Error(
      parts.length < 3
        ? `JWT must have 3 dot-separated parts — found ${parts.length}. Make sure you copied the full token.`
        : 'Token has too many dots — verify it is a standard JWT (not a JWE nested token).',
    )
  }
  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = JSON.parse(decodeBase64Url(parts[0]!))
  } catch {
    throw new Error('Header segment is not valid Base64URL-encoded JSON.')
  }
  try {
    payload = JSON.parse(decodeBase64Url(parts[1]!))
  } catch {
    throw new Error('Payload segment is not valid Base64URL-encoded JSON.')
  }
  const signature = parts[2]!
  let expired: boolean | null = null
  let expDate: Date | null = null
  let iatDate: Date | null = null
  let nbfDate: Date | null = null
  if (typeof payload.exp === 'number') {
    expDate = new Date(payload.exp * 1000)
    expired = Date.now() > expDate.getTime()
  }
  if (typeof payload.iat === 'number') iatDate = new Date(payload.iat * 1000)
  if (typeof payload.nbf === 'number') nbfDate = new Date(payload.nbf * 1000)
  return { header, payload, signature, expired, expDate, iatDate, nbfDate }
}

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
