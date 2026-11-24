import { useState, type FormEvent } from 'react'
import { fieldError, type ApiError } from '../api/client'
import type { Schedule, ScheduleInput } from '../api/types'
import { ALL_DAYS, todayDate } from '../lib/medication'
import Button from './Button'
import DayPicker from './DayPicker'
import FormError from './FormError'
import TextField from './TextField'

type Props = {
  initial?: Schedule
  busy: boolean
  error: ApiError | null
  onSubmit: (input: ScheduleInput) => void
  onCancel: () => void
}

export default function ScheduleForm({ initial, busy, error, onSubmit, onCancel }: Props) {
  const [time, setTime] = useState(initial?.time_of_day ?? '08:00')
  const [days, setDays] = useState<number[]>(initial?.days_of_week ?? ALL_DAYS)
  const [start, setStart] = useState(() => initial?.start_date ?? todayDate())
  const [end, setEnd] = useState(initial?.end_date ?? '')
  const [pills, setPills] = useState(String(initial?.pills_per_dose ?? 1))
  const [active, setActive] = useState(initial?.active ?? true)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      time_of_day: time,
      days_of_week: days,
      start_date: start,
      end_date: end === '' ? null : end,
      pills_per_dose: Number(pills),
      active,
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      aria-label={initial ? 'Edit schedule' : 'New schedule'}
      className="space-y-3 rounded-2xl border border-line bg-paper p-4"
    >
      <FormError error={error} />
      <TextField label="Time" type="time" required value={time} onChange={setTime} error={fieldError(error, 'time_of_day')} />
      <DayPicker value={days} onChange={setDays} error={fieldError(error, 'days_of_week')} />
      <TextField label="Start date" type="date" required value={start} onChange={setStart} error={fieldError(error, 'start_date')} />
      <TextField
        label="End date (optional)"
        type="date"
        hint="Leave empty to continue until you stop the medication"
        value={end}
        onChange={setEnd}
        error={fieldError(error, 'end_date')}
      />
      <TextField
        label="Pills per dose"
        type="number"
        inputMode="numeric"
        min={1}
        max={100}
        required
        value={pills}
        onChange={setPills}
        error={fieldError(error, 'pills_per_dose')}
      />
      {initial && (
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-accent" />
          Active (untick to pause this schedule)
        </label>
      )}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={busy}>
          Save schedule
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}