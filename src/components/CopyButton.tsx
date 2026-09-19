import { useCallback, useState } from 'react'

type CopyButtonProps = {
  text?: string
  value?: string
  label?: string
  disabled?: boolean
}

export function CopyButton({
  text,
  value,
  label = 'Copy',
  disabled = false,
}: CopyButtonProps) {
  const content = text ?? value ?? ''
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    if (!content || disabled) {
      return
    }
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [content, disabled])

  return (
    <button
      type="button"
      onClick={handleCopy}
      disabled={disabled || !content}
      className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:border-emerald-500/60 hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {copied ? '✓ Copied' : label}
    </button>
  )
}
