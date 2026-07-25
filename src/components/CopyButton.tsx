import { useCallback, useState } from 'react'

type CopyButtonProps = {
  text: string
  label?: string
  disabled?: boolean
}

export function CopyButton({
  text,
  label = 'Copy',
  disabled = false,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!text || disabled) {
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [text, disabled])

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !text}
      className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-emerald-500/60 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? 'Copied' : label}
    </button>
  )
}
