import type { Appointment } from '../api/types'
import { buildMonthGrid, formatMonthTitle } from '../lib/appointments'
import { WEEKDAYS } from '../lib/medication'
import Button from './Button'

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current stroke-2">
      <path d={direction === 'left' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type Props = {
  month: string // YYYY-MM
  today: string // YYYY-MM-DD in the person's timezone
  selected: string
  byDay: Map<string, Appointment[]>
  onSelect: (date: string) => void
  onPrev: () => void
  onNext: () => void
}

export default function MonthCalendar({ month, today, selected, byDay, onSelect, onPrev, onNext }: Props) {
  const monthName = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  )

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="secondary" className="w-11 px-0" aria-label="Previous month" onClick={onPrev}>
          <Chevron direction="left" />
        </Button>
        <h2 className="font-display text-xl font-bold">{formatMonthTitle(month)}</h2>
        <Button variant="secondary" className="w-11 px-0" aria-label="Next month" onClick={onNext}>
          <Chevron direction="right" />
        </Button>
      </div>

      <div aria-hidden="true" className="mb-1 grid grid-cols-7 text-center text-xs font-bold text-muted">
        {WEEKDAYS.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {buildMonthGrid(month)
          .flat()
          .map((cell) => {
            if (!cell.inMonth) return <div key={cell.date} aria-hidden="true" />
            const count = byDay.get(cell.date)?.length ?? 0
            const isSelected = cell.date === selected
            const isToday = cell.date === today
            const day = Number(cell.date.slice(8))
            const label = `${day} ${monthName}${count ? `, ${count} ${count === 1 ? 'appointment' : 'appointments'}` : ''}`
            return (
              <button
                key={cell.date}
                type="button"
                aria-label={label}
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => onSelect(cell.date)}
                className={`flex aspect-square flex-col items-center justify-center rounded-xl border text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  isSelected ? 'border-accent bg-accent text-on-accent' : 'border-line bg-surface text-ink'
                } ${isToday && !isSelected ? 'ring-2 ring-accent' : ''}`}
              >
                {day}
                {count > 0 && (
                  <span aria-hidden="true" className="mt-0.5 flex gap-0.5">
                    {Array.from({ length: Math.min(count, 3) }, (_, i) => (
                      <span key={i} className="h-1.5 w-1.5 rounded-full bg-current" />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
      </div>
    </div>
  )
}