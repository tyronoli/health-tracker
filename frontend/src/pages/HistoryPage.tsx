import { useInfiniteQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { listDoses } from '../api/history'
import type { DoseLogEntry, DoseLogStatus } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import FilterChip from '../components/FilterChip'
import ProfileNote from '../components/ProfileNote'
import ProfileSwitcher from '../components/ProfileSwitcher'
import QueryError from '../components/QueryError'
import SelectField from '../components/SelectField'
import StatusTag from '../components/StatusTag'
import TextField from '../components/TextField'
import { useProfiles } from '../context/profile-context'
import { STATUSES, useHistoryFilters } from '../hooks/useHistoryFilters'
import { useMedications } from '../hooks/useMedications'
import { formatLongDate, formatTime } from '../lib/format'
import { groupByDay } from '../lib/history'

const STATUS_LABELS: Record<DoseLogStatus, string> = { taken: 'Taken', skipped: 'Skipped', missed: 'Missed' }

function HistoryRow({ log, name, timeZone }: { log: DoseLogEntry; name: string; timeZone: string }) {
  return (
    <li>
      <Card className="flex items-center gap-3 py-3">
        <time dateTime={log.scheduled_for} className="w-12 flex-none text-sm font-bold">
          {formatTime(log.scheduled_for, timeZone)}
        </time>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{name}</p>
          {log.note && <p className="text-sm text-muted">{log.note}</p>}
        </div>
        <StatusTag status={log.status}>{STATUS_LABELS[log.status]}</StatusTag>
      </Card>
    </li>
  )
}

export default function HistoryPage() {
  const { selected } = useProfiles()
  const { filters, setFilter, clear, hasFilters } = useHistoryFilters()
  const medications = useMedications(selected.user_id) // all, including stopped ones
  const query = useInfiniteQuery({
    queryKey: ['doses', 'history', selected.user_id, filters],
    queryFn: ({ pageParam }) => listDoses(selected.user_id, filters, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.next ? pages.length + 1 : undefined),
  })

  const medicationList = useMemo(() => medications.data?.results ?? [], [medications.data])
  const names = useMemo(() => new Map(medicationList.map((m) => [m.id, m.name] as const)), [medicationList])
  const logs = query.data?.pages.flatMap((p) => p.results) ?? []
  const count = query.data?.pages[0]?.count ?? 0
  const timeZone = selected.timezone

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">
          {query.data ? `${count} ${count === 1 ? 'dose' : 'doses'}` : '\u00a0'}
        </p>
        <h1 className="font-display text-3xl font-bold">History</h1>
      </header>

      <ProfileSwitcher />
      <ProfileNote noun="history" />

      <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
        <FilterChip label="All" active={!filters.status} onClick={() => setFilter('status', undefined)} />
        {STATUSES.map((status) => (
          <FilterChip
            key={status}
            label={STATUS_LABELS[status]}
            active={filters.status === status}
            onClick={() => setFilter('status', status)}
          />
        ))}
      </div>

      <SelectField
        label="Medication"
        value={filters.medication ? String(filters.medication) : ''}
        onChange={(value) => setFilter('medication', value || undefined)}
        options={[
          { value: '', label: 'All medications' },
          ...medicationList.map((m) => ({ value: String(m.id), label: m.name })),
        ]}
      />

      <div className="grid grid-cols-2 gap-3">
        <TextField label="From" type="date" value={filters.from ?? ''} onChange={(v) => setFilter('from', v)} />
        <TextField label="To" type="date" value={filters.to ?? ''} onChange={(v) => setFilter('to', v)} />
      </div>

      {hasFilters && (
        <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={clear}>
          Clear filters
        </Button>
      )}

      {query.isPending && <p className="text-muted">Loading history…</p>}
      {query.isError && (
        <QueryError message="We couldn't load the history." onRetry={() => void query.refetch()} />
      )}

      {query.data &&
        (logs.length === 0 ? (
          <p className="text-sm text-muted">
            {hasFilters ? 'No doses match these filters.' : 'No history yet. Doses you log will show up here.'}
          </p>
        ) : (
          <>
            {groupByDay(logs, timeZone).map((group) => (
              <section key={group.date}>
                <h2 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wider text-muted">
                  {formatLongDate(group.date)}
                </h2>
                <ul className="space-y-2">
                  {group.items.map((log) => (
                    <HistoryRow
                      key={log.id}
                      log={log}
                      name={names.get(log.medication) ?? 'Medication'}
                      timeZone={timeZone}
                    />
                  ))}
                </ul>
              </section>
            ))}
            {query.hasNextPage && (
              <Button
                variant="secondary"
                className="w-full"
                disabled={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Load more
              </Button>
            )}
          </>
        ))}
    </div>
  )
}