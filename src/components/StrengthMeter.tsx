import {
  estimateEntropyBits,
  formatEntropyBits,
  strengthLabelFromBits,
  type StrengthLabel,
} from '../tools/password/entropy'

type StrengthMeterProps = {
  length: number
  poolSize: number
}

const labelStyles: Record<StrengthLabel, string> = {
  Weak: 'text-amber-400',
  Good: 'text-sky-400',
  Strong: 'text-emerald-400',
}

export function StrengthMeter({ length, poolSize }: StrengthMeterProps) {
  const bits = estimateEntropyBits(length, poolSize)
  const label = strengthLabelFromBits(bits)
  const percent = Math.min(100, (bits / 100) * 100)

  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-zinc-400">Estimated strength</span>
        <span className={`font-medium ${labelStyles[label]}`}>
          {label} · {formatEntropyBits(bits)}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-zinc-800"
        role="meter"
        aria-valuenow={Math.round(bits)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Password strength: ${label}`}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 via-sky-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
