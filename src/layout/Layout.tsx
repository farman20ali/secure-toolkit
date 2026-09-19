import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useTheme } from '../context/ThemeContext'
import { tools } from '../tools/registry'

export function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const currentTool = tools.find((t) => t.path === location.pathname)

  return (
    <div className="flex min-h-screen bg-white text-slate-900 font-sans antialiased dark:bg-zinc-950 dark:text-zinc-100">
      {/* Sidebar for Direct Tool Navigation */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Navbar */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {/* Mobile Sidebar Toggle */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden rounded-md border border-zinc-300 p-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
                aria-label="Toggle Navigation Sidebar"
              >
                ☰ Menu
              </button>

              <Link
                to="/"
                className="flex items-center gap-2 font-bold tracking-tight text-slate-900 dark:text-zinc-50 hover:text-emerald-500 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                  🛡️
                </span>
                <span className="hidden sm:inline">Secure Toolkit</span>
              </Link>

              {/* Current Location Breadcrumb */}
              {currentTool && (
                <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 border-l border-zinc-300 dark:border-zinc-800 pl-3">
                  <span>/</span>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1">
                    <span>{currentTool.icon}</span>
                    <span>{currentTool.title}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Top Right Controls */}
            <div className="flex items-center gap-3">
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                title="Toggle Light / Dark Mode"
              >
                {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
              </button>

              <a
                href="https://github.com/farman20ali/secure-toolkit"
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex rounded-lg border border-zinc-300 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                GitHub ⭐
              </a>
            </div>
          </div>
        </header>

        {/* Page Content Container */}
        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">{children}</main>

        {/* Footer */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 py-4 text-center text-xs text-slate-500 dark:text-zinc-500">
          <p>Zero network server calls • 100% Client-Side Web Crypto Execution</p>
        </footer>
      </div>
    </div>
  )
}
