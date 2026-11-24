import type { LogStatus } from '../api/doses'
import type { TodayDose } from '../api/types'
import { describeDue, formatTime } from '../lib/format'
import Button from './Button'
import Card from './Card'
import StatusTag from './StatusTag'

const ACTION_WINDOW_MS = 2 * 60 * 60 * 1000 // buttons appear for doses due within 2 hours

type Props = {
  dose: TodayDose
  timeZone: string
  now: number
  canWrite: boolean
  busy: boolean
  highlight: boolean
  onSet: (dose: TodayDose, status: LogStatus) => void
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 fill-none stroke-current stroke-[3]">
      <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DoseCard({ dose, timeZone, now, canWrite, busy, highlight, onSet }: Props) {
  const scheduledMs = new Date(dose.scheduled_for).getTime()
  const actionable = dose.status === 'pending' && scheduledMs - now <= ACTION_WINDOW_MS
  const pills = `${dose.pills_per_dose} ${dose.pills_per_dose === 1 ? 'pill' : 'pills'}`
  const detail = [dose.medication.dosage, pills].filter(Boolean).join(' · ')

  return (
    <Card className={highlight ? 'border-2 border-accent' : ''}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{dose.medication.name}</p>
          <p className="text-sm text-muted">
            {dose.status === 'pending' ? `${detail} · ${describeDue(scheduledMs, now)}` : detail}
          </p>
        </div>
        {dose.status === 'taken' && (
          <StatusTag status="taken">
            <CheckIcon />
            Taken{dose.logged_at ? ` ${formatTime(dose.logged_at, timeZone)}` : ''}
          </StatusTag>
        )}
        {dose.status === 'missed' && <StatusTag status="missed">Missed</StatusTag>}
        {dose.status === 'skipped' && <StatusTag status="skipped">Skipped</StatusTag>}
      </div>

      {canWrite && actionable && (
        <div className="mt-3 flex gap-2">
          <Button className="flex-1" disabled={busy} onClick={() => onSet(dose, 'taken')}>
            Taken
          </Button>
          <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => onSet(dose, 'skipped')}>
            Skip
          </Button>
        </div>
      )}
      {canWrite && dose.status === 'missed' && (
        <Button variant="secondary" className="mt-3 w-full" disabled={busy} onClick={() => onSet(dose, 'taken')}>
          Log it late
        </Button>
      )}
      {canWrite && dose.status === 'taken' && (
        <Button
          variant="secondary"
          className="mt-3 min-h-9 px-3 text-sm"
          disabled={busy}
          onClick={() => onSet(dose, 'skipped')}
        >
          Mark as skipped
        </Button>
      )}
      {canWrite && dose.status === 'skipped' && (
        <Button
          variant="secondary"
          className="mt-3 min-h-9 px-3 text-sm"
          disabled={busy}
          onClick={() => onSet(dose, 'taken')}
        >
          Mark as taken
        </Button>
      )}
    </Card>
  )
}