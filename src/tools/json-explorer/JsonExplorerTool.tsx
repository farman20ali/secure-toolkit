import { useMemo, useState, useEffect, useRef } from 'react'
import {
  analyzeMetrics,
  autoRepairJson,
  buildHierarchicalGraphData,
  buildTree,
  detectSecrets,
  detectSchemaDiff,
  fixSchemaViolations,
  formatJsonPreservingComments,
  generateJsonSchema,
  generatePojoCode,
  getExpandedNodeIdsByDepth,
  parseJavaDtoToJson,
  queryJsonPath,
  searchTreeNodes,
  sortJsonKeysPreservingComments,
  stripJsonComments,
  validateAgainstSchema,
  validateJson,
  type FlowGraphData,
  type PojoLanguage,
  type PojoGeneratorOptions,
  type SchemaGuardOptions,
  type SchemaGuardResult,
  type TreeNode,
  type TreeSearchResult,
} from './json-explorer.logic'

const SAMPLE_JSON = `{
  "app": "Secure Toolkit", // Main application name
  "version": 1.2, -- current version number
  "status": "active", # system status
  "config": {
    "maxConnections": 50,
    "debug": false,
    "environment": "production",
    "supportedProtocols": ["https", "wss", "tls"],
    "cors": {
      "allowedOrigins": ["https://frontend.example.com", "https://api.example.com"],
      "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
      "allowedHeaders": ["Content-Type", "Authorization", "X-Requested-With"],
      "maxAge": 86400,
      "credentials": [{
        "username": "user1",
        "password": "password" -- test credential
      }, {
        "username": "user2",
        "password": "password"
      }]
    }
  },
  "security": {
    "mfaEnabled": true,
    "secretToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.sampleTokenPayload.signature",
    "awsAccessKey": "AKIAIOSFODNN7EXAMPLE",
    "apiEndpoint": "https://api.secure-toolkit.org/v1" // API base URL
  },
  "users": [
    {
      "id": 101,
      "name": "Alex Mercer",
      "roles": ["admin", "developer"],
      "lastLogin": "2026-09-19T20:00:00Z"
    },
    {
      "id": 102,
      "name": "Sarah Connor",
      "roles": ["auditor"],
      "lastLogin": "2026-09-18T14:30:00Z"
    }
  ]
}`

export default function JsonExplorerTool() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [rawInput, setRawInput] = useState<string>(SAMPLE_JSON)
  const [activeTab, setActiveTab] = useState<'editor' | 'tree' | 'graph' | 'dto' | 'pojo' | 'schemaguard' | 'schema' | 'security'>('editor')

  const handleJumpToLine = (lineNumber: number) => {
    if (!textareaRef.current) return
    const lines = rawInput.split('\n')
    let charIndex = 0
    for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
      charIndex += lines[i].length + 1
    }
    const lineLength = lines[lineNumber - 1] ? lines[lineNumber - 1].length : 0
    textareaRef.current.focus()
    textareaRef.current.setSelectionRange(charIndex, charIndex + lineLength)
    const lineHeight = 20
    textareaRef.current.scrollTop = Math.max(0, (lineNumber - 3) * lineHeight)
  }

  // Search & Query state
  const [searchQuery, setSearchQuery] = useState('')
  const [isRegexSearch, setIsRegexSearch] = useState(false)
  const [isCaseSensitiveSearch, setIsCaseSensitiveSearch] = useState(false)
  const [jsonPathQuery, setJsonPathQuery] = useState('')
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [repairNotice, setRepairNotice] = useState<string | null>(null)

  // Java DTO Converter State
  const [dtoInput, setDtoInput] = useState<string>(
    `UserSessionDto[sessionId=9876543210123, userId=4521, username=alex_mercer,\nstatus=ACTIVE, statusTimeStamp=2026-09-23 11:45:38,\nlastLoginTimeStamp=2026-09-23 11:45:38, rrn=2785423, channelId=WEB_PORTAL,\ntransactionType=userSessionConfluent, roles=[admin, auditor],\nprofile=UserProfileDto[firstName=Alex, lastName=Mercer, email=alex@example.com],\nscore=98.50, isVerified=true, metadata=null]`
  )
  const [dtoOutput, setDtoOutput] = useState<string>('')
  const [dtoError, setDtoError] = useState<string | null>(null)

  const handleConvertDto = (textToConvert?: string) => {
    const target = textToConvert !== undefined ? textToConvert : dtoInput
    const res = parseJavaDtoToJson(target)
    if (res.success && res.json) {
      setDtoOutput(res.json)
      setDtoError(null)
    } else {
      setDtoOutput('')
      setDtoError(res.error || 'Failed to convert Java DTO string')
    }
  }

  const handleStripComments = () => {
    const stripped = stripJsonComments(rawInput).trim()
    setRawInput(stripped)
    setRepairNotice('✂️ Successfully stripped all comments from JSON input!')
    setTimeout(() => setRepairNotice(null), 3000)
  }

  // SchemaGuard State
  const [schemaInput, setSchemaInput] = useState<string>('')
  const [guardOptions, setGuardOptions] = useState<SchemaGuardOptions>({
    strictTypes: true,
    disallowExtraProperties: false,
    disallowNulls: false,
    disallowEmptyStringsOrArrays: false,
  })

  // POJO Generator State
  const [pojoOptions, setPojoOptions] = useState<PojoGeneratorOptions>({
    language: 'java',
    rootClassName: 'AppConfig',
    accessModifier: 'private',
    useGettersSetters: true,
    useLombok: true,
    useJackson: true,
    usePydantic: true,
  })

  // Graph Zoom / Pan State
  const [graphZoom, setGraphZoom] = useState<number>(1)

  const validation = validateJson(rawInput)
  const isParsedValid = validation.isValid && validation.parsed !== undefined
  const data = isParsedValid ? validation.parsed : null

  // Auto-populate schemaInput if empty and valid data exists
  useEffect(() => {
    if (data && !schemaInput.trim()) {
      const generated = generateJsonSchema(data)
      setSchemaInput(JSON.stringify(generated, null, 2))
    }
  }, [data, schemaInput])

  // Tree computation
  const rootTree = data ? buildTree(data) : null

  // Default expansion
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    try {
      const initData = validateJson(SAMPLE_JSON).parsed
      return getExpandedNodeIdsByDepth(buildTree(initData), -1)
    } catch {
      return { $: true }
    }
  })

  const handleExpandDepth = (depthLimit: number) => {
    if (!rootTree) return
    setExpandedNodes(getExpandedNodeIdsByDepth(rootTree, depthLimit))
  }

  const handleFormat = (indent: number) => {
    if (!isParsedValid) return
    setRawInput(formatJsonPreservingComments(rawInput, indent))
  }

  const handleMinify = () => {
    if (!isParsedValid) return
    setRawInput(JSON.stringify(data))
  }

  const handleSortKeys = (reverse: boolean = false) => {
    if (!isParsedValid) return
    setRawInput(sortJsonKeysPreservingComments(rawInput, reverse, 2))
    setRepairNotice(reverse ? '🔀 Keys sorted Z to A!' : '🔀 Keys sorted A to Z!')
    setTimeout(() => setRepairNotice(null), 3000)
  }

  const handleAutoRepair = () => {
    const repaired = autoRepairJson(rawInput)
    setRawInput(repaired)
    const check = validateJson(repaired)
    if (check.isValid) {
      setRepairNotice('✅ Successfully auto-repaired JSON syntax & stripped comments!')
      setExpandedNodes(getExpandedNodeIdsByDepth(buildTree(check.parsed), -1))
    } else {
      setRepairNotice(`⚠️ Attempted auto-repair. Parse error remaining at line ${check.error?.line}, col ${check.error?.column}: ${check.error?.message}`)
    }
    setTimeout(() => setRepairNotice(null), 4000)
  }

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedItem(label)
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }))
  }

  const collapseAll = () => {
    setExpandedNodes({})
  }

  // Tree Search computation
  const searchResult: TreeSearchResult = useMemo(() => {
    return searchTreeNodes(rootTree, {
      query: searchQuery,
      isRegex: isRegexSearch,
      isCaseSensitive: isCaseSensitiveSearch,
    })
  }, [rootTree, searchQuery, isRegexSearch, isCaseSensitiveSearch])

  // Auto-expand ancestors when matches are found
  useEffect(() => {
    if (searchResult.ancestorNodeIds.size > 0) {
      setExpandedNodes((prev) => {
        const next = { ...prev }
        searchResult.ancestorNodeIds.forEach((id) => {
          next[id] = true
        })
        return next
      })
    }
  }, [searchResult])

  // Metrics, Secrets & Schemas
  const metrics = data ? analyzeMetrics(data, rawInput) : null
  const secrets = data ? detectSecrets(data) : []
  const generatedSchema = data ? generateJsonSchema(data) : null

  // SchemaGuard Evaluation
  const parsedTargetSchema = useMemo(() => {
    if (!schemaInput.trim()) return null
    try {
      return JSON.parse(stripJsonComments(schemaInput))
    } catch {
      return null
    }
  }, [schemaInput])

  const schemaGuardResult: SchemaGuardResult | null = useMemo(() => {
    if (!data || !parsedTargetSchema) return null
    return validateAgainstSchema(data, parsedTargetSchema, guardOptions)
  }, [data, parsedTargetSchema, guardOptions])

  const schemaDiffs = useMemo(() => {
    if (!data || !parsedTargetSchema) return []
    return detectSchemaDiff(data, parsedTargetSchema)
  }, [data, parsedTargetSchema])

  const handleFixSchemaViolations = () => {
    if (!data || !parsedTargetSchema) return
    const fixed = fixSchemaViolations(data, parsedTargetSchema, guardOptions)
    setRawInput(JSON.stringify(fixed, null, 2))
    setRepairNotice('🛡️ Auto-fixed schema violations and missing required fields!')
    setTimeout(() => setRepairNotice(null), 4000)
  }

  // POJO Generation
  const pojoResult = useMemo(() => {
    if (!data) return null
    return generatePojoCode(data, pojoOptions)
  }, [data, pojoOptions])

  const handleDownloadPojo = () => {
    if (!pojoResult) return
    const blob = new Blob([pojoResult.code], { type: pojoResult.mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pojoOptions.rootClassName || 'Model'}.${pojoResult.fileExtension}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Flow Graph Data Computation
  const flowGraphData: FlowGraphData | null = useMemo(() => {
    if (!data) return null
    return buildHierarchicalGraphData(data, 40)
  }, [data])

  // JSONPath Query computation
  const jsonPathResult = data && jsonPathQuery.trim() ? queryJsonPath(data, jsonPathQuery) : null

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔍</span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                JSON Explorer & POJO Generator
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Interactive node graph viewer, structured hierarchy tree, multi-language POJO/Class generator (Java, Python, TS, C#, Go, Rust), SchemaGuard validator, and inline comments (<code className="text-blue-500 font-mono">--</code> & <code className="text-blue-500 font-mono">//</code>).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-lg font-medium text-emerald-700 bg-emerald-100 border border-emerald-300 dark:text-emerald-400 dark:bg-emerald-950/60 dark:border-emerald-800/60">
              🔒 100% Client-Side Safe
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'editor', label: 'Raw Editor & Repair', icon: '✏️' },
            { id: 'tree', label: 'Interactive Tree View', icon: '🌳' },
            { id: 'graph', label: 'Visual Flowchart Graph', icon: '🕸️' },
            { id: 'dto', label: 'Java DTO Converter', icon: '☕' },
            { id: 'pojo', label: 'POJO & Class Generator', icon: '💻' },
            { id: 'schemaguard', label: 'SchemaGuard', icon: '🛡️' },
            { id: 'schema', label: 'Diagnostics & Schema', icon: '📋' },
            { id: 'security', label: `Secret Scanner (${secrets.length})`, icon: '🕵️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                : 'bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <button
          onClick={() => setRawInput(SAMPLE_JSON)}
          className="text-xs font-semibold text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700/60 transition-all"
        >
          🔄 Load Sample JSON
        </button>
      </div>

      {/* Repair Notice Alert */}
      {repairNotice && (
        <div className="p-3.5 rounded-xl border text-xs bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200">
          {repairNotice}
        </div>
      )}

      {/* Tab 1: Raw Editor & Repair */}
      {activeTab === 'editor' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleAutoRepair}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md shadow-amber-600/20 flex items-center gap-1.5"
                title="Auto-repair JSON syntax (unquoted keys, single quotes, trailing commas) preserving comments"
              >
                <span>🛠️</span> Auto-Repair Syntax
              </button>
              <button
                onClick={handleStripComments}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 dark:text-rose-300 transition-all border border-rose-200 dark:border-rose-800/60 flex items-center gap-1"
                title="Strip all comments (//, /* */, #, --) from JSON input"
              >
                <span>✂️</span> Strip Comments
              </button>
              <button
                onClick={() => {
                  const res = parseJavaDtoToJson(rawInput)
                  if (res.success && res.json) {
                    setRawInput(res.json)
                    setRepairNotice('☕ Successfully converted Java DTO string to valid JSON!')
                    setTimeout(() => setRepairNotice(null), 4000)
                  } else {
                    setRepairNotice(`⚠️ DTO Conversion Failed: ${res.error}`)
                    setTimeout(() => setRepairNotice(null), 4000)
                  }
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                title="Convert Java DTO toString representation in editor into valid JSON"
              >
                <span>☕</span> DTO → JSON
              </button>
              <button
                onClick={() => handleFormat(2)}
                disabled={!isParsedValid}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-all"
              >
                Format (2 spaces)
              </button>
              <button
                onClick={() => handleFormat(4)}
                disabled={!isParsedValid}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-all"
              >
                Format (4 spaces)
              </button>
              <button
                onClick={handleMinify}
                disabled={!isParsedValid}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-all"
              >
                Minify
              </button>
              <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 mx-1" />
              <button
                onClick={() => handleSortKeys(false)}
                disabled={!isParsedValid}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 disabled:opacity-40 transition-all border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1"
                title="Sort all object keys alphabetically (A to Z)"
              >
                <span>🔀</span> Sort Keys (A-Z)
              </button>
              <button
                onClick={() => handleSortKeys(true)}
                disabled={!isParsedValid}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-300 disabled:opacity-40 transition-all border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1"
                title="Sort all object keys reverse alphabetically (Z to A)"
              >
                <span>🔀</span> Sort Keys (Z-A)
              </button>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 font-mono">
              <span>Lines: {rawInput.split('\n').length}</span>
              <span>Chars: {rawInput.length}</span>
              <button
                onClick={() => handleCopy(rawInput, 'raw')}
                className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
              >
                {copiedItem === 'raw' ? '✓ Copied' : 'Copy Raw'}
              </button>
            </div>
          </div>

          {/* Validation Banner */}
          {!validation.isValid ? (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 rounded-xl text-xs flex flex-wrap items-center justify-between gap-2">
              <div>
                <strong>❌ JSON Syntax Error at Line {validation.error?.line}, Column {validation.error?.column}:</strong>{' '}
                {validation.error?.message}
              </div>
              <div className="flex items-center gap-3">
                {validation.error?.line !== undefined && (
                  <button
                    onClick={() => handleJumpToLine(validation.error!.line)}
                    className="px-2.5 py-1 bg-rose-200 dark:bg-rose-900/60 hover:bg-rose-300 dark:hover:bg-rose-800 text-rose-900 dark:text-rose-100 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shadow-xs"
                    title={`Highlight and focus line ${validation.error.line} in the editor`}
                  >
                    <span>📍</span> Jump to Line {validation.error.line}
                  </button>
                )}
                <button
                  onClick={handleAutoRepair}
                  className="underline font-semibold hover:text-slate-900 dark:hover:text-white"
                >
                  Try 1-Click Auto Repair
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300 rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>✅</span> Valid JSON Syntax
                {validation.hadComments && (
                  <span className="ml-2 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
                    💬 Inline Comments Accepted (-- or // or #)
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Code Textarea with Line Number Gutter */}
          <div className="relative flex border border-slate-300 dark:border-slate-800 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-950 focus-within:border-blue-500 transition-colors">
            {/* Line Number Gutter */}
            <div className="select-none py-4 px-3 bg-slate-200/60 dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 font-mono text-xs text-right border-r border-slate-300 dark:border-slate-800 space-y-0.5 min-w-[44px]">
              {rawInput.split('\n').map((_, idx) => {
                const lineNum = idx + 1
                const isErrorLine = !validation.isValid && validation.error?.line === lineNum
                return (
                  <div
                    key={lineNum}
                    onClick={() => handleJumpToLine(lineNum)}
                    className={`cursor-pointer hover:text-blue-500 transition-colors leading-relaxed ${
                      isErrorLine ? 'bg-rose-500 text-white font-bold px-1 rounded-xs shadow-xs' : ''
                    }`}
                    title={`Click to jump to line ${lineNum}`}
                  >
                    {lineNum}
                  </div>
                )
              })}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Paste raw JSON here (comments like // or -- are supported)..."
              rows={18}
              className="w-full flex-1 p-4 bg-transparent font-mono text-xs text-slate-900 dark:text-slate-200 focus:outline-none leading-relaxed resize-y"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Interactive Tree View */}
      {activeTab === 'tree' && (
        <div className="space-y-4">
          {!isParsedValid ? (
            <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-600 dark:text-slate-400 text-sm">
              Please fix JSON syntax errors in the Raw Editor tab to view the interactive tree hierarchy.
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative flex items-center flex-1 min-w-[260px] max-w-md">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={isRegexSearch ? "Regex search (e.g. ^id|user_\\d+)..." : "Search key or value..."}
                      className={`w-full bg-slate-50 dark:bg-slate-950 border ${searchResult.error
                        ? 'border-rose-500 focus:border-rose-500'
                        : 'border-slate-300 dark:border-slate-800 focus:border-blue-500'
                        } rounded-xl pl-3 pr-20 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none font-mono`}
                    />

                    <div className="absolute right-1.5 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsCaseSensitiveSearch((v) => !v)}
                        title="Match Case (Case Sensitive)"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${isCaseSensitiveSearch
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        Aa
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsRegexSearch((v) => !v)}
                        title="Use Regular Expression"
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${isRegexSearch
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                      >
                        .*
                      </button>
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={jsonPathQuery}
                    onChange={(e) => setJsonPathQuery(e.target.value)}
                    placeholder="JSONPath e.g. $.users[0].name"
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 w-full sm:w-60 font-mono"
                  />

                  {searchQuery.trim() && (
                    <div className="flex items-center">
                      {searchResult.error ? (
                        <span className="text-[11px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-lg">
                          ⚠️ {searchResult.error}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                          🎯 {searchResult.totalMatches} {searchResult.totalMatches === 1 ? 'match' : 'matches'}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200 dark:border-slate-700/60">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 px-1.5">Depth:</span>
                  <button
                    onClick={() => handleExpandDepth(-1)}
                    className="px-2 py-1 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 font-semibold shadow-xs transition-all"
                  >
                    All
                  </button>
                  <button
                    onClick={() => handleExpandDepth(1)}
                    className="px-2 py-1 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium shadow-xs transition-all"
                  >
                    L1
                  </button>
                  <button
                    onClick={() => handleExpandDepth(2)}
                    className="px-2 py-1 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium shadow-xs transition-all"
                  >
                    L2
                  </button>
                  <button
                    onClick={() => handleExpandDepth(3)}
                    className="px-2 py-1 rounded-lg text-xs bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium shadow-xs transition-all"
                  >
                    L3
                  </button>
                  <button
                    onClick={collapseAll}
                    className="px-2 py-1 rounded-lg text-xs bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-medium transition-all"
                  >
                    Collapse
                  </button>
                </div>
              </div>

              {jsonPathQuery.trim() && (
                <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1">
                  <div className="text-slate-700 dark:text-slate-400 font-semibold flex items-center justify-between">
                    <span>JSONPath Query Result:</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(jsonPathResult, null, 2), 'path-res')}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {copiedItem === 'path-res' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="font-mono text-emerald-700 dark:text-emerald-400 overflow-x-auto max-h-40">
                    {jsonPathResult !== undefined
                      ? JSON.stringify(jsonPathResult, null, 2)
                      : 'undefined'}
                  </pre>
                </div>
              )}

              {/* Tree Renderer */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 font-mono text-xs overflow-x-auto max-h-[600px] text-slate-200 shadow-inner">
                {rootTree && (
                  <TreeNodeRenderer
                    node={rootTree}
                    expandedNodes={expandedNodes}
                    onToggle={toggleExpand}
                    searchQuery={searchQuery}
                    searchResult={searchResult}
                    onCopyPath={(p) => handleCopy(p, p)}
                    copiedItem={copiedItem}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Visual Flowchart Graph (JSON Crack Style Connected Nodes) */}
      {activeTab === 'graph' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🕸️</span> Visual Node Flowchart Network (JSON Crack Style)
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-base mt-1">
                Connected hierarchical flowchart showing parent object blocks linked directly to child object and array blocks with SVG connecting arrows.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 px-2">Zoom: {Math.round(graphZoom * 100)}%</span>
              <button
                onClick={() => setGraphZoom((z) => Math.max(0.5, z - 0.1))}
                className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold shadow-xs"
              >
                −
              </button>
              <button
                onClick={() => setGraphZoom(1)}
                className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold shadow-xs"
              >
                Reset
              </button>
              <button
                onClick={() => setGraphZoom((z) => Math.min(2.0, z + 0.1))}
                className="px-2.5 py-1 bg-white dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-bold shadow-xs"
              >
                +
              </button>
            </div>
          </div>

          {!isParsedValid || !flowGraphData ? (
            <div className="p-8 text-center text-slate-600 dark:text-slate-400 text-sm bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
              Please fix JSON syntax errors to render the node flowchart diagram.
            </div>
          ) : (
            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl overflow-auto min-h-[550px] shadow-inner p-6">
              <div
                style={{
                  transform: `scale(${graphZoom})`,
                  transformOrigin: 'top left',
                  width: `${flowGraphData.canvasWidth}px`,
                  height: `${flowGraphData.canvasHeight}px`,
                }}
                className="relative transition-transform duration-200 ease-out"
              >
                {/* SVG Connecting Curves & Arrowhead Markers */}
                <svg
                  className="absolute inset-0 pointer-events-none w-full h-full"
                  style={{ width: flowGraphData.canvasWidth, height: flowGraphData.canvasHeight }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="6"
                      markerHeight="6"
                      orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
                    </marker>
                  </defs>

                  {flowGraphData.edges.map((edge) => {
                    const deltaX = Math.abs(edge.targetX - edge.sourceX) * 0.5
                    const pathData = `M ${edge.sourceX} ${edge.sourceY} C ${edge.sourceX + deltaX} ${edge.sourceY}, ${edge.targetX - deltaX} ${edge.targetY}, ${edge.targetX} ${edge.targetY}`

                    return (
                      <g key={edge.id}>
                        <path
                          d={pathData}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                          markerEnd="url(#arrowhead)"
                          className="opacity-75 hover:opacity-100 transition-opacity"
                        />
                        {/* Start connector dot */}
                        <circle cx={edge.sourceX} cy={edge.sourceY} r="4" fill="#3b82f6" />
                        {/* Target connector dot */}
                        <circle cx={edge.targetX} cy={edge.targetY} r="4" fill="#10b981" />
                      </g>
                    )
                  })}
                </svg>

                {/* Structured Node Cards */}
                {flowGraphData.nodes.map((node) => (
                  <div
                    key={node.id}
                    style={{
                      left: `${node.x}px`,
                      top: `${node.y}px`,
                      width: `${node.width}px`,
                    }}
                    className="absolute bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden font-mono text-xs z-10 hover:border-blue-500 transition-colors"
                  >
                    {/* Node Card Header */}
                    <div className="bg-slate-800/90 border-b border-slate-700 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{node.type === 'object' ? '📦' : '📚'}</span>
                        <span className="font-bold text-white text-xs truncate max-w-[140px]" title={node.title}>
                          {node.title}
                        </span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-sans uppercase font-bold ${node.type === 'object'
                        ? 'bg-blue-900/80 text-blue-300 border border-blue-700'
                        : 'bg-purple-900/80 text-purple-300 border border-purple-700'
                        }`}>
                        {node.type} ({node.fields.length})
                      </span>
                    </div>

                    {/* Node Properties Table */}
                    <div className="p-2 space-y-1 bg-slate-950/60">
                      {node.fields.map((field, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1 px-2 rounded hover:bg-slate-800/50 text-[11px]"
                        >
                          <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                            <span className="text-slate-400 font-semibold">{field.key}:</span>
                            {field.childNodeId ? (
                              <span className="text-blue-400 font-bold underline decoration-blue-500">
                                {field.type}
                              </span>
                            ) : (
                              <span className="text-emerald-400 truncate">
                                {field.type === 'string' ? `"${field.value}"` : String(field.value)}
                              </span>
                            )}
                          </div>

                          <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-sans font-bold ${field.type === 'object' || field.type === 'array'
                            ? 'bg-blue-950 text-blue-400 border border-blue-800'
                            : field.type === 'string'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                              : 'bg-amber-950 text-amber-400 border border-amber-800'
                            }`}>
                            {field.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Java DTO Converter */}
      {activeTab === 'dto' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>☕</span> Java DTO String → JSON Converter
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mt-1">
                  Convert Java DTO <code className="text-blue-500 font-mono">toString()</code> strings (Record, Lombok <code className="text-blue-500 font-mono">@ToString</code>, Apache Commons, IDE generated) into valid JSON. Tolerates surrounding log noise, outer <code className="text-blue-500 font-mono">{`{...}`}</code> wrappers, nested DTOs, and arrays.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const sample = `UserSessionDto[sessionId=9876543210123, userId=4521, username=alex_mercer,\nstatus=ACTIVE, statusTimeStamp=2026-09-23 11:45:38,\nlastLoginTimeStamp=2026-09-23 11:45:38, rrn=2785423, channelId=WEB_PORTAL,\ntransactionType=userSessionConfluent, roles=[admin, auditor],\nprofile=UserProfileDto[firstName=Alex, lastName=Mercer, email=alex@example.com],\nscore=98.50, isVerified=true, metadata=null]`
                    setDtoInput(sample)
                    handleConvertDto(sample)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
                >
                  📋 Preset 1: Standard DTO
                </button>
                <button
                  onClick={() => {
                    const sample = `UserDto[id=101, name="Alex Mercer", address=AddressDto[city="San Francisco", country="USA"], roles=[admin, auditor], active=true]`
                    setDtoInput(sample)
                    handleConvertDto(sample)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
                >
                  📋 Preset 2: Nested DTO
                </button>
                <button
                  onClick={() => {
                    const sample = `2026-09-23 11:45:38 [INFO] Kafka Payload Received: UserSessionDto[sessionId=9876543210123, status=ACTIVE] - Processing finished.`
                    setDtoInput(sample)
                    handleConvertDto(sample)
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all border border-slate-200 dark:border-slate-700"
                >
                  📋 Preset 3: DTO inside Log Text
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Area */}
              <div className="space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Java DTO / toString() Input
                  </label>
                  <button
                    onClick={() => {
                      setDtoInput('')
                      setDtoOutput('')
                      setDtoError(null)
                    }}
                    className="text-xs text-rose-500 hover:underline font-medium"
                  >
                    Clear Input
                  </button>
                </div>
                <textarea
                  value={dtoInput}
                  onChange={(e) => setDtoInput(e.target.value)}
                  placeholder="Paste Java DTO toString() representation here..."
                  rows={14}
                  className="w-full flex-1 font-mono text-xs sm:text-sm p-4 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-y text-slate-900 dark:text-slate-100"
                />
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleConvertDto()}
                    className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/25 transition-all flex items-center gap-2"
                  >
                    <span>⚡</span> Convert DTO → JSON
                  </button>
                  <button
                    onClick={() => {
                      if (dtoOutput) {
                        setRawInput(dtoOutput)
                        setActiveTab('editor')
                        setRepairNotice('✅ Loaded converted DTO JSON into Raw Editor!')
                        setTimeout(() => setRepairNotice(null), 3000)
                      }
                    }}
                    disabled={!dtoOutput}
                    className="px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-40 text-slate-800 dark:text-slate-200 transition-all border border-slate-300 dark:border-slate-700"
                  >
                    🚀 Open in Raw Explorer
                  </button>
                </div>
              </div>

              {/* Output Area */}
              <div className="space-y-3 flex flex-col">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Formatted JSON Output
                  </label>
                  {dtoOutput && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleCopy(dtoOutput, 'dto')}
                        className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
                      >
                        {copiedItem === 'dto' ? '✓ Copied JSON' : '📋 Copy JSON'}
                      </button>
                      <button
                        onClick={() => setDtoOutput('')}
                        className="text-xs text-rose-500 hover:underline font-medium"
                      >
                        Clear Output
                      </button>
                    </div>
                  )}
                </div>

                {dtoError ? (
                  <div className="p-4 rounded-xl border bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 text-xs space-y-1 font-mono">
                    <strong>❌ Conversion Error:</strong>
                    <p>{dtoError}</p>
                  </div>
                ) : dtoOutput ? (
                  <pre className="w-full flex-1 font-mono text-xs sm:text-sm p-4 bg-slate-900 text-slate-100 border border-slate-800 rounded-xl overflow-x-auto overflow-y-auto max-h-[420px]">
                    <code>{dtoOutput}</code>
                  </pre>
                ) : (
                  <div className="w-full flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 min-h-[300px]">
                    <span className="text-4xl mb-2">☕</span>
                    <p className="text-xs font-medium">Paste a Java DTO string and click "Convert DTO → JSON" to see the output.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: POJO & Class Generator Tool */}
      {activeTab === 'pojo' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💻</span> POJO & Class Model Generator
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-base mt-1">
                  Convert JSON structure into production-ready classes/models with access modifiers (<code className="text-blue-500 font-mono">private</code>/<code className="text-blue-500 font-mono">public</code>), getters/setters, Lombok, Jackson, Pydantic, Zod, and typed structs.
                </p>
              </div>

              {pojoResult && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(pojoResult.code, 'pojo')}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20"
                  >
                    {copiedItem === 'pojo' ? '✓ Copied' : '📋 Copy Code'}
                  </button>
                  <button
                    onClick={handleDownloadPojo}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <span>💾</span> Download .{pojoResult.fileExtension}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Options Panel */}
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>⚙️</span> Target Language & Config
                </h3>

                {/* Target Language */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Target Language / Framework:</label>
                  <select
                    value={pojoOptions.language}
                    onChange={(e) => setPojoOptions((prev) => ({ ...prev, language: e.target.value as PojoLanguage }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-semibold"
                  >
                    <option value="java">Java (POJO / Lombok / Jackson)</option>
                    <option value="python">Python (Pydantic / Dataclasses)</option>
                    <option value="typescript">TypeScript (Interfaces)</option>
                    <option value="zod">TypeScript (Zod Validation Schemas)</option>
                    <option value="csharp">C# (.NET / System.Text.Json)</option>
                    <option value="go">Go (Structs with json tags)</option>
                    <option value="rust">Rust (Serde Structs)</option>
                  </select>
                </div>

                {/* Root Class Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Root Class / Struct Name:</label>
                  <input
                    type="text"
                    value={pojoOptions.rootClassName || ''}
                    onChange={(e) => setPojoOptions((prev) => ({ ...prev, rootClassName: e.target.value }))}
                    placeholder="e.g. AppConfig or UserModel"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                {/* Java Specific Options */}
                {pojoOptions.language === 'java' && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-slate-700 dark:text-slate-300">Access Modifiers:</label>
                      <div className="flex gap-2">
                        {(['private', 'public', 'protected'] as const).map((mod) => (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => setPojoOptions((prev) => ({ ...prev, accessModifier: mod }))}
                            className={`flex-1 py-1.5 rounded-lg font-mono text-xs font-bold transition-all ${pojoOptions.accessModifier === mod
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                          >
                            {mod}
                          </button>
                        ))}
                      </div>
                    </div>

                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pojoOptions.useLombok}
                        onChange={(e) => setPojoOptions((prev) => ({ ...prev, useLombok: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Use Lombok Annotations (<code className="text-blue-500">@Data</code>, <code className="text-blue-500">@NoArgsConstructor</code>)</span>
                    </label>

                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pojoOptions.useJackson}
                        onChange={(e) => setPojoOptions((prev) => ({ ...prev, useJackson: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Use Jackson Annotations (<code className="text-blue-500">@JsonProperty</code>)</span>
                    </label>
                  </div>
                )}

                {/* Python Specific Options */}
                {pojoOptions.language === 'python' && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs">
                    <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pojoOptions.usePydantic}
                        onChange={(e) => setPojoOptions((prev) => ({ ...prev, usePydantic: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Use Pydantic Models (<code className="text-blue-500">BaseModel</code>)</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Generated Code Display */}
            <div className="lg:col-span-2 space-y-4">
              {!data ? (
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-600 dark:text-slate-400 text-sm">
                  Please fix JSON syntax errors in the Raw Editor tab to generate POJO model classes.
                </div>
              ) : pojoResult ? (
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-2">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-mono">
                    <span className="text-slate-400">
                      Generated Code ({pojoOptions.language.toUpperCase()})
                    </span>
                    <span className="text-emerald-400 font-semibold">
                      {pojoOptions.rootClassName || 'Model'}.{pojoResult.fileExtension}
                    </span>
                  </div>

                  <pre className="font-mono text-xs text-emerald-400 leading-relaxed overflow-x-auto max-h-[500px] p-2">
                    {pojoResult.code}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: SchemaGuard */}
      {activeTab === 'schemaguard' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>🛡️</span> SchemaGuard Contract & Structure Validator
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-base mt-1">
                  Validate JSON payload against JSON Schema contracts, enforce strict guard policies, highlight missing required properties or unexpected keys, and auto-fix violations.
                </p>
              </div>

              {data && parsedTargetSchema && schemaGuardResult && (
                <div className="flex items-center gap-3">
                  {schemaGuardResult.isValid ? (
                    <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                      ✅ SchemaGuard Passed
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl font-bold text-xs bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800">
                      ⚠️ {schemaGuardResult.summary.errorCount} Violations Found
                    </span>
                  )}
                  <button
                    onClick={handleFixSchemaViolations}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                  >
                    <span>🛠️</span> Auto-Fix Violations
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span>📋</span> Target JSON Schema
                  </h3>
                  <button
                    onClick={() => {
                      if (data) {
                        setSchemaInput(JSON.stringify(generateJsonSchema(data), null, 2))
                      }
                    }}
                    className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Infer from Active JSON
                  </button>
                </div>

                <textarea
                  value={schemaInput}
                  onChange={(e) => setSchemaInput(e.target.value)}
                  placeholder="Paste JSON Schema here..."
                  className="w-full h-64 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl p-3 font-mono text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed resize-y"
                />

                {!parsedTargetSchema && schemaInput.trim() && (
                  <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                    ⚠️ Invalid Schema JSON syntax
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>⚙️</span> Guard Policies & Strictness
                </h3>

                <div className="space-y-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardOptions.strictTypes}
                      onChange={(e) => setGuardOptions((prev) => ({ ...prev, strictTypes: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Strict Type Compliance</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardOptions.disallowExtraProperties}
                      onChange={(e) => setGuardOptions((prev) => ({ ...prev, disallowExtraProperties: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Disallow Extra Properties (<code className="text-slate-500 font-mono">additionalProperties: false</code>)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardOptions.disallowNulls}
                      onChange={(e) => setGuardOptions((prev) => ({ ...prev, disallowNulls: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Prohibit <code className="text-slate-500 font-mono">null</code> values</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guardOptions.disallowEmptyStringsOrArrays}
                      onChange={(e) => setGuardOptions((prev) => ({ ...prev, disallowEmptyStringsOrArrays: e.target.checked }))}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Prohibit empty strings (<code className="text-slate-500 font-mono">""</code>) or empty arrays (<code className="text-slate-500 font-mono">[]</code>)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              {!data ? (
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-600 dark:text-slate-400 text-sm">
                  Please fix JSON syntax errors in the Raw Editor tab to perform SchemaGuard validation.
                </div>
              ) : !parsedTargetSchema ? (
                <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-center text-slate-600 dark:text-slate-400 text-sm">
                  Provide a valid target JSON Schema on the left to validate JSON contract compliance.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                      <span>Validation Report & Structural Diagnostics</span>
                      <span className="text-xs font-mono text-slate-500 font-normal">
                        Checked {schemaGuardResult?.summary.totalChecked} nodes
                      </span>
                    </h3>

                    {schemaGuardResult?.violations.length === 0 ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-300 rounded-xl text-xs space-y-1">
                        <div className="font-bold flex items-center gap-1.5">
                          <span>🎉</span> Zero Contract Violations
                        </div>
                        <div className="text-slate-600 dark:text-slate-400">
                          Active JSON document completely conforms to the specified target JSON Schema rules.
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {schemaGuardResult?.violations.map((violation: any, idx: number) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-xl border text-xs space-y-1 font-mono ${violation.severity === 'error'
                              ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300'
                              : 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200'
                              }`}
                          >
                            <div className="flex items-center justify-between font-sans">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${violation.severity === 'error'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-600 text-white'
                                }`}>
                                {violation.keyword}
                              </span>
                              <span className="text-[11px] font-mono text-slate-500">{violation.path}</span>
                            </div>
                            <div className="font-semibold">{violation.message}</div>
                            {(violation.expected || violation.actual) && (
                              <div className="text-[11px] text-slate-600 dark:text-slate-400 flex gap-4">
                                {violation.expected && <span>Expected: <code className="text-emerald-600 dark:text-emerald-400">{violation.expected}</code></span>}
                                {violation.actual && <span>Actual: <code className="text-rose-600 dark:text-rose-400">{violation.actual}</code></span>}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {schemaDiffs.length > 0 && (
                    <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>🔍</span> Schema Structural Drift ({schemaDiffs.length} issues)
                      </h3>

                      <div className="space-y-2">
                        {schemaDiffs.map((diff, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1 font-mono"
                          >
                            <div className="flex items-center justify-between font-sans">
                              <span className="font-bold text-slate-800 dark:text-slate-200">
                                Path: {diff.path}
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {diff.type}
                              </span>
                            </div>
                            <div className="text-slate-600 dark:text-slate-400">{diff.message}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Diagnostics & Schema */}
      {activeTab === 'schema' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>📊</span> JSON Structure Metrics
            </h2>

            {metrics && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Total Object Keys:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{metrics.totalKeys}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Max Nesting Depth:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{metrics.maxDepth} levels</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Total Node Count:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{metrics.nodeCount}</span>
                </div>
                <div className="flex justify-between p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Payload Size:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">{(metrics.sizeBytes / 1024).toFixed(2)} KB</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <span className="text-slate-700 dark:text-slate-400 font-semibold block">Data Type Distribution:</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    {Object.entries(metrics.typeCounts).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-slate-700 dark:text-slate-300">
                        <span className="capitalize">{type}:</span>
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {metrics.duplicateKeys.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/40 dark:text-amber-300 rounded-xl text-xs">
                    ⚠️ Duplicate Key Names Found: {metrics.duplicateKeys.join(', ')}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>📋</span> Inferred JSON Schema (Draft-07)
              </h2>
              {generatedSchema && (
                <button
                  onClick={() => handleCopy(JSON.stringify(generatedSchema, null, 2), 'schema')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
                >
                  {copiedItem === 'schema' ? '✓ Copied' : '📋 Copy Schema'}
                </button>
              )}
            </div>

            <pre className="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs font-mono text-emerald-400 overflow-x-auto max-h-[420px]">
              {generatedSchema
                ? JSON.stringify(generatedSchema, null, 2)
                : '// Load valid JSON to generate schema'}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 7: Secret Scanner */}
      {activeTab === 'security' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span>🕵️</span> Embedded Secret & Security Scanner
              </h2>
              <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
                Scans all nested JSON string values for leaked API keys, tokens, AWS credentials, JWTs, and sensitive key names.
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-xl text-xs font-bold ${secrets.length > 0
                ? 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                : 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                }`}
            >
              {secrets.length} Findings Detected
            </span>
          </div>

          {secrets.length === 0 ? (
            <div className="p-8 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-800/30 dark:text-emerald-300 rounded-2xl text-center space-y-2">
              <div className="text-3xl">🛡️</div>
              <div className="font-semibold text-sm">No Sensitive Credentials Detected</div>
              <div className="text-slate-600 dark:text-slate-400 text-xs">
                No high-entropy tokens, AWS keys, JWTs, or raw secrets were discovered inside string values.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {secrets.map((finding, idx) => (
                <div
                  key={idx}
                  className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                      <span>⚠️</span> {finding.type}
                    </span>
                    <span className="font-mono text-slate-500 text-[11px]">{finding.path}</span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 font-mono">
                    Key: <code className="text-blue-600 dark:text-blue-400 font-bold">{finding.key}</code> | Sample Value:{' '}
                    <code className="text-amber-700 dark:text-amber-400 font-bold">{finding.valueSample}</code>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TreeNodeRenderer({
  node,
  expandedNodes,
  onToggle,
  searchQuery,
  searchResult,
  onCopyPath,
  copiedItem,
}: {
  node: TreeNode
  expandedNodes: Record<string, boolean>
  onToggle: (id: string) => void
  searchQuery: string
  searchResult?: TreeSearchResult
  onCopyPath: (path: string) => void
  copiedItem: string | null
}) {
  const isContainer = node.type === 'object' || node.type === 'array'

  const isMatched = searchResult?.matchingNodeIds.has(node.id) ?? false
  const hasMatchedDescendant = searchResult?.ancestorNodeIds.has(node.id) ?? false
  const isChildOfMatched = searchResult?.descendantNodeIds.has(node.id) ?? false

  const isSearching = !!(searchQuery.trim() && searchResult && !searchResult.error)
  const isExpanded = isSearching
    ? (hasMatchedDescendant || isMatched ? (expandedNodes[node.id] !== false) : !!expandedNodes[node.id])
    : !!expandedNodes[node.id]

  if (isSearching) {
    if (!isMatched && !hasMatchedDescendant && !isChildOfMatched) {
      return null
    }
  }

  return (
    <div className="relative pl-4 my-1 border-l-2 border-slate-700/60 hover:border-blue-500/80 transition-colors">
      <div
        className={`flex items-center gap-2 group p-1.5 rounded-lg transition-all ${isMatched
          ? 'bg-amber-950/80 border border-amber-500 text-amber-200 font-bold'
          : 'hover:bg-slate-800/80'
          }`}
      >
        {isContainer ? (
          <button
            onClick={() => onToggle(node.id)}
            className="w-5 h-5 flex items-center justify-center text-blue-400 hover:text-white font-bold bg-slate-800 rounded transition-colors"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-5 text-center text-slate-500">📄</span>
        )}

        <span className="text-slate-400 text-[11px] font-sans">
          {isContainer ? (node.type === 'object' ? '📁' : '📚') : ''}
        </span>

        <span className={`font-bold font-mono ${isMatched ? 'text-amber-300 underline' : 'text-blue-400'}`}>
          {node.key}:
        </span>

        {/* Type Badge & Item Counter */}
        <span
          className={`text-[10px] px-2 py-0.5 rounded font-sans uppercase font-bold ${node.type === 'object'
            ? 'bg-blue-950 text-blue-300 border border-blue-800'
            : node.type === 'array'
              ? 'bg-purple-950 text-purple-300 border border-purple-800'
              : node.type === 'string'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : node.type === 'number'
                  ? 'bg-amber-950 text-amber-300 border border-amber-800'
                  : 'bg-rose-950 text-rose-300 border border-rose-800'
            }`}
        >
          {node.type} {node.childCount !== undefined ? `{${node.childCount} items}` : ''}
        </span>

        {/* Leaf Value */}
        {!isContainer && (
          <span className={`truncate max-w-xs sm:max-w-md font-mono ${node.type === 'string'
            ? 'text-emerald-400'
            : node.type === 'number'
              ? 'text-amber-400 font-bold'
              : node.type === 'boolean'
                ? 'text-teal-300 font-bold'
                : 'text-rose-400'
            }`}>
            {node.type === 'string' ? `"${node.value}"` : String(node.value)}
          </span>
        )}

        {isMatched && (
          <span className="text-[10px] px-1.5 py-0.2 rounded font-sans font-bold bg-amber-500 text-slate-950">
            MATCH
          </span>
        )}

        {/* Copy Path Button */}
        <button
          onClick={() => onCopyPath(node.path)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-400 hover:text-white ml-auto bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-sans"
        >
          {copiedItem === node.path ? '✓ Copied' : 'Copy Path'}
        </button>
      </div>

      {/* Children */}
      {isContainer && isExpanded && node.children && (
        <div className="ml-2 space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeRenderer
              key={child.id}
              node={child}
              expandedNodes={expandedNodes}
              onToggle={onToggle}
              searchQuery={searchQuery}
              searchResult={searchResult}
              onCopyPath={onCopyPath}
              copiedItem={copiedItem}
            />
          ))}
        </div>
      )}
    </div>
  )
}
