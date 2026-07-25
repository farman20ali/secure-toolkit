/**
 * Cryptographically secure random helpers (Web Crypto API only).
 */

export function getRandomInt(max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new Error('max must be a positive integer')
  }

  const array = new Uint32Array(1)
  const limit = Math.floor(0x1_0000_0000 / max) * max

  let value: number
  do {
    crypto.getRandomValues(array)
    value = array[0]!
  } while (value >= limit)

  return value % max
}

export function pickChar(pool: string): string {
  if (pool.length === 0) {
    throw new Error('Character pool must not be empty')
  }
  return pool[getRandomInt(pool.length)]!
}

export function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1)
    ;[items[i], items[j]] = [items[j]!, items[i]!]
  }
}
