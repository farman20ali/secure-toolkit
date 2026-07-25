import { pickChar, shuffleInPlace } from '../../lib/secureRandom'

export const SYMBOL_POOL = '!@#$%^&*()-_=+[]{}|;:,.<>?'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I'])

export type PasswordOptions = {
  length: number
  uppercase: boolean
  lowercase: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
  useCustomSymbols?: boolean
  customSymbols?: string
}

export type PasswordValidationError =
  | 'no_charset'
  | 'length_too_short'
  | 'empty_pool'

export type GeneratePasswordResult =
  | { ok: true; password: string; poolSize: number }
  | { ok: false; error: PasswordValidationError }

function filterAmbiguous(pool: string): string {
  return [...pool].filter((char) => !AMBIGUOUS.has(char)).join('')
}

function buildPool(source: string, excludeAmbiguous: boolean): string {
  return excludeAmbiguous ? filterAmbiguous(source) : source
}

export function validatePasswordOptions(
  options: PasswordOptions,
): PasswordValidationError | null {
  const requiredSets = [
    options.uppercase,
    options.lowercase,
    options.digits,
    options.symbols,
    options.useCustomSymbols && !!options.customSymbols,
  ].filter(Boolean).length

  if (requiredSets === 0) {
    return 'no_charset'
  }

  if (options.length < requiredSets) {
    return 'length_too_short'
  }

  const pools = getCharsetPools(options)
  if (pools.some((pool) => pool.length === 0)) {
    return 'empty_pool'
  }

  return null
}

export function getCharsetPools(options: PasswordOptions): string[] {
  const pools: string[] = []
  if (options.uppercase) {
    pools.push(buildPool(UPPER, options.excludeAmbiguous))
  }
  if (options.lowercase) {
    pools.push(buildPool(LOWER, options.excludeAmbiguous))
  }
  if (options.digits) {
    pools.push(buildPool(DIGITS, options.excludeAmbiguous))
  }
  if (options.symbols) {
    pools.push(buildPool(SYMBOL_POOL, options.excludeAmbiguous))
  }
  if (options.useCustomSymbols && options.customSymbols) {
    pools.push(buildPool(options.customSymbols, options.excludeAmbiguous))
  }
  return pools
}

export function getCombinedPool(options: PasswordOptions): string {
  return getCharsetPools(options).join('')
}

export function generatePassword(
  options: PasswordOptions,
): GeneratePasswordResult {
  const validationError = validatePasswordOptions(options)
  if (validationError) {
    return { ok: false, error: validationError }
  }

  const charsetPools = getCharsetPools(options)
  const combinedPool = charsetPools.join('')
  const chars: string[] = []

  for (const pool of charsetPools) {
    chars.push(pickChar(pool))
  }

  while (chars.length < options.length) {
    chars.push(pickChar(combinedPool))
  }

  shuffleInPlace(chars)

  return {
    ok: true,
    password: chars.join(''),
    poolSize: combinedPool.length,
  }
}
