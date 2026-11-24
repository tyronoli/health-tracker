import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { toApiError } from '../api/client'
import { getToday, type LogStatus } from '../api/doses'
import type { TodayDose, TodayResponse } from '../api/types'
import Button from '../components/Button'
import DoseCard from '../components/DoseCard'
import ProfileSwitcher from '../components/ProfileSwitcher'
import ProgressRing from '../components/ProgressRing'
import StatusTag from '../components/StatusTag'
import { useProfiles } from '../context/profile-context'
import { useNow } from '../hooks/useNow'
import { useSetDoseStatus } from '../hooks/useSetDoseStatus'
import { formatLongDate, formatTime } from '../lib/format'

function describeError(error: unknown): string {
  const problem = toApiError(error)
  if (problem.code === 'already_logged') {
    return 'That dose was already logged somewhere else. Showing the latest.'
  }
  if (problem.status === 403) return 'You only have view access to this profile now.'
  if (problem.status === 404) return 'That dose is no longer available. Showing the latest.'
  return problem.message
}

function Summary({ data }: { data: TodayResponse }) {
  const total = data.doses.length
  const taken = data.doses.filter((d) => d.status === 'taken').length
  const next = data.doses.find((d) => d.status === 'pending')
  const headline =
    total === 0
      ? 'No doses scheduled today'
      : `${taken} of ${total} ${total === 1 ? 'dose' : 'doses'} taken`
  const nextLine = next
    ? `Next: ${next.medication.name} at ${formatTime(next.scheduled_for, data.timezone)}`
    : total > 0
      ? 'No more doses today'
      : null

  return (
    <div className="flex items-center gap-4 rounded-2xl bg-hero p-4 text-on-hero">
      <ProgressRing done={taken} total={total} />
      <div>
        <h2 className="font-display text-xl font-bold">{headline}</h2>
        {nextLine && <p className="text-sm">{nextLine}</p>}
      </div>
    </div>
  )
}

function TodayContent() {
  const { selected, canWrite } = useProfiles()
  const now = useNow(30_000)
  const query = useQuery({
    queryKey: ['today', selected.user_id],
    queryFn: () => getToday(selected.user_id),
    refetchInterval: 60_000,
  })
  const setStatus = useSetDoseStatus(selected.user_id)
  const data = query.data
  const next = data?.doses.find((d) => d.status === 'pending')

  function handleSet(dose: TodayDose, status: LogStatus) {
    setStatus.mutate({ dose, status })
  }

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">{data ? formatLongDate(data.date) : '\u00a0'}</p>
        <h1 className="font-display text-3xl font-bold">Today</h1>
      </header>

      <ProfileSwitcher />

      {selected.relationship !== 'self' && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
          Viewing {selected.display_name}'s day
          {canWrite ? (
            <StatusTag status="taken">Can edit</StatusTag>
          ) : (
            <StatusTag status="skipped">View only</StatusTag>
          )}
        </p>
      )}

      {setStatus.isError && (
        <p role="alert" className="rounded-xl bg-missed-bg px-3 py-2 text-sm text-missed-ink">
          {describeError(setStatus.error)}
        </p>
      )}

      {query.isPending && <p className="text-muted">Loading today's doses…</p>}

      {query.isError && (
        <div role="alert" className="space-y-3 rounded-2xl bg-missed-bg p-4 text-missed-ink">
          <p>We couldn't load today's doses.</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {data && (
        <>
          <Summary data={data} />
          {data.doses.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing to take today.{' '}
              <Link to="/medications" className="font-medium text-accent-ink underline">
                Add a medication
              </Link>{' '}
              and a schedule to see doses here.
            </p>
          ) : (
            <ul className="space-y-3">
              {data.doses.map((dose) => (
                <li key={`${dose.schedule}-${dose.scheduled_for}`} className="flex gap-3">
                  <time dateTime={dose.scheduled_for} className="w-12 flex-none pt-4 text-sm font-bold">
                    {formatTime(dose.scheduled_for, data.timezone)}
                  </time>
                  <div className="flex-1">
                    <DoseCard
                      dose={dose}
                      timeZone={data.timezone}
                      now={now}
                      canWrite={canWrite}
                      busy={setStatus.isPending}
                      highlight={dose === next}
                      onSet={handleSet}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

export default function TodayPage() {
  const { selected } = useProfiles()
  // Keyed by profile, so switching people starts with a clean slate (no stale error messages).
  return <TodayContent key={selected.user_id} />
}