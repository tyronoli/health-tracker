import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import type { AppointmentType } from '../api/types'
import AppointmentCard from '../components/AppointmentCard'
import FilterChip from '../components/FilterChip'
import FloatingAddLink from '../components/FloatingAddLink'
import MonthCalendar from '../components/MonthCalendar'
import ProfileNote from '../components/ProfileNote'
import ProfileSwitcher from '../components/ProfileSwitcher'
import QueryError from '../components/QueryError'
import { useProfiles } from '../context/profile-context'
import { useAppointments } from '../hooks/useAppointments'
import { useNow } from '../hooks/useNow'
import {
  APPOINTMENT_TYPES,
  describeUntil,
  formatWhen,
  groupAppointmentsByDay,
  monthRange,
  shiftMonth,
} from '../lib/appointments'
import { formatLongDate, localDate } from '../lib/format'

const VIEWS = ['upcoming', 'calendar', 'past'] as const
type View = (typeof VIEWS)[number]
const VIEW_LABELS: Record<View, string> = { upcoming: 'Upcoming', calendar: 'Calendar', past: 'Past' }

type ViewProps = { profileId: number; timeZone: string; canWrite: boolean }

function UpcomingView({ profileId, timeZone, canWrite }: ViewProps) {
  const [params, setParams] = useSearchParams()
  const rawType = params.get('type')
  const type = APPOINTMENT_TYPES.find((t) => t.value === rawType)?.value
  const query = useAppointments(profileId, { upcoming: true, type })
  const now = useNow(60_000)
  const items = query.data?.results ?? []
  const next = type ? undefined : items[0]

  function setType(value: AppointmentType | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set('type', value)
    else next.delete('type')
    setParams(next, { replace: true })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{query.data ? `${query.data.count} coming up` : '\u00a0'}</p>

      {next && (
        <Link
          to={`/appointments/${next.id}`}
          className="block rounded-2xl bg-hero p-4 text-on-hero focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <p className="text-sm">{`Next up · ${describeUntil(next.starts_at, now, timeZone)}`}</p>
          <p className="mt-0.5 font-display text-xl font-bold">{next.title}</p>
          <p className="mt-0.5 text-sm">{formatWhen(next.starts_at, timeZone)}</p>
        </Link>
      )}

      <div role="group" aria-label="Type" className="flex flex-wrap gap-2">
        <FilterChip label="All" active={!type} onClick={() => setType(undefined)} />
        {APPOINTMENT_TYPES.map((t) => (
          <FilterChip key={t.value} label={t.filterLabel} active={type === t.value} onClick={() => setType(t.value)} />
        ))}
      </div>

      {query.isPending && <p className="text-muted">Loading appointments…</p>}
      {query.isError && (
        <QueryError message="We couldn't load the appointments." onRetry={() => void query.refetch()} />
      )}
      {query.data &&
        (items.length === 0 ? (
          <p className="text-sm text-muted">
            No upcoming appointments.{canWrite ? ' Tap New appointment to add one.' : ''}
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <AppointmentCard key={a.id} appointment={a} timeZone={timeZone} />
            ))}
          </ul>
        ))}
    </div>
  )
}

function PastView({ profileId, timeZone }: ViewProps) {
  const query = useAppointments(profileId, { upcoming: false })
  const items = query.data?.results ?? []

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">{query.data ? `${query.data.count} past` : '\u00a0'}</p>
      {query.isPending && <p className="text-muted">Loading appointments…</p>}
      {query.isError && (
        <QueryError message="We couldn't load the appointments." onRetry={() => void query.refetch()} />
      )}
      {query.data &&
        (items.length === 0 ? (
          <p className="text-sm text-muted">No past appointments yet.</p>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <AppointmentCard key={a.id} appointment={a} timeZone={timeZone} />
            ))}
          </ul>
        ))}
    </div>
  )
}

function CalendarView({ profileId, timeZone }: ViewProps) {
  const [params, setParams] = useSearchParams()
  const now = useNow(60_000)
  const today = localDate(new Date(now).toISOString(), timeZone)
  const rawMonth = params.get('month')
  const month = rawMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : today.slice(0, 7)
  const [picked, setPicked] = useState<string | null>(null)

  const range = monthRange(month)
  const query = useAppointments(profileId, { from: range.from, to: range.to })
  const byDay = useMemo(() => groupAppointmentsByDay(query.data?.results ?? [], timeZone), [query.data, timeZone])

  // Today when we are looking at this month, otherwise the first of the month.
  const selected = picked?.startsWith(month) ? picked : today.startsWith(month) ? today : `${month}-01`
  const dayItems = byDay.get(selected) ?? []

  function go(delta: number) {
    const next = new URLSearchParams(params)
    next.set('month', shiftMonth(month, delta))
    setParams(next, { replace: true })
    setPicked(null)
  }

  return (
    <div className="space-y-4">
      <MonthCalendar
        month={month}
        today={today}
        selected={selected}
        byDay={byDay}
        onSelect={setPicked}
        onPrev={() => go(-1)}
        onNext={() => go(1)}
      />

      {query.isPending && <p className="text-muted">Loading appointments…</p>}
      {query.isError && (
        <QueryError message="We couldn't load the appointments." onRetry={() => void query.refetch()} />
      )}
      {query.data && (
        <section aria-label="Selected day" className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted">{formatLongDate(selected)}</h3>
          {dayItems.length === 0 ? (
            <p className="text-sm text-muted">{`No appointments on ${formatLongDate(selected)}.`}</p>
          ) : (
            <ul className="space-y-3">
              {dayItems.map((a) => (
                <AppointmentCard key={a.id} appointment={a} timeZone={timeZone} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}

export default function AppointmentsPage() {
  const { selected, canWrite } = useProfiles()
  const [params, setParams] = useSearchParams()
  const rawView = params.get('view')
  const view: View = VIEWS.find((v) => v === rawView) ?? 'upcoming'

  function setView(next: View) {
    const updated = new URLSearchParams(params)
    if (next === 'upcoming') updated.delete('view')
    else updated.set('view', next)
    setParams(updated, { replace: true })
  }

  const props: ViewProps = { profileId: selected.user_id, timeZone: selected.timezone, canWrite }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-3xl font-bold">Appointments</h1>
      </header>

      <ProfileSwitcher />
      <ProfileNote noun="appointments" />

      <div role="group" aria-label="View" className="flex gap-2">
        {VIEWS.map((v) => (
          <FilterChip key={v} label={VIEW_LABELS[v]} active={view === v} onClick={() => setView(v)} />
        ))}
      </div>

      {view === 'upcoming' && <UpcomingView {...props} />}
      {view === 'calendar' && <CalendarView {...props} />}
      {view === 'past' && <PastView {...props} />}

      {canWrite && <FloatingAddLink to="/appointments/new" label="New appointment" />}
    </div>
  )
}