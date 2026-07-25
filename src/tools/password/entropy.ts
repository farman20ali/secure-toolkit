export type StrengthLabel = 'Weak' | 'Good' | 'Strong'

export function estimateEntropyBits(length: number, poolSize: number): number {
  if (length <= 0 || poolSize <= 1) {
    return 0
  }
  return length * Math.log2(poolSize)
}

export function strengthLabelFromBits(bits: number): StrengthLabel {
  if (bits < 50) {
    return 'Weak'
  }
  if (bits < 80) {
    return 'Good'
  }
  return 'Strong'
}

export function formatEntropyBits(bits: number): string {
  return `${Math.round(bits)} bits`
}
