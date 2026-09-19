export interface MagicByteMatch {
  extension: string
  expectedMime: string
  actualMime: string
  magicBytesHex: string
  isMismatch: boolean
}

export function detectMagicBytes(buffer: Uint8Array, fileName: string): MagicByteMatch {
  const hex = Array.from(buffer.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  let actualMime = 'application/octet-stream'

  if (hex.startsWith('89504E47')) actualMime = 'image/png'
  else if (hex.startsWith('FFD8FF')) actualMime = 'image/jpeg'
  else if (hex.startsWith('47494638')) actualMime = 'image/gif'
  else if (hex.startsWith('25504446')) actualMime = 'application/pdf'
  else if (hex.startsWith('504B0304')) actualMime = 'application/zip / docx / xlsx'
  else if (hex.startsWith('4D5A')) actualMime = 'application/x-msdownload (Executable Binary)'
  else if (hex.startsWith('7F454C46')) actualMime = 'application/x-elf (Linux Executable)'

  let isMismatch = false
  if (ext === 'jpg' || ext === 'jpeg') {
    if (!actualMime.includes('image/jpeg')) isMismatch = true
  } else if (ext === 'png') {
    if (!actualMime.includes('image/png')) isMismatch = true
  } else if (ext === 'pdf') {
    if (!actualMime.includes('application/pdf')) isMismatch = true
  }

  return {
    extension: ext,
    expectedMime: `.${ext}`,
    actualMime,
    magicBytesHex: hex,
    isMismatch,
  }
}

export function calculateEntropy(buffer: Uint8Array): number {
  if (buffer.length === 0) return 0
  const frequencies = new Array(256).fill(0)
  for (let i = 0; i < buffer.length; i++) {
    frequencies[buffer[i]]++
  }

  let entropy = 0
  for (let i = 0; i < 256; i++) {
    if (frequencies[i] > 0) {
      const p = frequencies[i] / buffer.length
      entropy -= p * Math.log2(p)
    }
  }
  return Math.round(entropy * 100) / 100
}
