import { useMemo, useState, useEffect } from 'react'
import {
  analyzeMetrics,
  autoRepairJson,
  buildGraphData,
  buildTree,
  detectSecrets,
  generateJsonSchema,
  getExpandedNodeIdsByDepth,
  queryJsonPath,
  searchTreeNodes,
  type TreeNode,
  type TreeSearchResult,
  validateJson,
} from './json-explorer.logic'

const SAMPLE_JSON = `{
  "app": "Secure Toolkit",
  "version": 1.2,
  "status": "active",
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
        "password": "password"
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
    "apiEndpoint": "https://api.secure-toolkit.org/v1"
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
  const [rawInput, setRawInput] = useState<string>(SAMPLE_JSON)
  const [activeTab, setActiveTab] = useState<'editor' | 'tree' | 'graph' | 'schema' | 'security'>('editor')

  // Search & Query state
  const [searchQuery, setSearchQuery] = useState('')
  const [isRegexSearch, setIsRegexSearch] = useState(false)
  const [isCaseSensitiveSearch, setIsCaseSensitiveSearch] = useState(false)
  const [jsonPathQuery, setJsonPathQuery] = useState('')
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [repairNotice, setRepairNotice] = useState<string | null>(null)

  const validation = validateJson(rawInput)
  const isParsedValid = validation.isValid && validation.parsed !== undefined
  const data = isParsedValid ? validation.parsed : null

  // Tree computation
  const rootTree = data ? buildTree(data) : null

  // Default expansion: all nodes expanded
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>(() => {
    try {
      const initData = validateJson(SAMPLE_JSON).parsed
      return getExpandedNodeIdsByDepth(buildTree(initData), -1)
    } catch {
      return { $: true }
    }
  })

  // Expand by depth helper
  const handleExpandDepth = (depthLimit: number) => {
    if (!rootTree) return
    setExpandedNodes(getExpandedNodeIdsByDepth(rootTree, depthLimit))
  }

  const handleFormat = (indent: number) => {
    if (!isParsedValid) return
    setRawInput(JSON.stringify(data, null, indent))
  }

  const handleMinify = () => {
    if (!isParsedValid) return
    setRawInput(JSON.stringify(data))
  }

  const handleAutoRepair = () => {
    const repaired = autoRepairJson(rawInput)
    setRawInput(repaired)
    const check = validateJson(repaired)
    if (check.isValid) {
      setRepairNotice('✅ Successfully auto-repaired JSON syntax!')
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

  // Tree Search computation (Regex / Text)
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

  // Metrics computation
  const metrics = data ? analyzeMetrics(data, rawInput) : null

  // Secrets computation
  const secrets = data ? detectSecrets(data) : []

  // Schema computation
  const generatedSchema = data ? generateJsonSchema(data) : null

  // JSONPath Query computation
  const jsonPathResult = data && jsonPathQuery.trim() ? queryJsonPath(data, jsonPathQuery) : null

  // Graph Data computation
  const graphData = data ? buildGraphData(data) : { nodes: [], edges: [] }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔍</span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                JSON Explorer & Diagnostic Lab
              </h1>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Validate, auto-repair, traverse tree hierarchy, view object graphs, query JSONPath, generate schemas, and scan for nested leaked secrets.
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
            { id: 'graph', label: 'Visual Object Graph', icon: '🕸️' },
            { id: 'schema', label: 'Key Diagnostics & Schema', icon: '📋' },
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
              >
                <span>🛠️</span> Auto-Repair Syntax
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
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800/60 dark:text-rose-300 rounded-xl text-xs flex items-center justify-between">
              <div>
                <strong>❌ JSON Syntax Error at Line {validation.error?.line}, Column {validation.error?.column}:</strong>{' '}
                {validation.error?.message}
              </div>
              <button
                onClick={handleAutoRepair}
                className="underline font-semibold hover:text-slate-900 dark:hover:text-white"
              >
                Try 1-Click Auto Repair
              </button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
              <span>✅</span> Valid JSON Syntax
            </div>
          )}

          {/* Code Textarea */}
          <div className="relative">
            <textarea
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Paste raw JSON here..."
              className="w-full h-[450px] bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 leading-relaxed resize-y"
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
              {/* Controls & Search */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {/* Search input with Regex & Case toggles */}
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

                    {/* Regex Mode & Case Sensitive toggles */}
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

                  {/* JSONPath Query */}
                  <input
                    type="text"
                    value={jsonPathQuery}
                    onChange={(e) => setJsonPathQuery(e.target.value)}
                    placeholder="JSONPath e.g. $.users[0].name"
                    className="bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 w-full sm:w-60 font-mono"
                  />

                  {/* Search Match Count or Error badge */}
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

                {/* Depth controls */}
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

              {/* JSONPath Query Result Box */}
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
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[550px] space-y-1">
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

      {/* Tab 3: Visual Object Graph */}
      {activeTab === 'graph' && (
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span>🕸️</span> Visual Object Hierarchy Graph
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-xs mt-1">
              Interactive node topology showing object nesting structure and relationships (capped at 50 nodes).
            </p>
          </div>

          {!isParsedValid ? (
            <div className="p-6 text-center text-slate-600 dark:text-slate-400 text-sm">
              Please fix JSON syntax errors to display the object graph.
            </div>
          ) : (
            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 min-h-[400px] overflow-auto">
              <div className="flex flex-wrap gap-3 justify-center items-center py-6">
                {graphData.nodes.map((node) => (
                  <div
                    key={node.id}
                    className={`p-3 rounded-xl border text-xs font-mono shadow-md transition-all hover:scale-105 ${node.type === 'object'
                      ? 'bg-blue-50 border-blue-300 text-blue-900 dark:bg-blue-950/60 dark:border-blue-800 dark:text-blue-300'
                      : node.type === 'array'
                        ? 'bg-purple-50 border-purple-300 text-purple-900 dark:bg-purple-950/60 dark:border-purple-800 dark:text-purple-300'
                        : node.type === 'string'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
                          : 'bg-amber-50 border-amber-300 text-amber-900 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
                      }`}
                  >
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-sans mb-0.5">
                      {node.type}
                    </div>
                    <div className="font-semibold text-sm">{node.label}</div>
                    <div className="text-[10px] opacity-75 mt-1 font-sans">{node.path}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Key Diagnostics & Schema */}
      {activeTab === 'schema' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Structural Metrics */}
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

          {/* Generated JSON Schema */}
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

      {/* Tab 5: Security & Secret Scanner */}
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

  // If search query is active and matched inside this node, auto-expand it so inner matches are immediately visible
  const isSearching = !!(searchQuery.trim() && searchResult && !searchResult.error)
  const isExpanded = isSearching
    ? (hasMatchedDescendant || isMatched ? (expandedNodes[node.id] !== false) : !!expandedNodes[node.id])
    : !!expandedNodes[node.id]

  // Filter out non-matching nodes when a search query is active
  if (isSearching) {
    if (!isMatched && !hasMatchedDescendant && !isChildOfMatched) {
      return null
    }
  }

  return (
    <div className="pl-3 border-l border-slate-200 dark:border-slate-800 my-0.5">
      <div
        className={`flex items-center gap-2 group p-1 rounded-lg transition-all ${isMatched
          ? 'bg-amber-100/90 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/80 shadow-xs'
          : 'hover:bg-slate-200/60 dark:hover:bg-slate-900/60'
          }`}
      >
        {isContainer ? (
          <button
            onClick={() => onToggle(node.id)}
            className="w-4 h-4 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-4 text-center text-slate-400">•</span>
        )}

        <span className={`font-semibold ${isMatched ? 'text-amber-950 dark:text-amber-200 underline decoration-amber-500 font-bold' : 'text-slate-900 dark:text-slate-200'}`}>
          {node.key}:
        </span>

        {/* Type Badge */}
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded font-sans uppercase font-bold ${node.type === 'object'
            ? 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800/60'
            : node.type === 'array'
              ? 'bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800/60'
              : node.type === 'string'
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800/60'
                : node.type === 'number'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800/60'
                  : 'bg-rose-100 text-rose-900 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800/60'
            }`}
        >
          {node.type} {node.childCount !== undefined ? `(${node.childCount})` : ''}
        </span>

        {/* Leaf Value */}
        {!isContainer && (
          <span className={`truncate max-w-xs sm:max-w-md font-mono ${isMatched ? 'text-amber-900 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800' : 'text-slate-700 dark:text-slate-300'}`}>
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
          className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 ml-auto bg-slate-200 dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-800 font-sans"
        >
          {copiedItem === node.path ? '✓ Copied' : 'Copy Path'}
        </button>
      </div>

      {/* Render Children */}
      {isContainer && isExpanded && node.children && (
        <div className="ml-1 space-y-0.5">
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
