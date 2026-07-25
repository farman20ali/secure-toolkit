import { describe, expect, it } from 'vitest'
import { getRandomInt, shuffleInPlace } from '../lib/secureRandom'

describe('getRandomInt', () => {
  it('returns values in range [0, max)', () => {
    for (let i = 0; i < 200; i++) {
      const value = getRandomInt(10)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(10)
    }
  })

  it('throws for invalid max', () => {
    expect(() => getRandomInt(0)).toThrow()
    expect(() => getRandomInt(-1)).toThrow()
  })
})

describe('shuffleInPlace', () => {
  it('preserves multiset of elements', () => {
    const original = ['a', 'b', 'c', 'd', 'e']
    const copy = [...original]
    shuffleInPlace(copy)
    expect(copy.sort().join('')).toBe(original.sort().join(''))
  })
})
