import { describe, expect, it } from 'vitest'
import {
  generatePassword,
  validatePasswordOptions,
  type PasswordOptions,
} from './generatePassword'
import {
  estimateEntropyBits,
  strengthLabelFromBits,
} from './entropy'

const baseOptions: PasswordOptions = {
  length: 20,
  uppercase: true,
  lowercase: true,
  digits: true,
  symbols: true,
  excludeAmbiguous: false,
}

describe('validatePasswordOptions', () => {
  it('rejects when no charset is enabled', () => {
    expect(
      validatePasswordOptions({
        ...baseOptions,
        uppercase: false,
        lowercase: false,
        digits: false,
        symbols: false,
      }),
    ).toBe('no_charset')
  })

  it('rejects when length is less than required sets', () => {
    expect(
      validatePasswordOptions({
        ...baseOptions,
        length: 1,
        symbols: false,
        digits: false,
      }),
    ).toBe('length_too_short')
  })

  it('allows digits with exclude ambiguous', () => {
    expect(
      validatePasswordOptions({
        length: 8,
        uppercase: false,
        lowercase: false,
        digits: true,
        symbols: false,
        excludeAmbiguous: true,
      }),
    ).toBeNull()
  })
})

describe('generatePassword', () => {
  it('returns password of requested length', () => {
    const result = generatePassword(baseOptions)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.password).toHaveLength(20)
    }
  })

  it('includes at least one char from each enabled set', () => {
    const result = generatePassword(baseOptions)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.password).toMatch(/[A-Z]/)
    expect(result.password).toMatch(/[a-z]/)
    expect(result.password).toMatch(/[0-9]/)
    expect(result.password).toMatch(/[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/)
  })

  it('respects exclude ambiguous for digits and letters', () => {
    const result = generatePassword({
      ...baseOptions,
      symbols: false,
      excludeAmbiguous: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.password).not.toMatch(/[0O1lI]/)
  })
})

describe('entropy', () => {
  it('computes bits from length and pool size', () => {
    const bits = estimateEntropyBits(20, 74)
    expect(bits).toBeCloseTo(20 * Math.log2(74), 5)
  })

  it('labels strength bands', () => {
    expect(strengthLabelFromBits(40)).toBe('Weak')
    expect(strengthLabelFromBits(60)).toBe('Good')
    expect(strengthLabelFromBits(90)).toBe('Strong')
  })
})
