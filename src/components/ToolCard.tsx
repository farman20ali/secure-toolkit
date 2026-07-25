import { Link } from 'react-router-dom'
import type { ToolDefinition } from '../tools/registry'

type ToolCardProps = {
  tool: ToolDefinition
}

export function ToolCard({ tool }: ToolCardProps) {
  const isLive = tool.status === 'live'

  const inner = (
    <article
      className={`flex h-full flex-col rounded-xl border p-5 transition ${
        isLive
          ? 'border-zinc-700 bg-zinc-900/80 hover:border-emerald-500/50 hover:bg-zinc-900'
          : 'border-zinc-800 bg-zinc-900/40 opacity-80'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-50">{tool.title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            isLive
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'bg-zinc-700/80 text-zinc-400'
          }`}
        >
          {isLive ? 'Live' : 'Coming soon'}
        </span>
      </div>
      <p className="flex-1 text-sm leading-relaxed text-zinc-400">
        {tool.description}
      </p>
      {isLive && (
        <p className="mt-4 text-sm font-medium text-emerald-400/90">Open tool →</p>
      )}
    </article>
  )

  if (isLive) {
    return (
      <Link to={tool.path} className="block h-full focus-visible:outline-none">
        <span className="sr-only">{tool.title}</span>
        {inner}
      </Link>
    )
  }

  return inner
}
