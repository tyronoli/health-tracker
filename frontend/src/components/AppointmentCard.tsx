import { Link } from 'react-router'
import type { Appointment } from '../api/types'
import { dateTile, typeInfo } from '../lib/appointments'
import { formatTime } from '../lib/format'
import Card from './Card'
import StatusTag from './StatusTag'

export default function AppointmentCard({ appointment: a, timeZone }: { appointment: Appointment; timeZone: string }) {
  const tile = dateTile(a.starts_at, timeZone)
  const info = typeInfo(a.type)
  const line = [formatTime(a.starts_at, timeZone), a.provider_name, a.location].filter(Boolean).join(' · ')

  return (
    <li>
      <Card className="flex gap-4">
        <div className="w-12 flex-none self-start rounded-xl bg-accent-soft py-1.5 text-center text-accent-ink">
          <p className="text-xs font-bold uppercase">{tile.weekday}</p>
          <p className="font-display text-2xl font-bold leading-none">{tile.day}</p>
          <p className="text-xs">{tile.month}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/appointments/${a.id}`}
              className={`font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-accent ${
                a.status === 'cancelled' ? 'text-muted line-through' : 'text-ink'
              }`}
            >
              {a.title}
            </Link>
            <div className="flex flex-col items-end gap-1">
              <StatusTag status={info.tag}>{info.label}</StatusTag>
              {a.status === 'completed' && <StatusTag status="taken">Completed</StatusTag>}
              {a.status === 'cancelled' && <StatusTag status="skipped">Cancelled</StatusTag>}
            </div>
          </div>
          <p className="text-sm text-muted">{line}</p>
          {a.preparation && <p className="mt-1 line-clamp-2 text-sm text-muted">{`Prep: ${a.preparation}`}</p>}
          {a.notes && <p className="line-clamp-1 text-sm text-muted">{a.notes}</p>}
        </div>
      </Card>
    </li>
  )
}