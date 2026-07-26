export type DiffChangeType = 'added' | 'removed' | 'unchanged' | 'empty'

export type DiffLine = {
  type: DiffChangeType
  text: string
  num?: number
}

export type AlignedDiffLine = {
  left: DiffLine
  right: DiffLine
}

export type AlignedThreeWayLine = {
  col1: DiffLine
  col2: DiffLine
  col3: DiffLine
}

// Computes the LCS of two string arrays
export function diffLines(a: string[], b: string[]): DiffLine[] {
  const M = a.length
  const N = b.length

  const dp: number[][] = Array.from({ length: M + 1 }, () => new Array(N + 1).fill(0))

  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1]![j - 1]! + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!)
      }
    }
  }

  const result: DiffLine[] = []
  let i = M
  let j = N

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      result.unshift({ type: 'unchanged', text: a[i - 1]! })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      result.unshift({ type: 'added', text: b[j - 1]! })
      j--
    } else {
      result.unshift({ type: 'removed', text: a[i - 1]! })
      i--
    }
  }
  return result
}

// Aligns two lists of lines side-by-side using the LCS diff result
export function alignDiff(a: string[], b: string[]): AlignedDiffLine[] {
  const diff = diffLines(a, b)
  const aligned: AlignedDiffLine[] = []

  let i = 0
  let leftNum = 1
  let rightNum = 1

  while (i < diff.length) {
    const current = diff[i]!
    if (current.type === 'unchanged') {
      aligned.push({
        left: { text: current.text, type: 'unchanged', num: leftNum++ },
        right: { text: current.text, type: 'unchanged', num: rightNum++ },
      })
      i++
    } else if (current.type === 'removed') {
      // Lookahead to see if next is added, to pair as modification
      if (i + 1 < diff.length && diff[i + 1]!.type === 'added') {
        aligned.push({
          left: { text: current.text, type: 'removed', num: leftNum++ },
          right: { text: diff[i + 1]!.text, type: 'added', num: rightNum++ },
        })
        i += 2
      } else {
        aligned.push({
          left: { text: current.text, type: 'removed', num: leftNum++ },
          right: { text: '', type: 'empty' },
        })
        i++
      }
    } else {
      // current.type === 'added'
      aligned.push({
        left: { text: '', type: 'empty' },
        right: { text: current.text, type: 'added', num: rightNum++ },
      })
      i++
    }
  }
  return aligned
}

// Aligns three lists of lines using Col 1 as base
export function alignThreeWay(a: string[], b: string[], c: string[]): AlignedThreeWayLine[] {
  const ab = alignDiff(a, b)
  const ac = alignDiff(a, c)

  const result: AlignedThreeWayLine[] = []
  let abIdx = 0
  let acIdx = 0

  while (abIdx < ab.length || acIdx < ac.length) {
    const lineAB = ab[abIdx]
    const lineAC = ac[acIdx]

    if (lineAB && lineAC && lineAB.left.type === 'unchanged' && lineAC.left.type === 'unchanged') {
      result.push({
        col1: { text: lineAB.left.text, type: 'unchanged', num: lineAB.left.num },
        col2: { text: lineAB.right.text, type: lineAB.right.type, num: lineAB.right.num },
        col3: { text: lineAC.right.text, type: lineAC.right.type, num: lineAC.right.num },
      })
      abIdx++
      acIdx++
    } else if (lineAB && (!lineAC || lineAB.left.type === 'empty')) {
      result.push({
        col1: { text: '', type: 'empty' },
        col2: { text: lineAB.right.text, type: lineAB.right.type, num: lineAB.right.num },
        col3: { text: '', type: 'empty' },
      })
      abIdx++
    } else if (lineAC && (!lineAB || lineAC.left.type === 'empty')) {
      result.push({
        col1: { text: '', type: 'empty' },
        col2: { text: '', type: 'empty' },
        col3: { text: lineAC.right.text, type: lineAC.right.type, num: lineAC.right.num },
      })
      acIdx++
    } else {
      if (lineAB && lineAB.left.type === 'removed') {
        result.push({
          col1: { text: lineAB.left.text, type: 'removed', num: lineAB.left.num },
          col2: { text: lineAB.right.text, type: lineAB.right.type, num: lineAB.right.num },
          col3: { text: '', type: 'empty' },
        })
        abIdx++
      } else if (lineAC && lineAC.left.type === 'removed') {
        result.push({
          col1: { text: lineAC.left.text, type: 'removed', num: lineAC.left.num },
          col2: { text: '', type: 'empty' },
          col3: { text: lineAC.right.text, type: lineAC.right.type, num: lineAC.right.num },
        })
        acIdx++
      } else {
        abIdx++
        acIdx++
      }
    }
  }
  return result
}
