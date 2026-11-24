import { useState } from 'react'
import { toApiError } from '../api/client'
import type { Medication, Schedule } from '../api/types'
import { useCreateSchedule, useDeleteSchedule, useUpdateSchedule } from '../hooks/useMedicationMutations'
import { formatShortDate } from '../lib/format'
import { describeDays, pillsText } from '../lib/medication'
import Button from './Button'
import ScheduleForm from './ScheduleForm'
import StatusTag from './StatusTag'

function ScheduleRow({
  schedule: s,
  canWrite,
  confirming,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  schedule: Schedule
  canWrite: boolean
  confirming: boolean
  onEdit: () => void
  onAskDelete: () => void
  onCancelDelete: () => void
  onDelete: () => void
}) {
  const dates = `From ${formatShortDate(s.start_date)}${s.end_date ? ` until ${formatShortDate(s.end_date)}` : ''}`
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p>
            <span className="font-semibold">{s.time_of_day}</span>{' '}
            <span className="text-sm text-muted">
              {describeDays(s.days_of_week)} · {pillsText(s.pills_per_dose)} per dose
            </span>
          </p>
          <p className="text-sm text-muted">{dates}</p>
        </div>
        {!s.active && <StatusTag status="skipped">Paused</StatusTag>}
      </div>
      {canWrite &&
        (confirming ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">Delete this schedule? Past doses stay in your history.</p>
            <div className="flex gap-2">
              <Button variant="danger" className="min-h-9 px-3 text-sm" onClick={onDelete}>
                Yes, delete
              </Button>
              <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={onCancelDelete}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="min-h-9 px-3 text-sm" aria-label={`Edit ${s.time_of_day} schedule`} onClick={onEdit}>
              Edit
            </Button>
            <Button variant="danger" className="min-h-9 px-3 text-sm" aria-label={`Delete ${s.time_of_day} schedule`} onClick={onAskDelete}>
              Delete
            </Button>
          </div>
        ))}
    </li>
  )
}

export default function ScheduleSection({ medication, canWrite }: { medication: Medication; canWrite: boolean }) {
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const create = useCreateSchedule()
  const update = useUpdateSchedule()
  const remove = useDeleteSchedule()

  const active = editing === 'new' ? create : update
  const formError = active.error ? toApiError(active.error) : null
  const close = () => {
    setEditing(null)
    create.reset()
    update.reset()
  }

  return (
    <section aria-labelledby="schedules-title" className="space-y-3">
      <h2 id="schedules-title" className="font-display text-xl font-bold">
        Schedules
      </h2>

      {medication.schedules.length === 0 && editing !== 'new' && (
        <p className="text-sm text-muted">
          {canWrite
            ? "No schedule yet. Add one so this medication's doses show up on Today."
            : 'No schedule yet.'}
        </p>
      )}

      <ul className="space-y-3">
        {medication.schedules.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <ScheduleForm
                initial={s}
                busy={update.isPending}
                error={formError}
                onCancel={close}
                onSubmit={(input) => update.mutate({ id: s.id, changes: input }, { onSuccess: close })}
              />
            </li>
          ) : (
            <ScheduleRow
              key={s.id}
              schedule={s}
              canWrite={canWrite}
              confirming={confirmingId === s.id}
              onEdit={() => {
                close()
                setEditing(s.id)
              }}
              onAskDelete={() => setConfirmingId(s.id)}
              onCancelDelete={() => setConfirmingId(null)}
              onDelete={() => remove.mutate(s.id, { onSettled: () => setConfirmingId(null) })}
            />
          ),
        )}
      </ul>

      {canWrite &&
        (editing === 'new' ? (
          <ScheduleForm
            busy={create.isPending}
            error={formError}
            onCancel={close}
            onSubmit={(input) => create.mutate({ medicationId: medication.id, input }, { onSuccess: close })}
          />
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => { close(); setEditing('new') }}>
            Add a schedule
          </Button>
        ))}
    </section>
  )
}