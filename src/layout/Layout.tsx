import { Link } from 'react-router-dom'
import { tools } from '../tools/registry'

export function Layout({ children }: { children: React.ReactNode }) {
  const liveTools = tools.filter((t) => t.status === 'live')

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/"
            className="text-lg font-semibold tracking-tight text-zinc-50 hover:text-emerald-400"
          >
            Secure Toolkit
          </Link>
          <nav
            className="flex flex-wrap gap-1 text-sm"
            aria-label="Primary navigation"
          >
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Home
            </Link>
            {liveTools.map((tool) => (
              <Link
                key={tool.id}
                to={tool.path}
                className="rounded-md px-3 py-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                {tool.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>

      <footer className="border-t border-zinc-800 py-6 text-center text-sm text-zinc-500">
        <p>
          Generated locally in your browser — nothing is sent to a server.
        </p>
        <p className="mt-1">
          <a
            href="https://github.com/farman20ali/secure-toolkit"
            className="text-zinc-400 underline-offset-2 hover:text-emerald-400 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View source on GitHub
          </a>
        </p>
      </footer>
    </div>
  )
}
