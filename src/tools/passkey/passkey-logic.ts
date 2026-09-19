export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64UrlToBuffer(b64url: string): ArrayBuffer {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  while (b64.length % 4) b64 += '='
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

export type ParsedClientData = {
  type: string
  challenge: string
  origin: string
  crossOrigin?: boolean
}

export function parseClientDataJson(rawJsonOrB64Url: string): ParsedClientData {
  let jsonStr = rawJsonOrB64Url.trim()
  if (!jsonStr.startsWith('{')) {
    const buf = base64UrlToBuffer(jsonStr)
    jsonStr = new TextDecoder().decode(buf)
  }
  const obj = JSON.parse(jsonStr)
  if (!obj.type || !obj.challenge || !obj.origin) {
    throw new Error('Invalid WebAuthn clientDataJSON (missing required type, challenge, or origin).')
  }
  return obj
}

export type ParsedAuthData = {
  rpIdHashHex: string
  flags: {
    userPresent: boolean
    userVerified: boolean
    attestedDataIncluded: boolean
    extensionDataIncluded: boolean
    rawByte: number
  }
  signCount: number
  aaguidHex?: string
  credentialIdHex?: string
}

export function parseAuthenticatorData(buffer: ArrayBuffer): ParsedAuthData {
  const bytes = new Uint8Array(buffer)
  if (bytes.length < 37) throw new Error('Authenticator data is too short (< 37 bytes).')

  let rpIdHashHex = ''
  for (let i = 0; i < 32; i++) rpIdHashHex += bytes[i]!.toString(16).padStart(2, '0')

  const flagsByte = bytes[32]!
  const flags = {
    userPresent: !!(flagsByte & 0x01),
    userVerified: !!(flagsByte & 0x04),
    attestedDataIncluded: !!(flagsByte & 0x40),
    extensionDataIncluded: !!(flagsByte & 0x80),
    rawByte: flagsByte,
  }

  const signCount =
    ((bytes[33]! << 24) >>> 0) +
    ((bytes[34]! << 16) >>> 0) +
    ((bytes[35]! << 8) >>> 0) +
    (bytes[36]! >>> 0)

  let aaguidHex: string | undefined
  let credentialIdHex: string | undefined

  if (flags.attestedDataIncluded && bytes.length >= 55) {
    let aaguid = ''
    for (let i = 37; i < 53; i++) aaguid += bytes[i]!.toString(16).padStart(2, '0')
    aaguidHex = `${aaguid.slice(0, 8)}-${aaguid.slice(8, 12)}-${aaguid.slice(12, 16)}-${aaguid.slice(16, 20)}-${aaguid.slice(20)}`

    const credIdLen = (bytes[53]! << 8) | bytes[54]!
    if (bytes.length >= 55 + credIdLen) {
      let credId = ''
      for (let i = 55; i < 55 + credIdLen; i++) credId += bytes[i]!.toString(16).padStart(2, '0')
      credentialIdHex = credId
    }
  }

  return { rpIdHashHex, flags, signCount, aaguidHex, credentialIdHex }
}

export type SavedPasskey = {
  id: string
  rawIdB64: string
  username: string
  displayName: string
  rpId: string
  attachment: string
  createdAt: string
  clientDataJson: string
  attestationObjectB64: string
}
