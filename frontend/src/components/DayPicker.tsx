import { ALL_DAYS, WEEKDAYS } from '../lib/medication'

export default function DayPicker({
  value,
  onChange,
  error,
}: {
  value: number[]
  onChange: (days: number[]) => void
  error?: string
}) {
  const toggle = (day: number) =>
    onChange(value.includes(day) ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-ink">Days</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {WEEKDAYS.map((label, day) => {
          const active = value.includes(day)
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(day)}
              className={`min-h-11 min-w-11 rounded-xl border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active ? 'border-accent bg-accent text-on-accent' : 'border-line-strong bg-surface text-ink'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <button type="button" onClick={() => onChange(ALL_DAYS)} className="font-medium text-accent-ink underline">
          Every day
        </button>
        <button type="button" onClick={() => onChange([0, 1, 2, 3, 4])} className="font-medium text-accent-ink underline">
          Weekdays
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-missed-ink">
          {error}
        </p>
      )}
    </fieldset>
  )
}