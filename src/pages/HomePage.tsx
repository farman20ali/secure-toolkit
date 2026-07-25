import { tools } from '../tools/registry'
import { ToolCard } from '../components/ToolCard'

export function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">
          Privacy-first security utilities
        </h1>
        <p className="max-w-2xl text-zinc-400">
          Client-side tools for passwords, identifiers, and encoding. All
          processing happens in your browser using the Web Crypto API.
        </p>
      </section>

      <section
        className="grid gap-4 sm:grid-cols-2"
        aria-label="Available tools"
      >
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </section>
    </div>
  )
}
