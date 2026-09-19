import { describe, expect, it } from 'vitest'
import { calculateEntropy, detectMagicBytes } from './file-security-logic'

describe('detectMagicBytes', () => {
  it('detects PNG magic bytes correctly', () => {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const res = detectMagicBytes(buffer, 'test.png')
    expect(res.actualMime).toBe('image/png')
    expect(res.isMismatch).toBe(false)
  })

  it('detects extension mismatch when PNG buffer is named test.jpg', () => {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const res = detectMagicBytes(buffer, 'fake_image.jpg')
    expect(res.isMismatch).toBe(true)
  })
})

describe('calculateEntropy', () => {
  it('calculates 0 entropy for uniform byte array', () => {
    const buffer = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0])
    expect(calculateEntropy(buffer)).toBe(0)
  })

  it('calculates maximum entropy (~8) for uniform distribution of all byte values', () => {
    const buffer = new Uint8Array(256)
    for (let i = 0; i < 256; i++) buffer[i] = i
    expect(calculateEntropy(buffer)).toBe(8)
  })
})
