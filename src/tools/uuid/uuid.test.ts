import { describe, expect, it } from 'vitest'
import { generateUuidV4, generateUuidV7, generateUuids } from './generateUuid'

describe('UUID V4 Generator', () => {
  it('generates a valid UUID v4 string', () => {
    const uuid = generateUuidV4()
    // Standard format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })
})

describe('UUID V7 Generator', () => {
  it('generates a valid UUID v7 string', () => {
    const uuid = generateUuidV7()
    // Format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('generates monotonically increasing UUIDs', () => {
    const u1 = generateUuidV7()
    const u2 = generateUuidV7()
    expect(u1 < u2).toBe(true)
  })
})

describe('generateUuids wrapper', () => {
  it('generates specified quantity and version', () => {
    const list = generateUuids({
      version: 'v4',
      quantity: 5,
      uppercase: false,
      hyphens: true,
      braces: false,
    })
    expect(list).toHaveLength(5)
    expect(list[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it('respects uppercase, hyphens and braces options', () => {
    const list = generateUuids({
      version: 'v7',
      quantity: 1,
      uppercase: true,
      hyphens: false,
      braces: true,
    })
    expect(list[0]).toMatch(/^\{[0-9A-F]{32}\}$/)
  })
})
