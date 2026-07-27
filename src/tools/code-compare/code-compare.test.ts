import { describe, expect, it } from 'vitest'
import { diffLines, alignDiff, alignThreeWay, diffWords } from './diff'

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

describe('diffWords', () => {
  it('highlights changed tokens between two lines', () => {
    const result = diffWords('hello world', 'hello earth')
    expect(result).not.toBeNull()
    const texts = result!.map((c) => ({ type: c.type, text: c.text }))
    // 'hello' and ' ' unchanged, 'world' removed, 'earth' added
    expect(texts.find((t) => t.text === 'world')?.type).toBe('removed')
    expect(texts.find((t) => t.text === 'earth')?.type).toBe('added')
    expect(texts.find((t) => t.text === 'hello')?.type).toBe('unchanged')
  })
})

describe('Aligned Diff', () => {
  it('aligns two documents with modified line pairing and sets isModified', () => {
    const a = ['line1', 'line2']
    const b = ['line1', 'line2-mod']

    const aligned = alignDiff(a, b)
    expect(aligned).toHaveLength(2)
    expect(aligned[0]).toEqual({
      left: { text: 'line1', type: 'unchanged', num: 1 },
      right: { text: 'line1', type: 'unchanged', num: 1 },
      isModified: false,
    })
    expect(aligned[1]).toMatchObject({
      left: { text: 'line2', type: 'removed' },
      right: { text: 'line2-mod', type: 'added' },
      isModified: true,
    })
  })

  it('handles pure additions with empty spacer on left', () => {
    const a = ['line1']
    const b = ['line1', 'line2']

    const aligned = alignDiff(a, b)
    expect(aligned).toHaveLength(2)
    expect(aligned[1]).toMatchObject({
      left: { text: '', type: 'empty' },
      right: { text: 'line2', type: 'added', num: 2 },
      isModified: false,
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
    expect(aligned[0]).toMatchObject({
      col1: { text: 'line1', type: 'unchanged' },
      col2: { text: 'line1', type: 'unchanged' },
      col3: { text: 'line1', type: 'unchanged' },
    })
  })
})
