import { useState, useCallback, Fragment, useRef, useEffect } from 'react'
import {
  alignDiff,
  alignThreeWay,
  diffWords,
  ROW_HEIGHT_PX,
  visibleSlice,
  type AlignedDiffLine,
  type AlignedThreeWayLine,
  type DiffLine,
} from './diff'

type CompareLang = 'text' | 'json' | 'xml' | 'sql'

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatJson(s: string): string {
  return JSON.stringify(JSON.parse(s), null, 2)
}

function formatXml(xml: string): string {
  const clean = xml.replace(/>\s*</g, '><').trim()
  const parts = clean.split(/(<[^>]+>)/g)
  let depth = 0
  let out = ''
  for (const part of parts) {
    const p = part.trim()
    if (!p) continue
    if (p.startsWith('</')) {
      depth = Math.max(0, depth - 1)
      out += '\n' + '  '.repeat(depth) + p
    } else if (p.startsWith('<') && p.endsWith('/>')) {
      out += '\n' + '  '.repeat(depth) + p
    } else if (p.startsWith('<') && !p.startsWith('<?') && !p.startsWith('<!--')) {
      out += '\n' + '  '.repeat(depth) + p
      depth++
    } else {
      out += '\n' + '  '.repeat(depth) + p
    }
  }
  return out.trim()
}

function formatSql(sql: string): string {
  const kwMain = ['SELECT','FROM','WHERE','GROUP BY','ORDER BY','HAVING','LIMIT',
    'INSERT INTO','VALUES','UPDATE','SET','DELETE FROM','UNION ALL','UNION',
    'LEFT JOIN','RIGHT JOIN','INNER JOIN','OUTER JOIN','CROSS JOIN','JOIN','ON']
  const kwSub = ['AND','OR']
  let s = sql.replace(/\s+/g, ' ').trim()
  kwMain.forEach(kw => {
    s = s.replace(new RegExp('(?<=[\\s,]|^)(' + kw + ')(?=[\\s]|$)', 'gi'), kw)
  })
  let out = s
  kwMain.forEach(kw => {
    out = out.replace(new RegExp('([\\s])(' + kw + '\\b)', 'g'), '\n$2')
  })
  kwSub.forEach(kw => {
    out = out.replace(new RegExp('([\\s])(' + kw + '\\b)', 'g'), '\n  $2')
  })
  return out.trim()
}

function tryFormat(s: string, lang: CompareLang): { ok: boolean; result: string } {
  if (!s.trim()) return { ok: true, result: s }
  try {
    if (lang === 'json') return { ok: true, result: formatJson(s) }
    if (lang === 'xml')  return { ok: true, result: formatXml(s) }
    if (lang === 'sql')  return { ok: true, result: formatSql(s) }
    return { ok: true, result: s }
  } catch {
    return { ok: false, result: s }
  }
}

function fmtBytes(s: string) {
  const b = new Blob([s]).size
  return b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`
}

// ─── Row colours ─────────────────────────────────────────────────────────────

function rowBg(type: DiffLine['type'], isModified?: boolean) {
  if (isModified) return 'bg-amber-950/40 border-l-2 border-amber-400/60'
  switch (type) {
    case 'added':   return 'bg-emerald-950/50 border-l-2 border-emerald-500/70'
    case 'removed': return 'bg-red-950/50 border-l-2 border-red-500/70'
    case 'empty':   return 'bg-zinc-900/20'
    default:        return ''
  }
}

// ─── Inline word-diff ─────────────────────────────────────────────────────────

function InlineDiff({
  leftText, rightText, side, enabled,
}: {
  leftText: string; rightText: string; side: 'left' | 'right'; enabled: boolean
}) {
  if (!enabled) {
    const cls = side === 'left' ? 'text-red-200' : 'text-emerald-200'
    return <span className={`whitespace-pre-wrap break-all ${cls}`}>{side === 'left' ? leftText : rightText}</span>
  }
  const changes = diffWords(leftText, rightText)
  if (!changes) {
    // Line too long for word diff — show plain coloured text
    const cls = side === 'left' ? 'text-red-200' : 'text-emerald-200'
    return <span className={`whitespace-pre-wrap break-all ${cls}`}>{side === 'left' ? leftText : rightText}</span>
  }
  return (
    <span className="whitespace-pre-wrap break-all">
      {changes.map((c, i) => {
        if (c.type === 'unchanged') return <span key={i}>{c.text}</span>
        if (side === 'left' && c.type === 'removed')
          return <mark key={i} className="rounded-[2px] bg-red-500/40 text-red-100 not-italic">{c.text}</mark>
        if (side === 'right' && c.type === 'added')
          return <mark key={i} className="rounded-[2px] bg-emerald-500/40 text-emerald-100 not-italic">{c.text}</mark>
        return null
      })}
    </span>
  )
}

// ─── Stats ────────────────────────────────────────────────────────────────────

function calcStats(aligned: AlignedDiffLine[]) {
  let added = 0, removed = 0, modified = 0
  for (const row of aligned) {
    if (row.isModified) { modified++; continue }
    if (row.right.type === 'added')   added++
    if (row.left.type  === 'removed') removed++
  }
  return { added, removed, modified }
}

// ─── Virtual scroll container ─────────────────────────────────────────────────

function VirtualScroll({
  totalRows, renderRows,
}: {
  totalRows: number
  renderRows: (start: number, end: number) => React.ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const [slice, setSlice] = useState({ start: 0, end: Math.min(totalRows, 200) })

  useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const update = () => {
      const { scrollTop, clientHeight } = el
      setSlice(visibleSlice(totalRows, scrollTop, clientHeight))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    return () => el.removeEventListener('scroll', update)
  }, [totalRows])

  const topPad = slice.start * ROW_HEIGHT_PX
  const botPad = (totalRows - slice.end) * ROW_HEIGHT_PX

  return (
    <div ref={outerRef} className="overflow-auto" style={{ maxHeight: '70vh' }}>
      <div style={{ paddingTop: topPad, paddingBottom: botPad }}>
        {renderRows(slice.start, slice.end)}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CodeCompareTool() {
  const [mode,             setMode]             = useState<'2-way' | '3-way'>('2-way')
  const [lang,             setLang]             = useState<CompareLang>('text')
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false)
  const [wordDiff,         setWordDiff]         = useState(true)
  const [autoBeautify,     setAutoBeautify]     = useState(true)
  const [activeTab,        setActiveTab]        = useState<'inputs' | 'diff'>('inputs')

  const [input1, setInput1] = useState('')
  const [input2, setInput2] = useState('')
  const [input3, setInput3] = useState('')

  const [diff2Way,  setDiff2Way]  = useState<AlignedDiffLine[]>([])
  const [diff3Way,  setDiff3Way]  = useState<AlignedThreeWayLine[]>([])
  const [error,     setError]     = useState<string | null>(null)
  const [computing, setComputing] = useState(false)

  // Format inputs in-place
  const handleFormatInputs = useCallback(() => {
    setError(null)
    let err: string | null = null
    const f = (s: string) => {
      const r = tryFormat(s, lang)
      if (!r.ok) err = `Format failed — check your ${lang.toUpperCase()} syntax.`
      return r.result
    }
    setInput1(f); setInput2(f)
    if (mode === '3-way') setInput3(f)
    if (err) setError(err)
  }, [lang, mode])

  const normalise = useCallback((s: string): string[] => {
    const lines = s.split(/\r?\n/)
    return ignoreWhitespace ? lines.map(l => l.trim()) : lines
  }, [ignoreWhitespace])

  const handleCompare = useCallback(() => {
    setError(null)
    setComputing(true)
    // Defer to next tick so UI can repaint the "Computing…" state
    setTimeout(() => {
      try {
        let t1 = input1, t2 = input2, t3 = input3

        // Auto-beautify structured langs before comparing (controlled by flag)
        if (autoBeautify && lang !== 'text') {
          const r1 = tryFormat(t1, lang)
          const r2 = tryFormat(t2, lang)
          if (!r1.ok || !r2.ok) throw new Error(`Invalid ${lang.toUpperCase()} in one of the inputs — fix syntax or switch to Text mode.`)
          t1 = r1.result; t2 = r2.result
          if (mode === '3-way') {
            const r3 = tryFormat(t3, lang)
            if (!r3.ok) throw new Error(`Invalid ${lang.toUpperCase()} in Input 3.`)
            t3 = r3.result
          }
        }

        const l1 = normalise(t1)
        const l2 = normalise(t2)
        const l3 = normalise(t3)

        if (mode === '2-way') {
          setDiff2Way(alignDiff(l1, l2))
        } else {
          setDiff3Way(alignThreeWay(l1, l2, l3))
        }
        setActiveTab('diff')
      } catch (e: any) {
        setError(e.message || 'Comparison failed.')
      } finally {
        setComputing(false)
      }
    }, 0)
  }, [input1, input2, input3, mode, lang, autoBeautify, normalise])

  const handleClear = () => {
    setInput1(''); setInput2(''); setInput3('')
    setDiff2Way([]); setDiff3Way([])
    setError(null); setActiveTab('inputs')
  }

  const stats2 = calcStats(diff2Way)

  // ── Line renderer (2-way) ─────────────────────────────────────────────────
  const renderLine2 = (line: DiffLine, pair: AlignedDiffLine, side: 'left' | 'right') => {
    const isEmpty = line.type === 'empty'
    const bg = rowBg(line.type, pair.isModified && !isEmpty)
    return (
      <div className={`flex min-h-[${ROW_HEIGHT_PX}px] px-1 py-px text-xs font-mono leading-6 ${bg}`}>
        <span className="w-9 shrink-0 select-none text-right pr-2 text-zinc-600">{line.num ?? ''}</span>
        {isEmpty ? (
          <span className="opacity-20 select-none">·</span>
        ) : pair.isModified ? (
          <InlineDiff leftText={pair.left.text} rightText={pair.right.text} side={side} enabled={wordDiff} />
        ) : (
          <span className="whitespace-pre-wrap break-all text-zinc-300">{line.text}</span>
        )}
      </div>
    )
  }

  // ── 2-way virtual render ──────────────────────────────────────────────────
  const render2WayRows = (start: number, end: number) => (
    <>
      {diff2Way.slice(start, end).map((row, rel) => {
        const idx = start + rel
        return (
          <Fragment key={idx}>
            <div>{renderLine2(row.left,  row, 'left')}</div>
            <div>{renderLine2(row.right, row, 'right')}</div>
          </Fragment>
        )
      })}
    </>
  )

  // ── 3-way virtual render ──────────────────────────────────────────────────
  const render3WayRows = (start: number, end: number) => (
    <>
      {diff3Way.slice(start, end).map((row, rel) => {
        const idx = start + rel
        const mkFakeRow = (line: DiffLine, isModified: boolean): AlignedDiffLine => ({
          left: row.col1, right: line, isModified,
        })
        return (
          <Fragment key={idx}>
            <div>{renderLine2(row.col1, mkFakeRow(row.col1, false), 'left')}</div>
            <div>{renderLine2(row.col2, mkFakeRow(row.col2, row.col2Modified), 'right')}</div>
            <div>{renderLine2(row.col3, mkFakeRow(row.col3, row.col3Modified), 'right')}</div>
          </Fragment>
        )
      })}
    </>
  )

  const canCompare = !!input1.trim() && !!input2.trim() && (mode !== '3-way' || !!input3.trim())

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-50">Code Diff &amp; Comparer</h1>
        <p className="text-sm text-zinc-400">
          Side-by-side and 3-way comparison with inline word-level highlights,
          auto-beautify, and virtual scrolling for large files.
        </p>
      </header>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">

        {/* Mode */}
        <div className="flex gap-1 rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
          {(['2-way', '3-way'] as const).map(m => (
            <button key={m} type="button"
              onClick={() => { setMode(m); setActiveTab('inputs') }}
              className={`rounded px-3 py-1.5 text-xs font-semibold transition ${
                mode === m ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {m}
            </button>
          ))}
        </div>

        {/* Language */}
        <div className="flex gap-1 rounded-lg bg-zinc-950 p-0.5 border border-zinc-800">
          {(['text', 'json', 'xml', 'sql'] as CompareLang[]).map(l => (
            <button key={l} type="button" onClick={() => setLang(l)}
              className={`rounded px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                lang === l ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Flags row */}
        <div className="flex flex-wrap items-center gap-4 ml-1">
          {/* Word diff toggle */}
          <label htmlFor="opt-worddiff" className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200">
            <input id="opt-worddiff" type="checkbox" checked={wordDiff}
              onChange={e => setWordDiff(e.target.checked)}
              className="size-3.5 rounded border-zinc-600 accent-amber-400" />
            <span>Word diff</span>
            <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-400">~amber</span>
          </label>

          {/* Auto-beautify toggle */}
          {lang !== 'text' && (
            <label htmlFor="opt-autobeautify" className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200">
              <input id="opt-autobeautify" type="checkbox" checked={autoBeautify}
                onChange={e => setAutoBeautify(e.target.checked)}
                className="size-3.5 rounded border-zinc-600 accent-emerald-400" />
              <span>Auto-beautify before compare</span>
            </label>
          )}

          {/* Ignore whitespace */}
          <label htmlFor="opt-ws" className="flex cursor-pointer items-center gap-2 text-xs text-zinc-400 hover:text-zinc-200">
            <input id="opt-ws" type="checkbox" checked={ignoreWhitespace}
              onChange={e => setIgnoreWhitespace(e.target.checked)}
              className="size-3.5 rounded border-zinc-600 accent-zinc-400" />
            Ignore leading/trailing whitespace
          </label>
        </div>

        <div className="ml-auto flex gap-2">
          {lang !== 'text' && (
            <button type="button" onClick={handleFormatInputs}
              className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition">
              Format Inputs
            </button>
          )}
          <button type="button" onClick={handleClear}
            className="rounded-lg border border-zinc-800 bg-zinc-800 px-3.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition">
            Clear
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex gap-6 border-b border-zinc-800">
        <button type="button" onClick={() => setActiveTab('inputs')}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition ${
            activeTab === 'inputs'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          Inputs
        </button>
        <button type="button"
          onClick={() => { if (canCompare) handleCompare() }}
          disabled={!canCompare || computing}
          className={`pb-3 text-sm font-semibold border-b-2 -mb-px transition disabled:opacity-40 disabled:cursor-not-allowed ${
            activeTab === 'diff'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          {computing ? 'Computing…' : 'Diff Results'}
          {activeTab === 'diff' && diff2Way.length > 0 && mode === '2-way' && (
            <span className="ml-2 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-normal text-zinc-400">
              <span className="text-emerald-400">+{stats2.added}</span>{' '}
              <span className="text-red-400">-{stats2.removed}</span>{' '}
              <span className="text-amber-400">~{stats2.modified}</span>
            </span>
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-950/10 p-4 text-sm text-red-400">{error}</div>
      )}

      {/* ── Inputs tab ── */}
      {activeTab === 'inputs' && (
        <div className="space-y-6">
          <div className={`grid gap-4 ${mode === '3-way' ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
            {[
              { id: 'comp-input1', label: mode === '3-way' ? 'Base / Original (1)' : 'Left — Original (1)', val: input1, set: setInput1 },
              { id: 'comp-input2', label: mode === '3-way' ? 'Version A (2)'       : 'Right — Modified (2)', val: input2, set: setInput2 },
              ...(mode === '3-way' ? [{ id: 'comp-input3', label: 'Version B (3)', val: input3, set: setInput3 }] : []),
            ].map(({ id, label, val, set }) => (
              <div key={id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor={id} className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</label>
                  {val && (
                    <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 ${
                      new Blob([val]).size > 512_000
                        ? 'bg-red-500/10 text-red-400'
                        : new Blob([val]).size > 128_000
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {fmtBytes(val)} · {val.split(/\r?\n/).length} lines
                    </span>
                  )}
                </div>
                <textarea id={id} value={val} onChange={e => set(e.target.value)}
                  placeholder="Paste code or text here…" spellCheck={false}
                  className="h-80 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-4 font-mono text-sm text-zinc-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-y" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-zinc-500">
              {lang !== 'text'
                ? autoBeautify
                  ? `${lang.toUpperCase()} inputs will be auto-formatted before comparing — spacing-only changes are suppressed.`
                  : `Auto-beautify is OFF — whitespace differences will appear as changes.`
                : 'Comparing plain text line-by-line.'}
            </p>
            <button type="button" onClick={handleCompare} disabled={!canCompare || computing}
              className="shrink-0 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-bold text-zinc-950 hover:bg-emerald-500 transition disabled:opacity-40 disabled:cursor-not-allowed">
              {computing ? 'Computing…' : 'Compare →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Diff Results tab ── */}
      {activeTab === 'diff' && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden">
          {mode === '2-way' ? (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-2 divide-x divide-zinc-800/80 border-b border-zinc-800/80">
                <div className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-red-500/70 inline-block" /> Original
                </div>
                <div className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500/70 inline-block" /> Modified
                </div>
              </div>
              <VirtualScroll totalRows={diff2Way.length}
                renderRows={(s, e) => (
                  <div className="grid grid-cols-2 min-w-[640px] divide-x divide-zinc-800/80">
                    {render2WayRows(s, e)}
                  </div>
                )}
              />
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 divide-x divide-zinc-800/80 border-b border-zinc-800/80">
                {['Base (1)', 'Version A (2)', 'Version B (3)'].map(h => (
                  <div key={h} className="py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500">{h}</div>
                ))}
              </div>
              <VirtualScroll totalRows={diff3Way.length}
                renderRows={(s, e) => (
                  <div className="grid grid-cols-3 min-w-[900px] divide-x divide-zinc-800/80">
                    {render3WayRows(s, e)}
                  </div>
                )}
              />
            </>
          )}
        </div>
      )}

      {/* ── Legend ── */}
      {activeTab === 'diff' && (
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-red-950/60 border-l-2 border-red-500/70" />
            Removed line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-emerald-950/60 border-l-2 border-emerald-500/70" />
            Added line
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-5 rounded-sm bg-amber-950/50 border-l-2 border-amber-400/60" />
            Modified line
          </span>
          {wordDiff && (
            <>
              <span className="flex items-center gap-1.5">
                <mark className="rounded-[2px] px-1 bg-red-500/40 text-red-100 not-italic">word</mark>
                Removed text
              </span>
              <span className="flex items-center gap-1.5">
                <mark className="rounded-[2px] px-1 bg-emerald-500/40 text-emerald-100 not-italic">word</mark>
                Added text
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
