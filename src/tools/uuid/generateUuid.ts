/**
 * Secure UUID Generator (Web Crypto API)
 */

function formatUuid(bytes: Uint8Array): string {
  const hex: string[] = []
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i]!.toString(16).padStart(2, '0'))
  }
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

export function generateUuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40 // v4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80 // variant 1
  return formatUuid(bytes)
}

let lastV7Timestamp = 0
let v7Seq = 0

export function generateUuidV7(timestamp = Date.now()): string {
  let ts = timestamp
  if (ts <= lastV7Timestamp) {
    ts = lastV7Timestamp
    v7Seq++
    if (v7Seq > 0xfff) {
      v7Seq = 0
      ts++
    }
  } else {
    lastV7Timestamp = ts
    v7Seq = 0
  }

  const bytes = new Uint8Array(16)
  // 48-bit timestamp
  bytes[0] = (ts / 0x10000000000) & 0xff
  bytes[1] = (ts / 0x100000000) & 0xff
  bytes[2] = (ts / 0x1000000) & 0xff
  bytes[3] = (ts / 0x10000) & 0xff
  bytes[4] = (ts / 0x100) & 0xff
  bytes[5] = ts & 0xff

  // Generate random bytes for the rest
  const randBytes = new Uint8Array(10)
  crypto.getRandomValues(randBytes)
  for (let i = 0; i < 10; i++) {
    bytes[6 + i] = randBytes[i]!
  }

  // Version 7
  bytes[6] = 0x70 | ((v7Seq >> 8) & 0x0f)
  bytes[7] = v7Seq & 0xff

  // Variant 1 (10xx)
  bytes[8] = (bytes[8]! & 0x3f) | 0x80

  return formatUuid(bytes)
}

export type UuidOptions = {
  version: 'v4' | 'v7'
  quantity: number
  uppercase: boolean
  hyphens: boolean
  braces: boolean
}

export function generateUuids(options: UuidOptions): string[] {
  const result: string[] = []
  for (let i = 0; i < options.quantity; i++) {
    let uuid = options.version === 'v7' ? generateUuidV7() : generateUuidV4()
    if (!options.hyphens) {
      uuid = uuid.replace(/-/g, '')
    }
    if (options.uppercase) {
      uuid = uuid.toUpperCase()
    }
    if (options.braces) {
      uuid = `{${uuid}}`
    }
    result.push(uuid)
  }
  return result
}
