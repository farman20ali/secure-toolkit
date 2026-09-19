import { describe, it, expect } from 'vitest'

// We will test text formatting and JSON error extraction logic
function formatTextString(code: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    if (!code.trim()) return { formatted: '', error: null }
    if (isMinify) {
      const singleLine = code.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
      return { formatted: singleLine, error: null }
    }
    const cleaned = code
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .join('\n')
      .trim()
    return { formatted: cleaned, error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { formatted: '', error: `Text format error: ${msg}` }
  }
}

function extractJsonErrorDetails(code: string, message: string): string {
  const match = message.match(/at position (\d+)/i)
  if (match && match[1]) {
    const pos = parseInt(match[1], 10)
    if (!isNaN(pos) && pos >= 0 && pos <= code.length) {
      const lines = code.substring(0, pos).split('\n')
      const lineNum = lines.length
      const colNum = lines[lines.length - 1]!.length + 1
      return `JSON Syntax Error at Line ${lineNum}, Column ${colNum}: ${message}`
    }
  }
  return `JSON Syntax Error: ${message}`
}

describe('Code & Text Beautifier Logic', () => {
  it('converts multiline text to a single inline string in minify mode', () => {
    const text = 'Hello\n  World\n\nThis is   a\n test.'
    const result = formatTextString(text, true)
    expect(result.error).toBeNull()
    expect(result.formatted).toBe('Hello World This is a test.')
  })

  it('trims whitespace line by line in beautify mode for text', () => {
    const text = 'Line 1   \nLine 2\t\nLine 3'
    const result = formatTextString(text, false)
    expect(result.error).toBeNull()
    expect(result.formatted).toBe('Line 1\nLine 2\nLine 3')
  })

  it('extracts line and column numbers from JSON position error messages', () => {
    const jsonStr = '{\n  "name": "Alice",\n  "invalid": bad\n}'
    const errorMsg = 'Unexpected token b in JSON at position 31'
    const detailed = extractJsonErrorDetails(jsonStr, errorMsg)
    expect(detailed).toContain('Line 3')
    expect(detailed).toContain('Column')
  })
})
