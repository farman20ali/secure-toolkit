export function encodeBase64Url(data: string | ArrayBuffer): string {
  let binString: string
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data)
    binString = ''
    for (let i = 0; i < bytes.length; i++) binString += String.fromCharCode(bytes[i]!)
  } else {
    const view = new Uint8Array(data)
    binString = ''
    for (let i = 0; i < view.length; i++) binString += String.fromCharCode(view[i]!)
  }
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeBase64Url(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}

export function base64UrlToUint8Array(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) base64 += '='
  const binString = atob(base64)
  const bytes = new Uint8Array(binString.length)
  for (let i = 0; i < binString.length; i++) bytes[i] = binString.charCodeAt(i)
  return bytes
}

export function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 space]+-----/g, '')
    .replace(/-----END [A-Z0-9 space]+-----/g, '')
    .replace(/\s+/g, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export type DecodedToken = {
  raw: string
  header: Record<string, unknown>
  payload: Record<string, unknown>
  signature: string
  signingInput: string
  expired: boolean | null
  expDate: Date | null
  iatDate: Date | null
  nbfDate: Date | null
  alg: string
}

export function decodeToken(token: string): DecodedToken {
  const raw = token.trim()
  if (raw.length > 8192) throw new Error('Token is too large to decode safely (max 8 KiB).')
  const cleaned = raw.replace(/^"|"$/g, '').replace(/^'|'$/g, '')
  const parts = cleaned.split('.')
  if (parts.length !== 3) {
    throw new Error(
      parts.length < 3
        ? `JWT must have 3 dot-separated parts — found ${parts.length}.`
        : 'Token has too many dots — verify it is a standard JWT.',
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
  const signingInput = `${parts[0]}.${parts[1]}`
  const alg = typeof header.alg === 'string' ? header.alg : 'HS256'

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

  return { raw, header, payload, signature, signingInput, expired, expDate, iatDate, nbfDate, alg }
}

export async function verifyJwtSignature(
  decoded: DecodedToken,
  secretOrPublicKeyPem: string,
): Promise<boolean> {
  const inputBytes = new TextEncoder().encode(decoded.signingInput)
  const sigBytes = base64UrlToUint8Array(decoded.signature)
  const alg = decoded.alg.toUpperCase()

  if (alg.startsWith('HS')) {
    const hash = alg === 'HS384' ? 'SHA-384' : alg === 'HS512' ? 'SHA-512' : 'SHA-256'
    const keyData = new TextEncoder().encode(secretOrPublicKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash },
      false,
      ['verify'],
    )
    return crypto.subtle.verify('HMAC', cryptoKey, sigBytes.buffer as ArrayBuffer, inputBytes.buffer as ArrayBuffer)
  }

  if (alg.startsWith('RS')) {
    const hash = alg === 'RS384' ? 'SHA-384' : alg === 'RS512' ? 'SHA-512' : 'SHA-256'
    const spkiBuffer = pemToArrayBuffer(secretOrPublicKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      spkiBuffer,
      { name: 'RSASSA-PKCS1-v1_5', hash },
      false,
      ['verify'],
    )
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', cryptoKey, sigBytes.buffer as ArrayBuffer, inputBytes.buffer as ArrayBuffer)
  }

  if (alg.startsWith('ES')) {
    const namedCurve = alg === 'ES384' ? 'P-384' : 'P-256'
    const hash = alg === 'ES384' ? 'SHA-384' : 'SHA-256'
    const spkiBuffer = pemToArrayBuffer(secretOrPublicKeyPem)
    const cryptoKey = await crypto.subtle.importKey(
      'spki',
      spkiBuffer,
      { name: 'ECDSA', namedCurve },
      false,
      ['verify'],
    )
    return crypto.subtle.verify({ name: 'ECDSA', hash }, cryptoKey, sigBytes.buffer as ArrayBuffer, inputBytes.buffer as ArrayBuffer)
  }

  throw new Error(`Unsupported algorithm for verification: ${alg}`)
}

export type Algorithm = 'HS256' | 'HS384' | 'HS512'

const ALGO_HASH: Record<Algorithm, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512',
}

export async function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  alg: Algorithm,
): Promise<string> {
  const header = { alg, typ: 'JWT' }
  const headerB64 = encodeBase64Url(JSON.stringify(header))
  const payloadB64 = encodeBase64Url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const keyData = new TextEncoder().encode(secret)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: ALGO_HASH[alg] },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(signingInput))
  return `${signingInput}.${encodeBase64Url(signature)}`
}
