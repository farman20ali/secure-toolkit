export type ParsedCert = {
  subject: Record<string, string>
  issuer: Record<string, string>
  serialNumber: string
  validNotBefore: Date | null
  validNotAfter: Date | null
  sigAlgOid: string
  sigAlgName: string
  fingerprintSha256: string
  isExpired: boolean
  isNotYetValid: boolean
  daysRemaining: number | null
}

const OID_NAMES: Record<string, string> = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '2.5.4.12': 'Title',
  '1.2.840.113549.1.1.1': 'RSA Encryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.10045.2.1': 'EC Public Key',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
}

function parseOid(bytes: Uint8Array, start: number, length: number): string {
  if (length === 0) return ''
  const first = bytes[start]!
  const components: number[] = [Math.floor(first / 40), first % 40]
  let value = 0
  for (let i = 1; i < length; i++) {
    const b = bytes[start + i]!
    value = (value << 7) | (b & 0x7f)
    if ((b & 0x80) === 0) {
      components.push(value)
      value = 0
    }
  }
  return components.join('.')
}

function parseDerTime(str: string): Date | null {
  try {
    let year = 0
    let rest = ''
    if (str.length === 13 && str.endsWith('Z')) {
      const yy = parseInt(str.substring(0, 2), 10)
      year = yy >= 50 ? 1900 + yy : 2000 + yy
      rest = str.substring(2)
    } else if (str.length === 15 && str.endsWith('Z')) {
      year = parseInt(str.substring(0, 4), 10)
      rest = str.substring(4)
    } else {
      return null
    }
    const month = parseInt(rest.substring(0, 2), 10) - 1
    const day = parseInt(rest.substring(2, 4), 10)
    const hour = parseInt(rest.substring(4, 6), 10)
    const min = parseInt(rest.substring(6, 8), 10)
    const sec = parseInt(rest.substring(8, 10), 10)
    return new Date(Date.UTC(year, month, day, hour, min, sec))
  } catch {
    return null
  }
}

async function computeSha256Fingerprint(u8: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', u8.buffer as ArrayBuffer)
  const view = new Uint8Array(buf)
  const hexParts: string[] = []
  for (let i = 0; i < view.length; i++) {
    hexParts.push(view[i]!.toString(16).padStart(2, '0').toUpperCase())
  }
  return hexParts.join(':')
}

export async function parseX509Pem(pem: string): Promise<ParsedCert> {
  const b64 = pem
    .replace(/-----BEGIN [A-Z0-9 space]+-----/g, '')
    .replace(/-----END [A-Z0-9 space]+-----/g, '')
    .replace(/\s+/g, '')
  
  if (!b64) throw new Error('No valid PEM base64 data found.')

  const bin = atob(b64)
  const u8 = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i)

  const fingerprint = await computeSha256Fingerprint(u8)

  let pos = 0

  function readTlv() {
    if (pos >= u8.length) throw new Error('Unexpected end of DER data.')
    const tag = u8[pos++]!
    let len = u8[pos++]!
    if (len & 0x80) {
      const numBytes = len & 0x7f
      len = 0
      for (let i = 0; i < numBytes; i++) {
        len = (len << 8) | u8[pos++]!
      }
    }
    const valStart = pos
    pos += len
    return { tag, len, valStart, valBytes: u8.subarray(valStart, pos) }
  }

  const root = readTlv()
  if ((root.tag & 0x1f) !== 0x10) throw new Error('Invalid X.509 DER structure (expected SEQUENCE).')

  pos = root.valStart
  const tbs = readTlv()

  let tbsPos = tbs.valStart

  function readNextTbs() {
    pos = tbsPos
    const item = readTlv()
    tbsPos = pos
    return item
  }

  let item = readNextTbs()
  if ((item.tag & 0xc0) === 0xa0) {
    item = readNextTbs()
  }

  const serialBytes = item.valBytes
  let serialHex = ''
  for (let i = 0; i < serialBytes.length; i++) {
    serialHex += serialBytes[i]!.toString(16).padStart(2, '0').toUpperCase()
  }

  const sigAlgItem = readNextTbs()
  let sigAlgOid = ''
  if (sigAlgItem.valBytes.length > 2 && sigAlgItem.valBytes[0] === 0x06) {
    const oidLen = sigAlgItem.valBytes[1]!
    sigAlgOid = parseOid(sigAlgItem.valBytes, 2, oidLen)
  }

  const issuerItem = readNextTbs()
  const issuer = parseDistinguishedName(issuerItem.valBytes)

  const validityItem = readNextTbs()
  let validNotBefore: Date | null = null
  let validNotAfter: Date | null = null

  if (validityItem.valBytes.length > 0) {
    let vPos = 0
    function readValidityTlv() {
      const tag = validityItem.valBytes[vPos++]!
      let len = validityItem.valBytes[vPos++]!
      if (len & 0x80) {
        const numBytes = len & 0x7f
        len = 0
        for (let i = 0; i < numBytes; i++) len = (len << 8) | validityItem.valBytes[vPos++]!
      }
      const valStr = new TextDecoder('ascii').decode(validityItem.valBytes.subarray(vPos, vPos + len))
      vPos += len
      return { tag, valStr }
    }
    const t1 = readValidityTlv()
    const t2 = readValidityTlv()
    validNotBefore = parseDerTime(t1.valStr)
    validNotAfter = parseDerTime(t2.valStr)
  }

  const subjectItem = readNextTbs()
  const subject = parseDistinguishedName(subjectItem.valBytes)

  const now = new Date()
  const isExpired = validNotAfter ? now > validNotAfter : false
  const isNotYetValid = validNotBefore ? now < validNotBefore : false
  const daysRemaining = validNotAfter
    ? Math.max(0, Math.floor((validNotAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null

  return {
    subject,
    issuer,
    serialNumber: serialHex || '00',
    validNotBefore,
    validNotAfter,
    sigAlgOid,
    sigAlgName: OID_NAMES[sigAlgOid] || sigAlgOid || 'SHA-256 with RSA',
    fingerprintSha256: fingerprint,
    isExpired,
    isNotYetValid,
    daysRemaining,
  }
}

export function parseDistinguishedName(bytes: Uint8Array): Record<string, string> {
  const res: Record<string, string> = {}
  let p = 0
  while (p < bytes.length) {
    p++
    let rdnLen = bytes[p++]!
    if (rdnLen & 0x80) {
      const nb = rdnLen & 0x7f
      rdnLen = 0
      for (let i = 0; i < nb; i++) rdnLen = (rdnLen << 8) | bytes[p++]!
    }
    const rdnEnd = p + rdnLen
    while (p < rdnEnd && p < bytes.length) {
      p++
      let atvLen = bytes[p++]!
      if (atvLen & 0x80) {
        const nb = atvLen & 0x7f
        atvLen = 0
        for (let i = 0; i < nb; i++) atvLen = (atvLen << 8) | bytes[p++]!
      }
      const atvEnd = p + atvLen
      if (p < atvEnd && bytes[p] === 0x06) {
        p++
        const oidL = bytes[p++]!
        const oidStr = parseOid(bytes, p, oidL)
        p += oidL
        if (p < atvEnd) {
          p++
          let strL = bytes[p++]!
          if (strL & 0x80) {
            const nb = strL & 0x7f
            strL = 0
            for (let i = 0; i < nb; i++) strL = (strL << 8) | bytes[p++]!
          }
          const valStr = new TextDecoder('utf-8').decode(bytes.subarray(p, p + strL))
          p += strL
          const key = OID_NAMES[oidStr] || oidStr
          res[key] = valStr
        }
      }
      p = atvEnd
    }
    p = rdnEnd
  }
  return res
}

export async function generateDevRsaKeyPairPem(): Promise<{ publicKeyPem: string; privateKeyPem: string }> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )

  const pubExport = await crypto.subtle.exportKey('spki', keyPair.publicKey)
  const privExport = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)

  const toB64Pem = (buf: ArrayBuffer, header: string) => {
    let bin = ''
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!)
    const b64 = btoa(bin)
    const lines = b64.match(/.{1,64}/g) || []
    return `-----BEGIN ${header}-----\n${lines.join('\n')}\n-----END ${header}-----`
  }

  return {
    publicKeyPem: toB64Pem(pubExport, 'PUBLIC KEY'),
    privateKeyPem: toB64Pem(privExport, 'PRIVATE KEY'),
  }
}
