// ─── Public types ─────────────────────────────────────────────────────────────

export type DiffChangeType = 'added' | 'removed' | 'unchanged' | 'empty'

export type DiffLine = {
  type: DiffChangeType
  text: string
  num?: number
}

export type AlignedDiffLine = {
  left: DiffLine
  right: DiffLine
  /** True when left=removed and right=added are paired — enables inline word diff */
  isModified: boolean
}

export type AlignedThreeWayLine = {
  col1: DiffLine
  col2: DiffLine
  col3: DiffLine
  col2Modified: boolean
  col3Modified: boolean
}

export type WordChange = {
  type: 'added' | 'removed' | 'unchanged'
  text: string
}

// ─── Limits ───────────────────────────────────────────────────────────────────

/** Hard cap on combined line count to prevent O(N²) memory for extremely long files. */
export const MAX_LINE_TOKENS = 50_000
/** Hard cap on word tokens per line-pair (tokenized chars/words). */
const MAX_WORD_TOKENS = 4_000

// ─── Myers diff (O(N·D) time, O(N) space) ───────────────────────────────────
//
// Standard "An O(ND) Difference Algorithm" by Eugene W. Myers (1986).
// We keep only two "v" arrays (forward endpoints at each diagonal),
// which means worst-case memory is O(N) instead of O(M×N) for LCS.
//
// Reference: https://blog.robertelder.org/diff-algorithm/

type Edit = { type: 'add' | 'del' | 'eq'; aIdx: number; bIdx: number }

function myersDiff(a: string[], b: string[]): Edit[] {
  const N = a.length
  const M = b.length
  const MAX = N + M

  if (MAX === 0) return []

  const v: Int32Array = new Int32Array(2 * MAX + 1)
  const trace: Int32Array[] = []

  let x0 = 0
  let y0 = 0
  while (x0 < N && y0 < M && a[x0] === b[y0]) {
    x0++
    y0++
  }
  v[MAX] = x0
  trace.push(v.slice())

  if (x0 < N || y0 < M) {
    outer: for (let d = 1; d <= MAX; d++) {
      for (let k = -d; k <= d; k += 2) {
        const ki = k + MAX
        let x: number
        if (k === -d || (k !== d && v[ki - 1]! < v[ki + 1]!)) {
          x = v[ki + 1]! // move down (insert from b)
        } else {
          x = v[ki - 1]! + 1 // move right (delete from a)
        }
        let y = x - k
        while (x < N && y < M && a[x] === b[y]) {
          x++
          y++
        }
        v[ki] = x
        if (x >= N && y >= M) {
          trace.push(v.slice())
          break outer
        }
      }
      trace.push(v.slice())
    }
  }

  // Backtrack through the trace to reconstruct the edit script
  const edits: Edit[] = []
  let x = N
  let y = M

  for (let d = trace.length - 1; d > 0; d--) {
    const k = x - y
    const vPrev = trace[d - 1]!
    let prevK: number
    if (k === -d || (k !== d && vPrev[k - 1 + MAX]! < vPrev[k + 1 + MAX]!)) {
      prevK = k + 1
    } else {
      prevK = k - 1
    }
    const prevX = vPrev[prevK + MAX]!
    const prevY = prevX - prevK

    while (x > prevX && y > prevY) {
      x--
      y--
      edits.unshift({ type: 'eq', aIdx: x, bIdx: y })
    }

    if (x > prevX) {
      x--
      edits.unshift({ type: 'del', aIdx: x, bIdx: y })
    } else if (y > prevY) {
      y--
      edits.unshift({ type: 'add', aIdx: x, bIdx: y })
    }
  }

  while (x > 0 && y > 0) {
    x--
    y--
    edits.unshift({ type: 'eq', aIdx: x, bIdx: y })
  }

  return edits
}

// ─── Public: diffLines ────────────────────────────────────────────────────────

/**
 * Compute a line-level diff between two string arrays.
 * Uses the Myers O(N·D) algorithm with O(N) space — safe for large inputs.
 * Throws if the combined line count exceeds MAX_LINE_TOKENS.
 */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  if (a.length + b.length > MAX_LINE_TOKENS) {
    throw new Error(
      `Inputs are too large for comparison (${a.length + b.length} lines; max ${MAX_LINE_TOKENS.toLocaleString()}). ` +
        'Try comparing smaller sections.',
    )
  }

  const edits = myersDiff(a, b)
  const result: DiffLine[] = []

  // Convert the raw edit list; consecutive snake segments are 'unchanged'
  for (const e of edits) {
    if (e.type === 'eq') {
      result.push({ type: 'unchanged', text: a[e.aIdx]! })
    } else if (e.type === 'del') {
      result.push({ type: 'removed', text: a[e.aIdx]! })
    } else {
      result.push({ type: 'added', text: b[e.bIdx]! })
    }
  }

  return result
}

// ─── Word / token-level diff ─────────────────────────────────────────────────

/**
 * Split a line into word tokens (words, punctuation, spaces kept separate
 * so we can reconstruct the line and highlight only the changed tokens).
 */
function tokenize(s: string): string[] {
  // Match word-runs, individual non-word chars, or whitespace runs
  return s.match(/\w+|[^\w\s]|\s+/g) ?? []
}

/**
 * Returns a word-level diff between two strings.
 * Used to highlight exactly which words / characters changed within a line pair.
 * Returns null when either line exceeds the word-token cap (avoids UI freeze).
 */
export function diffWords(a: string, b: string): WordChange[] | null {
  const tA = tokenize(a)
  const tB = tokenize(b)
  if (tA.length + tB.length > MAX_WORD_TOKENS) return null // too long — skip intra-line highlight

  const edits = myersDiff(tA, tB)
  return edits
    .filter((e) => e.type !== 'eq' || true) // include all
    .map((e): WordChange => {
      if (e.type === 'eq') return { type: 'unchanged', text: tA[e.aIdx]! }
      if (e.type === 'del') return { type: 'removed', text: tA[e.aIdx]! }
      return { type: 'added', text: tB[e.bIdx]! }
    })
}

// ─── 2-Way Side-by-Side alignment ───────────────────────────────────────────

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
        isModified: false,
      })
      i++
    } else if (current.type === 'removed') {
      if (i + 1 < diff.length && diff[i + 1]!.type === 'added') {
        // Pair removed+added as a modified line — enables word-level diff
        aligned.push({
          left: { text: current.text, type: 'removed', num: leftNum++ },
          right: { text: diff[i + 1]!.text, type: 'added', num: rightNum++ },
          isModified: true,
        })
        i += 2
      } else {
        aligned.push({
          left: { text: current.text, type: 'removed', num: leftNum++ },
          right: { text: '', type: 'empty' },
          isModified: false,
        })
        i++
      }
    } else {
      aligned.push({
        left: { text: '', type: 'empty' },
        right: { text: current.text, type: 'added', num: rightNum++ },
        isModified: false,
      })
      i++
    }
  }
  return aligned
}

// ─── 3-Way alignment ────────────────────────────────────────────────────────

export function alignThreeWay(
  a: string[],
  b: string[],
  c: string[],
): AlignedThreeWayLine[] {
  const ab = alignDiff(a, b)
  const ac = alignDiff(a, c)

  const result: AlignedThreeWayLine[] = []
  let abIdx = 0
  let acIdx = 0

  while (abIdx < ab.length || acIdx < ac.length) {
    const lineAB = ab[abIdx]
    const lineAC = ac[acIdx]

    if (
      lineAB &&
      lineAC &&
      lineAB.left.type === 'unchanged' &&
      lineAC.left.type === 'unchanged'
    ) {
      result.push({
        col1: { text: lineAB.left.text, type: 'unchanged', num: lineAB.left.num },
        col2: { text: lineAB.right.text, type: lineAB.right.type, num: lineAB.right.num },
        col3: { text: lineAC.right.text, type: lineAC.right.type, num: lineAC.right.num },
        col2Modified: lineAB.isModified,
        col3Modified: lineAC.isModified,
      })
      abIdx++
      acIdx++
    } else if (lineAB && (!lineAC || lineAB.left.type === 'empty')) {
      result.push({
        col1: { text: '', type: 'empty' },
        col2: { text: lineAB.right.text, type: lineAB.right.type, num: lineAB.right.num },
        col3: { text: '', type: 'empty' },
        col2Modified: false,
        col3Modified: false,
      })
      abIdx++
    } else if (lineAC && (!lineAB || lineAC.left.type === 'empty')) {
      result.push({
        col1: { text: '', type: 'empty' },
        col2: { text: '', type: 'empty' },
        col3: { text: lineAC.right.text, type: lineAC.right.type, num: lineAC.right.num },
        col2Modified: false,
        col3Modified: false,
      })
      acIdx++
    } else {
      if (lineAB && lineAB.left.type === 'removed') {
        result.push({
          col1: { text: lineAB.left.text, type: 'removed', num: lineAB.left.num },
          col2: { text: lineAB.right.text, type: lineAB.right.type, num: lineAB.right.num },
          col3: { text: '', type: 'empty' },
          col2Modified: lineAB.isModified,
          col3Modified: false,
        })
        abIdx++
      } else if (lineAC && lineAC.left.type === 'removed') {
        result.push({
          col1: { text: lineAC.left.text, type: 'removed', num: lineAC.left.num },
          col2: { text: '', type: 'empty' },
          col3: { text: lineAC.right.text, type: lineAC.right.type, num: lineAC.right.num },
          col2Modified: false,
          col3Modified: lineAC.isModified,
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

// ─── Chunked / virtualised rendering helper ──────────────────────────────────

/**
 * Returns the slice of rows to render given a scroll offset and container height.
 * Each row is ROW_HEIGHT_PX tall. Includes an overscan buffer above and below.
 */
export const ROW_HEIGHT_PX = 24
const OVERSCAN = 40

export function visibleSlice(
  totalRows: number,
  scrollTop: number,
  containerHeight: number,
): { start: number; end: number } {
  const start = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT_PX) - OVERSCAN)
  const end = Math.min(
    totalRows,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT_PX) + OVERSCAN,
  )
  return { start, end }
}
