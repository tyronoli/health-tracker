import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toApiError } from '../api/client'
import type { Appointment } from '../api/types'
import AppointmentForm from '../components/AppointmentForm'
import Button from '../components/Button'
import Card from '../components/Card'
import QueryError from '../components/QueryError'
import StatusTag from '../components/StatusTag'
import { useProfiles } from '../context/profile-context'
import { useAppointment } from '../hooks/useAppointments'
import { useDeleteAppointment, useUpdateAppointment } from '../hooks/useAppointmentMutations'
import { STATUS_OPTIONS, formatWhen, typeInfo } from '../lib/appointments'

function BackLink() {
  return (
    <Link to="/appointments" className="text-sm font-medium text-accent-ink underline">
      ← Appointments
    </Link>
  )
}

function DetailsList({ appointment: a, timeZone }: { appointment: Appointment; timeZone: string }) {
  const rows: [string, string][] = [
    ['When', formatWhen(a.starts_at, timeZone)],
    ['Duration', a.duration_minutes ? `${a.duration_minutes} minutes` : 'Not set'],
    ['Provider', a.provider_name || 'Not set'],
    ['Location', a.location || 'Not set'],
    ['Preparation', a.preparation || 'None'],
    ['Notes', a.notes || 'None'],
    ['Status', STATUS_OPTIONS.find((s) => s.value === a.status)?.label ?? a.status],
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

export default function AppointmentDetailPage() {
  const id = Number(useParams().id)
  const query = useAppointment(id)
  const { profiles, selected, canWriteTo } = useProfiles()
  const update = useUpdateAppointment()
  const remove = useDeleteAppointment()
  const navigate = useNavigate()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  if (!Number.isInteger(id) || (query.isError && toApiError(query.error).status === 404)) {
    return (
      <Card className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Appointment not found</h1>
        <p className="text-muted">
          We couldn't find that appointment. It may have been removed, or you may not have access to it.
        </p>
        <BackLink />
      </Card>
    )
  }
  if (query.isPending) return <p className="text-muted">Loading…</p>
  if (query.isError) {
    return <QueryError message="We couldn't load this appointment." onRetry={() => void query.refetch()} />
  }

  const a = query.data
  const canWrite = canWriteTo(a.owner)
  // Times belong to the person the appointment is for.
  const timeZone = profiles.find((p) => p.user_id === a.owner)?.timezone ?? selected.timezone
  const info = typeInfo(a.type)

  return (
    <div className="space-y-6">
      <BackLink />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold">{a.title}</h1>
        <StatusTag status={info.tag}>{info.label}</StatusTag>
        {a.status === 'completed' && <StatusTag status="taken">Completed</StatusTag>}
        {a.status === 'cancelled' && <StatusTag status="skipped">Cancelled</StatusTag>}
      </div>

      {canWrite ? (
        <>
          <AppointmentForm
            key={a.updated_at}
            initial={a}
            timeZone={timeZone}
            submitLabel="Save changes"
            busy={update.isPending}
            error={update.error ? toApiError(update.error) : null}
            onSubmit={(input) => update.mutate({ id: a.id, input })}
          />
          {update.isSuccess && (
            <p role="status" className="text-sm text-taken-ink">
              Saved.
            </p>
          )}

          {confirmingDelete ? (
            <Card className="space-y-3">
              <p>Delete this appointment? This can't be undone. To keep a record, set its status to Cancelled instead.</p>
              <div className="flex gap-2">
                <Button
                  variant="danger"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(a.id, { onSuccess: () => navigate('/appointments') })}
                >
                  Yes, delete
                </Button>
                <Button variant="secondary" onClick={() => setConfirmingDelete(false)}>
                  Cancel
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmingDelete(true)}>
              Delete appointment
            </Button>
          )}
        </>
      ) : (
        <DetailsList appointment={a} timeZone={timeZone} />
      )}
    </div>
  )
}