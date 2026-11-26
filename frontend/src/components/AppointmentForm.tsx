import { useState, type FormEvent } from 'react'
import { fieldError, type ApiError } from '../api/client'
import type { Appointment, AppointmentInput, AppointmentStatus, AppointmentType } from '../api/types'
import { APPOINTMENT_TYPES, STATUS_OPTIONS, zonedToUtcIso } from '../lib/appointments'
import { formatTime, localDate } from '../lib/format'
import Button from './Button'
import FormError from './FormError'
import SelectField from './SelectField'
import TextField from './TextField'

type Props = {
  initial?: Appointment
  timeZone: string // the appointment owner's timezone: times are typed and shown in it
  submitLabel: string
  busy: boolean
  error: ApiError | null
  onSubmit: (input: AppointmentInput) => void
}

export default function AppointmentForm({ initial, timeZone, submitLabel, busy, error, onSubmit }: Props) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [type, setType] = useState<AppointmentType>(initial?.type ?? 'checkup')
  const [date, setDate] = useState(() =>
    localDate(initial?.starts_at ?? new Date().toISOString(), timeZone),
  )
  const [time, setTime] = useState(() => (initial ? formatTime(initial.starts_at, timeZone) : '09:00'))
  const [duration, setDuration] = useState(String(initial?.duration_minutes ?? ''))
  const [provider, setProvider] = useState(initial?.provider_name ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [preparation, setPreparation] = useState(initial?.preparation ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [status, setStatus] = useState<AppointmentStatus>(initial?.status ?? 'scheduled')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      title,
      type,
      provider_name: provider,
      location,
      starts_at: zonedToUtcIso(date, time, timeZone),
      duration_minutes: duration === '' ? null : Number(duration),
      preparation,
      notes,
      ...(initial ? { status } : {}),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError error={error} />
      <TextField label="Title" required value={title} onChange={setTitle} error={fieldError(error, 'title')} />
      <SelectField
        label="Type"
        value={type}
        onChange={(value) => setType(value as AppointmentType)}
        options={APPOINTMENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Date" type="date" required value={date} onChange={setDate} />
        <TextField
          label="Time"
          type="time"
          required
          value={time}
          onChange={setTime}
          error={fieldError(error, 'starts_at')}
        />
      </div>
      <p className="-mt-2 text-xs text-muted">{`Times are in ${timeZone}.`}</p>
      <TextField
        label="Duration (minutes, optional)"
        type="number"
        inputMode="numeric"
        min={1}
        max={1440}
        value={duration}
        onChange={setDuration}
        error={fieldError(error, 'duration_minutes')}
      />
      <TextField label="Provider" value={provider} onChange={setProvider} error={fieldError(error, 'provider_name')} />
      <TextField label="Location" value={location} onChange={setLocation} error={fieldError(error, 'location')} />
      <TextField
        label="Preparation"
        hint="Write what your clinic told you, for example: no food for 6 hours"
        multiline
        value={preparation}
        onChange={setPreparation}
        error={fieldError(error, 'preparation')}
      />
      <TextField label="Notes" multiline value={notes} onChange={setNotes} error={fieldError(error, 'notes')} />
      {initial && (
        <SelectField
          label="Status"
          value={status}
          onChange={(value) => setStatus(value as AppointmentStatus)}
          options={STATUS_OPTIONS}
        />
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  )
}