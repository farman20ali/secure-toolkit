const ALPHABET_STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const ALPHABET_HEX = '0123456789ABCDEFGHIJKLMNOPQRSTUV'

export function encodeBase32(
  input: string | Uint8Array,
  variant: 'standard' | 'hex' = 'standard',
  pad = true
): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  if (bytes.length === 0) return ''

  const alphabet = variant === 'hex' ? ALPHABET_HEX : ALPHABET_STD
  let result = ''
  let bits = 0
  let value = 0

  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i]!
    bits += 8
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31]
      bits -= 5
      value = value & ((1 << bits) - 1)
    }
  }

  if (bits > 0) {
    result += alphabet[((value & ((1 << bits) - 1)) << (5 - bits)) & 31]
  }

  if (pad) {
    while (result.length % 8 !== 0) {
      result += '='
    }
  }

  return result
}

export function decodeBase32Bytes(
  input: string,
  variant: 'standard' | 'hex' = 'standard'
): Uint8Array {
  const cleanInput = input.trim().replace(/=+$/, '').toUpperCase()
  if (!cleanInput) return new Uint8Array(0)

  const alphabet = variant === 'hex' ? ALPHABET_HEX : ALPHABET_STD
  const charMap: Record<string, number> = {}
  for (let i = 0; i < alphabet.length; i++) {
    charMap[alphabet[i]!] = i
  }

  let bits = 0
  let value = 0
  const output: number[] = []

  for (let i = 0; i < cleanInput.length; i++) {
    const char = cleanInput[i]!
    if (char === ' ' || char === '\n' || char === '\r' || char === '-') continue
    const val = charMap[char]
    if (val === undefined) {
      throw new Error(`Invalid Base32 character '${char}' for ${variant} alphabet.`)
    }
    value = (value << 5) | val
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255)
      bits -= 8
      value = value & ((1 << bits) - 1)
    }
  }

  return new Uint8Array(output)
}

export function decodeBase32(
  input: string,
  variant: 'standard' | 'hex' = 'standard'
): string {
  const bytes = decodeBase32Bytes(input, variant)
  if (bytes.length === 0) return ''

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    // If raw binary bytes (non-UTF-8 secret key), format cleanly as Hex bytes
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      .toUpperCase()
  }
}

export function generateRandomBase32Secret(length = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[array[i]! % chars.length]
  }
  return result
}
