import { useState, useEffect, useCallback } from 'react'
import { CopyButton } from '../../components/CopyButton'

type FormatLang = 'json' | 'xml' | 'html' | 'sql'
type TabSize = '2' | '4' | 'tab'

// Helper to format XML/HTML
function formatXmlHtml(code: string, indentChar: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    const clean = code.replace(/\s+/g, ' ').trim()
    if (isMinify) {
      // Remove spaces between tags
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
  } catch (e: any) {
    return { formatted: '', error: `XML/HTML format error: ${e.message}` }
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

    // Capitalize keywords
    keywords.forEach(kw => {
      const regex = new RegExp('\\b' + kw + '\\b', 'gi')
      cleaned = cleaned.replace(regex, kw)
    })

    const majorClauses = [
      'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 
      'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 
      'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'UNION'
    ]

    let formatted = cleaned
    majorClauses.forEach(clause => {
      const regex = new RegExp('(\\s)(' + clause + '\\b)', 'g')
      formatted = formatted.replace(regex, '\n$2')
    })

    const subClauses = ['AND', 'OR', 'ON']
    subClauses.forEach(clause => {
      const regex = new RegExp('(\\s)(' + clause + '\\b)', 'g')
      formatted = formatted.replace(regex, '\n' + indentChar + '$2')
    })

    return { formatted: formatted.trim(), error: null }
  } catch (e: any) {
    return { formatted: '', error: `SQL format error: ${e.message}` }
  }
}

// Helper to format JSON
function formatJsonString(code: string, indentChar: string, isMinify = false): { formatted: string; error: string | null } {
  try {
    if (!code.trim()) return { formatted: '', error: null }
    const parsed = JSON.parse(code)
    if (isMinify) {
      return { formatted: JSON.stringify(parsed), error: null }
    }
    const spacing = indentChar === '\t' ? '\t' : Number(indentChar.length)
    return { formatted: JSON.stringify(parsed, null, spacing), error: null }
  } catch (e: any) {
    return { formatted: '', error: `JSON format error: ${e.message}` }
  }
}

export default function CodeBeautifyTool() {
  const [lang, setLang] = useState<FormatLang>('json')
  const [tabSize, setTabSize] = useState<TabSize>('2')
  const [isMinify, setIsMinify] = useState(false)
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleFormat = useCallback((rawInput: string, currentLang: FormatLang, currentTab: TabSize, currentMinify: boolean) => {
    if (!rawInput.trim()) {
      setOutput('')
      setError(null)
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
    }

    if (result.error) {
      setError(result.error)
      setOutput('')
    } else {
      setError(null)
      setOutput(result.formatted)
    }
  }, [])

  useEffect(() => {
    handleFormat(input, lang, tabSize, isMinify)
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
    } catch (e: any) {
      setError(`Failed to auto-fix JSON/JS object: ${e.message}`)
    }
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
    setError(null)
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Code Beautifier</h1>
        <p className="text-sm text-zinc-400">
          Format or minify JSON, XML, HTML, and SQL queries locally.
        </p>
      </header>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-2">
          {(['json', 'xml', 'html', 'sql'] as FormatLang[]).map((l) => (
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
              {l}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Indent sizes (only when not minifying) */}
          {!isMinify && (
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

          {/* Minify Toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMinify(false)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                !isMinify
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-750'
                  : 'text-zinc-500 hover:text-zinc-350 border border-transparent'
              }`}
            >
              Beautify
            </button>
            <button
              type="button"
              onClick={() => setIsMinify(true)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                isMinify
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-750'
                  : 'text-zinc-500 hover:text-zinc-350 border border-transparent'
              }`}
            >
              Minify
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
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-750 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Inputs Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Input */}
        <div className="space-y-2">
          <label htmlFor="beautify-input" className="block text-sm font-medium text-zinc-300">
            Raw Input
          </label>
          <textarea
            id="beautify-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste raw, unformatted ${lang.toUpperCase()} here...`}
            className="h-96 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
          />
        </div>

        {/* Output */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor="beautify-output" className="block text-sm font-medium text-zinc-300">
              Formatted Output
            </label>
            <CopyButton text={output} disabled={!!error || !output} />
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
              placeholder="Beautified output will appear here..."
              className="h-96 w-full rounded-lg border border-zinc-800 bg-zinc-950 p-4 font-mono text-sm text-emerald-300 focus:outline-none resize-y"
            />
          )}
        </div>
      </div>
    </div>
  )
}
