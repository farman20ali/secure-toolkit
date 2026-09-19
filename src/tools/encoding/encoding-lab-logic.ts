export type EncodingFormat =
  | 'text'
  | 'base64'
  | 'base64url'
  | 'hex'
  | 'binary'
  | 'url'
  | 'html'

export function transformStep(input: string, format: EncodingFormat, mode: 'encode' | 'decode'): string {
  if (!input) return ''

  try {
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
