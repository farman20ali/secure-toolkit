import { Link } from 'react-router-dom'

type ComingSoonPageProps = {
  title: string
  description: string
}

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-lg space-y-4 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-zinc-500">
        Coming soon
      </p>
      <h1 className="text-2xl font-bold text-zinc-50">{title}</h1>
      <p className="text-zinc-400">{description}</p>
      <Link
        to="/"
        className="inline-block rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:border-emerald-500/50"
      >
        Back to home
      </Link>
    </div>
  )
}
