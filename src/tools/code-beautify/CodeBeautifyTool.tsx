import { useState, useEffect, useCallback, useRef } from 'react'
import { CopyButton } from '../../components/CopyButton'

type FormatLang = 'json' | 'xml' | 'html' | 'sql' | 'text'
type TabSize = '2' | '4' | 'tab'

// Helper to format XML/HTML
function formatXmlHtml(code: string, indentChar: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    const clean = code.replace(/\s+/g, ' ').trim()
    if (isMinify) {
      const minified = clean.replace(/>\s+</g, '><')
      return { formatted: minified, error: null }
    }

    const reg = /(<[^>]+>)/g
    const parts = clean.replace(/>\s*</g, '><').split(reg)
    let depth = 0
    let formatted = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]?.trim()
      if (!part) continue

      if (part.startsWith('</')) {
        depth = Math.max(0, depth - 1)
        formatted += '\n' + indentChar.repeat(depth) + part
      } else if (part.startsWith('<?') || part.startsWith('<!') || part.startsWith('<!--')) {
        formatted += '\n' + indentChar.repeat(depth) + part
      } else if (part.startsWith('<') && part.endsWith('/>')) {
        formatted += '\n' + indentChar.repeat(depth) + part
      } else if (part.startsWith('<')) {
        formatted += '\n' + indentChar.repeat(depth) + part
        depth++
      } else {
        formatted += '\n' + indentChar.repeat(depth) + part
      }
    }
    return { formatted: formatted.trim(), error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { formatted: '', error: `XML/HTML format error: ${msg}` }
  }
}

// Helper to format SQL
function formatSqlQuery(code: string, indentChar: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    if (isMinify) {
      const minified = code.replace(/\s+/g, ' ').trim()
      return { formatted: minified, error: null }
    }

    const keywords = [
      'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
      'INNER JOIN', 'OUTER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'UNION', 'ON'
    ]

    let cleaned = code.replace(/\s+/g, ' ').trim()

    keywords.forEach((kw) => {
      const regex = new RegExp('\\b' + kw + '\\b', 'gi')
      cleaned = cleaned.replace(regex, kw)
    })

    const majorClauses = [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
      'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'UNION'
    ]

    let formatted = cleaned
    majorClauses.forEach((clause) => {
      const regex = new RegExp('(\\s)(' + clause + '\\b)', 'g')
      formatted = formatted.replace(regex, '\n$2')
    })

    const subClauses = ['AND', 'OR', 'ON']
    subClauses.forEach((clause) => {
      const regex = new RegExp('(\\s)(' + clause + '\\b)', 'g')
      formatted = formatted.replace(regex, '\n' + indentChar + '$2')
    })

    return { formatted: formatted.trim(), error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { formatted: '', error: `SQL format error: ${msg}` }
  }
}

// Helper to extract JSON error position details
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

// Helper to format JSON (optimized for large JSON payloads)
function formatJsonString(code: string, indentChar: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    if (!code.trim()) return { formatted: '', error: null }
    const parsed = JSON.parse(code)
    if (isMinify) {
      return { formatted: JSON.stringify(parsed), error: null }
    }
    const spacing = indentChar === '\t' ? '\t' : Number(indentChar.length)
    return { formatted: JSON.stringify(parsed, null, spacing), error: null }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return { formatted: '', error: extractJsonErrorDetails(code, msg) }
  }
}

// Helper to format plain text / make text in line
function formatTextString(code: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    if (!code.trim()) return { formatted: '', error: null }
    if (isMinify) {
      // Single line mode: collapse line breaks and multiple spaces into one single inline string
      const singleLine = code.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim()
      return { formatted: singleLine, error: null }
    }
    // Clean multiline text: trim trailing space per line and normalize line endings
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

export default function CodeBeautifyTool() {
  const [lang, setLang] = useState<FormatLang>('json')
  const [tabSize, setTabSize] = useState<TabSize>('2')
  const [isMinify, setIsMinify] = useState(false)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleFormat = useCallback((rawInput: string, currentLang: FormatLang, currentTab: TabSize, currentMinify: boolean) => {
    if (!rawInput.trim()) {
      setOutput('')
      setError(null)
      setIsProcessing(false)
      return
    }

    const indentStr = currentTab === 'tab' ? '\t' : ' '.repeat(Number(currentTab))
    let result: { formatted: string; error: string | null }

    switch (currentLang) {
      case 'json':
        result = formatJsonString(rawInput, indentStr, currentMinify)
        break
      case 'xml':
      case 'html':
        result = formatXmlHtml(rawInput, indentStr, currentMinify)
        break
      case 'sql':
        result = formatSqlQuery(rawInput, indentStr, currentMinify)
        break
      case 'text':
        result = formatTextString(rawInput, currentMinify)
        break
    }

    if (result.error) {
      setError(result.error)
      setOutput('')
    } else {
      setError(null)
      setOutput(result.formatted)
    }
    setIsProcessing(false)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    // Debounce processing for large inputs (>50KB) to keep UI inputs responsive
    if (input.length > 50000) {
      setIsProcessing(true)
      debounceRef.current = setTimeout(() => {
        handleFormat(input, lang, tabSize, isMinify)
      }, 150)
    } else {
      handleFormat(input, lang, tabSize, isMinify)
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input, lang, tabSize, isMinify, handleFormat])

  const fixJsonErrors = () => {
    if (!input.trim()) return
    try {
      // Evaluate string as a JS expression using Function (sandboxed browser context)
      const parsed = new Function(`return (${input})`)()
      if (parsed !== null && typeof parsed === 'object') {
        const spacing = tabSize === 'tab' ? '\t' : ' '.repeat(Number(tabSize))
        const fixed = JSON.stringify(parsed, null, isMinify ? undefined : spacing)
        setInput(fixed)
        setError(null)
      } else {
        setError('Could not convert to a valid JS object.')
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Failed to auto-fix JSON/JS object: ${msg}`)
    }
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const inputLineCount = input ? input.split('\n').length : 0
  const outputLineCount = output ? output.split('\n').length : 0

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-zinc-50 flex items-center gap-2">
          <span>🧹</span>
          <span>Code &amp; Text Beautifier</span>
        </h1>
        <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">
          Format, minify, and inline JSON (with large payload support), XML, HTML, SQL, and plain text.
        </p>
      </header>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-2">
          {(['json', 'xml', 'html', 'sql', 'text'] as FormatLang[]).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                lang === l
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              {l === 'text' ? '📝 Text (Inline)' : l}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Indent sizes (only when not minifying/inlining and not text mode) */}
          {!isMinify && lang !== 'text' && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-500">Indent:</span>
              <div className="flex rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
                {(['2', '4', 'tab'] as TabSize[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTabSize(t)}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      tabSize === t
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t === 'tab' ? 'Tab' : t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Mode Toggle (Beautify vs Minify / Inline) */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMinify(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                !isMinify
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {lang === 'text' ? 'Clean Multi-line' : 'Beautify'}
            </button>
            <button
              type="button"
              onClick={() => setIsMinify(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                isMinify
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
              }`}
            >
              {lang === 'text' ? 'Make In-line (Single Line)' : 'Minify'}
            </button>
          </div>

          {/* JSON Autofix */}
          {lang === 'json' && (
            <button
              type="button"
              onClick={fixJsonErrors}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition"
              title="Convert JS object literals (single quotes, unquoted keys, trailing commas) to valid JSON"
            >
              Fix Loose JSON
            </button>
          )}

          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Large Input Performance Banner */}
      {input.length > 100000 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-300">
          <span>⚡ Large payload detected ({formatSize(input.length)}). Processing asynchronously to prevent UI freeze.</span>
          {isProcessing && <span className="animate-pulse font-bold text-amber-400">Formatting...</span>}
        </div>
      )}

      {/* Inputs Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="beautify-input" className="block text-sm font-medium text-zinc-300">
              Raw Input ({lang.toUpperCase()})
            </label>
            {input && (
              <span className="text-xs text-zinc-500 font-mono">
                {formatSize(input.length)} | {inputLineCount.toLocaleString()} lines
              </span>
            )}
          </div>
          <textarea
            id="beautify-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              lang === 'text'
                ? 'Paste multiline text here to collapse into a single line or clean formatting...'
                : `Paste raw, unformatted ${lang.toUpperCase()} here...`
            }
            className="h-96 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y shadow-xs"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="beautify-output" className="block text-sm font-medium text-zinc-300">
              {lang === 'text' && isMinify ? 'In-line Text Output' : 'Formatted Output'}
            </label>
            <div className="flex items-center gap-3">
              {output && (
                <span className="text-xs text-zinc-500 font-mono">
                  {formatSize(output.length)} | {outputLineCount.toLocaleString()} lines
                </span>
              )}
              <CopyButton text={output} disabled={!!error || !output} />
            </div>
          </div>
          {error ? (
            <div className="flex h-96 w-full items-center justify-center rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-center text-sm text-red-400 font-medium">
              {error}
            </div>
          ) : (
            <textarea
              id="beautify-output"
              value={output}
              readOnly
              placeholder={
                lang === 'text' && isMinify
                  ? 'In-line text will appear here...'
                  : 'Beautified output will appear here...'
              }
              className="h-96 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-emerald-300 focus:outline-none resize-y shadow-xs"
            />
          )}
        </div>
      </div>
    </div>
  )
}
