import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toApiError } from '../api/client'
import type { Medication } from '../api/types'
import Button from '../components/Button'
import Card from '../components/Card'
import MedicationForm from '../components/MedicationForm'
import QueryError from '../components/QueryError'
import RefillForm from '../components/RefillForm'
import ScheduleSection from '../components/ScheduleSection'
import StatusTag from '../components/StatusTag'
import SupplyBar from '../components/SupplyBar'
import { useProfiles } from '../context/profile-context'
import { useMedication } from '../hooks/useMedications'
import { useStopMedication, useUpdateMedication } from '../hooks/useMedicationMutations'
import { daysLeftText, pillsText, supplyFraction } from '../lib/medication'

function BackLink() {
  return (
    <Link to="/medications" className="text-sm font-medium text-accent-ink underline">
      ← Medications
    </Link>
  )
}

function DetailsList({ medication: m }: { medication: Medication }) {
  const rows: [string, string][] = [
    ['Dosage', m.dosage || 'Not set'],
    ['Instructions', m.instructions || 'None'],
    ['Pills in stock', String(m.pills_remaining)],
    ['Low-supply alert at', String(m.refill_threshold)],
  ]
  return (
    <dl className="space-y-2">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt className="text-sm text-muted">{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function MedicationDetailPage() {
  const id = Number(useParams().id)
  const query = useMedication(id)
  const { canWriteTo } = useProfiles()
  const update = useUpdateMedication()
  const stop = useStopMedication()
  const navigate = useNavigate()
  const [confirmingStop, setConfirmingStop] = useState(false)

  if (!Number.isInteger(id) || (query.isError && toApiError(query.error).status === 404)) {
    return (
      <Card className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Medication not found</h1>
        <p className="text-muted">We couldn't find that medication. It may have been removed, or you may not have access to it.</p>
        <BackLink />
      </Card>
    )
  }
  if (query.isPending) return <p className="text-muted">Loading…</p>
  if (query.isError) {
    return <QueryError message="We couldn't load this medication." onRetry={() => void query.refetch()} />
  }

  const m = query.data
  const canWrite = canWriteTo(m.owner)
  const pills = pillsText(m.pills_remaining)

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{m.name}</h1>
        {!m.active && <StatusTag status="skipped">Stopped</StatusTag>}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{pills} left</p>
          {m.low_supply && m.active && <StatusTag status="low">Low supply</StatusTag>}
        </div>
        <SupplyBar fraction={supplyFraction(m)} low={m.low_supply} />
        <p className="text-sm text-muted">{daysLeftText(m)}</p>
        {canWrite && <RefillForm medication={m} />}
      </Card>

      <section aria-labelledby="details-title" className="space-y-3">
        <h2 id="details-title" className="font-display text-xl font-bold">
          Details
        </h2>
        {canWrite ? (
          <>
            <MedicationForm
              key={m.updated_at}
              initial={m}
              submitLabel="Save changes"
              busy={update.isPending}
              error={update.error ? toApiError(update.error) : null}
              onSubmit={(changes) => update.mutate({ id: m.id, changes })}
            />
            {update.isSuccess && (
              <p role="status" className="text-sm text-taken-ink">
                Saved.
              </p>
            )}
          </>
        ) : (
          <DetailsList medication={m} />
        )}
      </section>

      <ScheduleSection medication={m} canWrite={canWrite} />

      {canWrite && (
        <section className="space-y-3">
          {m.active ? (
            confirmingStop ? (
              <Card className="space-y-3">
                <p>Stop {m.name}? It leaves your Today list. Your history is kept, and you can restart it later.</p>
                <div className="flex gap-2">
                  <Button
                    variant="danger"
                    disabled={stop.isPending}
                    onClick={() => stop.mutate(m.id, { onSuccess: () => navigate('/medications') })}
                  >
                    Yes, stop
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmingStop(false)}>
                    Cancel
                  </Button>
                </div>
              </Card>
            ) : (
              <Button variant="danger" className="w-full" onClick={() => setConfirmingStop(true)}>
                Stop medication
              </Button>
            )
          ) : (
            <Button
              variant="secondary"
              className="w-full"
              disabled={update.isPending}
              onClick={() => update.mutate({ id: m.id, changes: { active: true } })}
            >
              Restart medication
            </Button>
          )}
        </section>
      )}
    </div>
  )
}