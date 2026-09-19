export type EncodingFormat =
  | 'text'
  | 'base64'
  | 'base64url'
  | 'base32'
  | 'hex'
  | 'binary'
  | 'url'
  | 'html'

// RFC 4648 Base32 alphabet (A–Z, 2–7, no padding variants)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function encodeBase32(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  // pad to multiple of 8
  while (output.length % 8 !== 0) output += '='
  return output
}

export function decodeBase32(input: string): string {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

export function transformStep(input: string, format: EncodingFormat, mode: 'encode' | 'decode'): string {
  if (!input) return ''

  try {
    if (format === 'base32') {
      return mode === 'encode' ? encodeBase32(input) : decodeBase32(input)
    }

    if (format === 'base64') {
      return mode === 'encode'
        ? btoa(encodeURIComponent(input).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))))
        : decodeURIComponent(Array.from(atob(input), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
    }

    if (format === 'base64url') {
      if (mode === 'encode') {
        const b64 = transformStep(input, 'base64', 'encode')
        return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      } else {
        let b64 = input.replace(/-/g, '+').replace(/_/g, '/')
        while (b64.length % 4) b64 += '='
        return transformStep(b64, 'base64', 'decode')
      }
    }

    if (format === 'hex') {
      if (mode === 'encode') {
        const enc = new TextEncoder()
        return Array.from(enc.encode(input))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join(' ')
      } else {
        const bytes = new Uint8Array(
          input.replaceAll(/\s/g, '').match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
        )
        return new TextDecoder().decode(bytes)
      }
    }

    if (format === 'binary') {
      if (mode === 'encode') {
        const enc = new TextEncoder()
        return Array.from(enc.encode(input))
          .map((b) => b.toString(2).padStart(8, '0'))
          .join(' ')
      } else {
        const binStrings = input.trim().split(/\s+/)
        const bytes = new Uint8Array(binStrings.map((b) => parseInt(b, 2)))
        return new TextDecoder().decode(bytes)
      }
    }

    if (format === 'url') {
      return mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input)
    }

    if (format === 'html') {
      if (mode === 'encode') {
        return input.replace(/[\u00A0-\u9999<>&"']/g, (i) => '&#' + i.charCodeAt(0) + ';')
      } else {
        const doc = new DOMParser().parseFromString(input, 'text/html')
        return doc.body.textContent || ''
      }
    }
  } catch {
    return '⚠️ Conversion Error'
  }

  return input
}
