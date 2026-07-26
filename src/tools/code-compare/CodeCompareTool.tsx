import { useState, useCallback } from 'react'
import { alignDiff, alignThreeWay, type AlignedDiffLine, type AlignedThreeWayLine, type DiffLine } from './diff'

type CompareLang = 'text' | 'json' | 'xml' | 'sql'

// Minor XML beautifier for pre-formatting
function formatXmlSimple(xml: string): string {
  const clean = xml.replace(/\s+/g, ' ').trim()
  const reg = /(<[^>]+>)/g
  const parts = clean.replace(/>\s*</g, '><').split(reg)
  let depth = 0
  let formatted = ''
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]?.trim()
    if (!part) continue
    if (part.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      formatted += '\n' + '  '.repeat(depth) + part
    } else if (part.startsWith('<') && part.endsWith('/>')) {
      formatted += '\n' + '  '.repeat(depth) + part
    } else if (part.startsWith('<')) {
      formatted += '\n' + '  '.repeat(depth) + part
      depth++
    } else {
      formatted += '\n' + '  '.repeat(depth) + part
    }
  }
  return formatted.trim()
}

// Minor SQL beautifier for pre-formatting
function formatSqlSimple(sql: string): string {
  const keywords = ['SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM']
  let cleaned = sql.replace(/\s+/g, ' ').trim()
  keywords.forEach(kw => {
    const regex = new RegExp('\\b' + kw + '\\b', 'gi')
    cleaned = cleaned.replace(regex, kw)
  })
  let formatted = cleaned
  keywords.forEach(clause => {
    const regex = new RegExp('(\\s)(' + clause + '\\b)', 'g')
    formatted = formatted.replace(regex, '\n$2')
  })
  return formatted.trim()
}

export default function CodeCompareTool() {
  const [mode, setMode] = useState<'2-way' | '3-way'>('2-way')
  const [lang, setLang] = useState<CompareLang>('text')
  const [preFormat, setPreFormat] = useState(true)
  const [activeTab, setActiveTab] = useState<'inputs' | 'diff'>('inputs')

  const [input1, setInput1] = useState('')
  const [input2, setInput2] = useState('')
  const [input3, setInput3] = useState('')

  const [diff2Way, setDiff2Way] = useState<AlignedDiffLine[]>([])
  const [diff3Way, setDiff3Way] = useState<AlignedThreeWayLine[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleCompare = useCallback(() => {
    setError(null)
    try {
      let txt1 = input1
      let txt2 = input2
      let txt3 = input3

      if (preFormat) {
        if (lang === 'json') {
          if (txt1.trim()) txt1 = JSON.stringify(JSON.parse(txt1), null, 2)
          if (txt2.trim()) txt2 = JSON.stringify(JSON.parse(txt2), null, 2)
          if (txt3.trim()) txt3 = JSON.stringify(JSON.parse(txt3), null, 2)
        } else if (lang === 'xml') {
          if (txt1.trim()) txt1 = formatXmlSimple(txt1)
          if (txt2.trim()) txt2 = formatXmlSimple(txt2)
          if (txt3.trim()) txt3 = formatXmlSimple(txt3)
        } else if (lang === 'sql') {
          if (txt1.trim()) txt1 = formatSqlSimple(txt1)
          if (txt2.trim()) txt2 = formatSqlSimple(txt2)
          if (txt3.trim()) txt3 = formatSqlSimple(txt3)
        }
      }

      const lines1 = txt1.split(/\r?\n/)
      const lines2 = txt2.split(/\r?\n/)
      const lines3 = txt3.split(/\r?\n/)

      if (mode === '2-way') {
        setDiff2Way(alignDiff(lines1, lines2))
      } else {
        setDiff3Way(alignThreeWay(lines1, lines2, lines3))
      }
      setActiveTab('diff')
    } catch (e: any) {
      setError(`Pre-format error: Ensure inputs are valid ${lang.toUpperCase()}. (${e.message})`)
    }
  }, [input1, input2, input3, mode, lang, preFormat])

  // Clear inputs
  const handleClear = () => {
    setInput1('')
    setInput2('')
    setInput3('')
    setDiff2Way([])
    setDiff3Way([])
    setError(null)
    setActiveTab('inputs')
  }

  // Render Diff Line CSS
  const getLineClass = (type: DiffLine['type']) => {
    switch (type) {
      case 'added':
        return 'bg-emerald-950/40 text-emerald-300 border-l-2 border-emerald-500'
      case 'removed':
        return 'bg-red-950/40 text-red-300 border-l-2 border-red-500'
      case 'empty':
        return 'bg-zinc-900/30 opacity-30 select-none'
      default:
        return 'text-zinc-350'
    }
  }

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Code Diff & Comparer</h1>
        <p className="text-sm text-zinc-400">
          Compare two or three codes/texts side-by-side. Supports automatic pre-formatting for clean semantic diffs.
        </p>
      </header>

      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex gap-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode('2-way')
                setActiveTab('inputs')
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                mode === '2-way'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              2-Way Compare
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('3-way')
                setActiveTab('inputs')
              }}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                mode === '3-way'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
            >
              3-Way Compare
            </button>
          </div>

          <div className="h-6 w-px bg-zinc-800 self-center" />

          <div className="flex gap-2">
            {(['text', 'json', 'xml', 'sql'] as CompareLang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                  lang === l
                    ? 'bg-zinc-850 text-zinc-150 border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lang !== 'text' && (
            <label htmlFor="opt-preformat" className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200">
              <input
                id="opt-preformat"
                type="checkbox"
                checked={preFormat}
                onChange={(e) => setPreFormat(e.target.checked)}
                className="size-3.5 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/40"
              />
              Format before compare
            </label>
          )}

          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-zinc-750 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('inputs')}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'inputs'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            1. Edit Inputs
          </button>
          <button
            type="button"
            onClick={() => {
              if (input1.trim() && input2.trim()) {
                handleCompare()
              }
            }}
            disabled={!input1.trim() || !input2.trim()}
            className={`pb-3 text-sm font-semibold border-b-2 transition ${
              activeTab === 'diff'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            2. Diff Results
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/15 p-4 text-sm text-red-400 font-medium">
          {error}
        </div>
      )}

      {/* Inputs View */}
      {activeTab === 'inputs' && (
        <div className="space-y-6">
          <div className={`grid gap-6 ${mode === '3-way' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {/* Input 1 */}
            <div className="space-y-2">
              <label htmlFor="comp-input1" className="block text-sm font-medium text-zinc-300">
                {mode === '3-way' ? 'Original / Base (Input 1)' : 'Left Side (Input 1)'}
              </label>
              <textarea
                id="comp-input1"
                value={input1}
                onChange={(e) => setInput1(e.target.value)}
                placeholder="Paste code or text here..."
                className="h-80 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
              />
            </div>

            {/* Input 2 */}
            <div className="space-y-2">
              <label htmlFor="comp-input2" className="block text-sm font-medium text-zinc-300">
                {mode === '3-way' ? 'Version A (Input 2)' : 'Right Side (Input 2)'}
              </label>
              <textarea
                id="comp-input2"
                value={input2}
                onChange={(e) => setInput2(e.target.value)}
                placeholder="Paste code or text here..."
                className="h-80 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
              />
            </div>

            {/* Input 3 (only in 3-way) */}
            {mode === '3-way' && (
              <div className="space-y-2">
                <label htmlFor="comp-input3" className="block text-sm font-medium text-zinc-300">
                  Version B (Input 3)
                </label>
                <textarea
                  id="comp-input3"
                  value={input3}
                  onChange={(e) => setInput3(e.target.value)}
                  placeholder="Paste code or text here..."
                  className="h-80 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-150 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleCompare}
              disabled={!input1.trim() || !input2.trim() || (mode === '3-way' && !input3.trim())}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Compare Code & Show Diff
            </button>
          </div>
        </div>
      )}

      {/* Diff Results View */}
      {activeTab === 'diff' && (
        <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
          {mode === '2-way' ? (
            // 2-Way Diff View
            <div className="grid grid-cols-2 min-w-[700px] divide-x divide-zinc-800">
              {/* Left Side */}
              <div className="font-mono text-xs leading-relaxed select-text py-2">
                <div className="px-4 py-1 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-900 mb-2">
                  Left Side (Original)
                </div>
                {diff2Way.map((line, idx) => (
                  <div key={idx} className={`flex px-2 py-0.5 ${getLineClass(line.left.type)}`}>
                    <span className="w-8 shrink-0 text-right pr-3 text-zinc-650 select-none">
                      {line.left.num ?? ''}
                    </span>
                    <span className="whitespace-pre break-all">{line.left.text || ' '}</span>
                  </div>
                ))}
              </div>

              {/* Right Side */}
              <div className="font-mono text-xs leading-relaxed select-text py-2">
                <div className="px-4 py-1 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-900 mb-2">
                  Right Side (Modified)
                </div>
                {diff2Way.map((line, idx) => (
                  <div key={idx} className={`flex px-2 py-0.5 ${getLineClass(line.right.type)}`}>
                    <span className="w-8 shrink-0 text-right pr-3 text-zinc-650 select-none">
                      {line.right.num ?? ''}
                    </span>
                    <span className="whitespace-pre break-all">{line.right.text || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            // 3-Way Diff View
            <div className="grid grid-cols-3 min-w-[1000px] divide-x divide-zinc-800">
              {/* Base */}
              <div className="font-mono text-xs leading-relaxed select-text py-2">
                <div className="px-4 py-1 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-900 mb-2">
                  Base (Original)
                </div>
                {diff3Way.map((line, idx) => (
                  <div key={idx} className={`flex px-2 py-0.5 ${getLineClass(line.col1.type)}`}>
                    <span className="w-8 shrink-0 text-right pr-3 text-zinc-650 select-none">
                      {line.col1.num ?? ''}
                    </span>
                    <span className="whitespace-pre break-all">{line.col1.text || ' '}</span>
                  </div>
                ))}
              </div>

              {/* Version A */}
              <div className="font-mono text-xs leading-relaxed select-text py-2">
                <div className="px-4 py-1 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-900 mb-2">
                  Version A (Input 2)
                </div>
                {diff3Way.map((line, idx) => (
                  <div key={idx} className={`flex px-2 py-0.5 ${getLineClass(line.col2.type)}`}>
                    <span className="w-8 shrink-0 text-right pr-3 text-zinc-650 select-none">
                      {line.col2.num ?? ''}
                    </span>
                    <span className="whitespace-pre break-all">{line.col2.text || ' '}</span>
                  </div>
                ))}
              </div>

              {/* Version B */}
              <div className="font-mono text-xs leading-relaxed select-text py-2">
                <div className="px-4 py-1 text-zinc-500 font-semibold uppercase text-[10px] tracking-wider border-b border-zinc-900 mb-2">
                  Version B (Input 3)
                </div>
                {diff3Way.map((line, idx) => (
                  <div key={idx} className={`flex px-2 py-0.5 ${getLineClass(line.col3.type)}`}>
                    <span className="w-8 shrink-0 text-right pr-3 text-zinc-650 select-none">
                      {line.col3.num ?? ''}
                    </span>
                    <span className="whitespace-pre break-all">{line.col3.text || ' '}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
