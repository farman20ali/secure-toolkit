import { useState } from 'react'
import { categories, tools, type ToolCategory } from '../tools/registry'
import { ToolCard } from '../components/ToolCard'

export function HomePage() {
  const [activeCategory, setActiveCategory] = useState<ToolCategory | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTools = tools.filter((tool) => {
    const matchesCategory = activeCategory === 'all' || tool.category === activeCategory
    const matchesSearch =
      tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <section className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          🛡️ Privacy-First Browser Utilities
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50">
          Developer Security Laboratory
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
          Client-side security tools for cryptography, passwords, QR security, JWT tokens, secret scanning, and file integrity.
        </p>

        {/* Dashboard Search Input */}
        <div className="pt-2 max-w-xl">
          <div className="relative">
            <input
              type="text"
              placeholder="Search tools (e.g., QR, AES, JWT, Passwords, Secrets, TOTP)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pl-10 text-sm text-slate-900 shadow-xs placeholder-slate-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            <span className="absolute left-3.5 top-3 text-slate-400 dark:text-zinc-500">🔍</span>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-3 text-xs text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Category Pills & Tools Grid */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              onClick={() => setActiveCategory('all')}
              className={`rounded-lg px-3.5 py-1.5 font-semibold transition-colors ${
                activeCategory === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              All Utilities ({tools.length})
            </button>
            {categories.map((cat) => {
              const count = tools.filter((t) => t.category === cat.id).length
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.title}</span>
                  <span className="opacity-70 text-[10px]">({count})</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Search Results / Tools Grid */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>

        {filteredTools.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-zinc-800 p-8 text-center text-sm text-slate-500 dark:text-zinc-400">
            No security utilities match "{searchQuery}".
          </div>
        )}
      </section>
    </div>
  )
}
