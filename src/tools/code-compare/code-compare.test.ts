import { describe, expect, it } from 'vitest'
import { diffLines, alignDiff, alignThreeWay } from './diff'

describe('LCS Diff Lines', () => {
  it('correctly identifies unchanged, added, and removed lines', () => {
    const a = ['line1', 'line2', 'line3']
    const b = ['line1', 'line2-modified', 'line3', 'line4-added']

    const diff = diffLines(a, b)
    expect(diff).toEqual([
      { type: 'unchanged', text: 'line1' },
      { type: 'removed', text: 'line2' },
      { type: 'added', text: 'line2-modified' },
      { type: 'unchanged', text: 'line3' },
      { type: 'added', text: 'line4-added' },
    ])
  })
})

describe('Aligned Diff', () => {
  it('aligns two documents with modified line pairing', () => {
    const a = ['line1', 'line2']
    const b = ['line1', 'line2-mod']

    const aligned = alignDiff(a, b)
    expect(aligned).toHaveLength(2)
    expect(aligned[0]).toEqual({
      left: { text: 'line1', type: 'unchanged', num: 1 },
      right: { text: 'line1', type: 'unchanged', num: 1 },
    })
    expect(aligned[1]).toEqual({
      left: { text: 'line2', type: 'removed', num: 2 },
      right: { text: 'line2-mod', type: 'added', num: 2 },
    })
  })

  it('handles empty spacer alignments for added/removed items', () => {
    const a = ['line1']
    const b = ['line1', 'line2']

    const aligned = alignDiff(a, b)
    expect(aligned).toHaveLength(2)
    expect(aligned[1]).toEqual({
      left: { text: '', type: 'empty' },
      right: { text: 'line2', type: 'added', num: 2 },
    })
  })
})

describe('3-Way Alignment', () => {
  it('aligns three documents relative to the base column', () => {
    const base = ['line1', 'line2']
    const v1 = ['line1', 'line2-mod']
    const v2 = ['line1', 'line2', 'line3-added']

    const aligned = alignThreeWay(base, v1, v2)
    // line1 is unchanged in all three
    expect(aligned[0]).toEqual({
      col1: { text: 'line1', type: 'unchanged', num: 1 },
      col2: { text: 'line1', type: 'unchanged', num: 1 },
      col3: { text: 'line1', type: 'unchanged', num: 1 },
    })
  })
})
