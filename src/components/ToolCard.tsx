import { Link } from 'react-router-dom'
import type { ToolDefinition } from '../tools/registry'
import { categories } from '../tools/registry'

type ToolCardProps = {
  tool: ToolDefinition
}

export function ToolCard({ tool }: ToolCardProps) {
  const categoryDef = categories.find((c) => c.id === tool.category)

  return (
    <Link
      to={tool.path}
      className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all duration-200 ease-out hover:-translate-y-1 hover:border-emerald-500 hover:shadow-lg dark:border-zinc-800/80 dark:bg-zinc-900/60 dark:hover:border-emerald-500/60 dark:hover:bg-zinc-900"
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-xl transition-transform duration-200 group-hover:scale-110 dark:bg-zinc-800">
            {tool.icon}
          </span>
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            {categoryDef?.title || tool.category}
          </span>
        </div>

        <div>
          <h3 className="font-bold text-base text-slate-900 dark:text-zinc-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
            {tool.title}
          </h3>
          <p className="mt-1 text-xs text-slate-600 dark:text-zinc-400 leading-relaxed line-clamp-2">
            {tool.description}
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <span>Launch Utility</span>
        <span className="group-hover:translate-x-1.5 transition-transform duration-200">→</span>
      </div>
    </Link>
  )
}
