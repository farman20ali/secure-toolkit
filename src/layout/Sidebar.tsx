import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { categories, tools } from '../tools/registry'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const location = useLocation()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTools = tools.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 flex-col border-r border-slate-200 bg-white/95 text-slate-800 backdrop-blur-md transition-transform duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950/95 dark:text-zinc-100 lg:static lg:flex ${
          isOpen ? 'flex translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header & Search */}
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 space-y-3">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              onClick={onClose}
              className="flex items-center gap-2.5 font-extrabold text-sm tracking-tight text-slate-900 dark:text-zinc-50 hover:text-emerald-500 transition-colors"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 shadow-xs">
                🛡️
              </span>
              <span>Secure Toolkit</span>
            </Link>
            <button
              onClick={onClose}
              className="lg:hidden rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Sidebar Quick Tool Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Tools List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs no-scrollbar">
          {searchQuery ? (
            <div className="space-y-1">
              <div className="px-2 pb-1 font-semibold uppercase text-[10px] tracking-wider text-slate-400 dark:text-zinc-500">
                Search Results ({filteredTools.length})
              </div>
              {filteredTools.map((tool) => {
                const isActive = location.pathname === tool.path
                return (
                  <Link
                    key={tool.id}
                    to={tool.path}
                    onClick={onClose}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-emerald-500/15 text-emerald-600 font-bold border-l-2 border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <span className="text-sm">{tool.icon}</span>
                    <span className="truncate">{tool.title}</span>
                  </Link>
                )
              })}
              {filteredTools.length === 0 && (
                <div className="px-2 text-slate-400 dark:text-zinc-500 text-[11px]">No tools match "{searchQuery}"</div>
              )}
            </div>
          ) : (
            categories.map((cat) => {
              const catTools = tools.filter((t) => t.category === cat.id)
              if (catTools.length === 0) return null

              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 font-semibold uppercase text-[10px] tracking-wider text-slate-400 dark:text-zinc-500">
                    <span>{cat.icon}</span>
                    <span>{cat.title}</span>
                  </div>
                  {catTools.map((tool) => {
                    const isActive = location.pathname === tool.path
                    return (
                      <Link
                        key={tool.id}
                        to={tool.path}
                        onClick={onClose}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium transition-all duration-150 ${
                          isActive
                            ? 'bg-emerald-500/15 text-emerald-600 font-bold border-l-2 border-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
                        }`}
                      >
                        <span className="text-sm">{tool.icon}</span>
                        <span className="truncate">{tool.title}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-zinc-800 text-center text-[11px] font-medium text-slate-400 dark:text-zinc-500">
          100% Client-Side Executed
        </div>
      </aside>
    </>
  )
}
