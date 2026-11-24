import { useState, type FormEvent } from 'react'
import { fieldError, type ApiError } from '../api/client'
import type { Medication, MedicationInput } from '../api/types'
import Button from './Button'
import FormError from './FormError'
import TextField from './TextField'

type Props = {
  initial?: Medication
  submitLabel: string
  busy: boolean
  error: ApiError | null
  onSubmit: (input: MedicationInput) => void
}

export default function MedicationForm({ initial, submitLabel, busy, error, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [dosage, setDosage] = useState(initial?.dosage ?? '')
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [pills, setPills] = useState(initial ? String(initial.pills_remaining) : '')
  const [threshold, setThreshold] = useState(initial ? String(initial.refill_threshold) : '')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onSubmit({
      name,
      dosage,
      instructions,
      pills_remaining: Number(pills || 0),
      refill_threshold: Number(threshold || 0),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError error={error} />
      <TextField label="Name" required value={name} onChange={setName} error={fieldError(error, 'name')} />
      <TextField
        label="Dosage"
        hint="For example 500 mg"
        value={dosage}
        onChange={setDosage}
        error={fieldError(error, 'dosage')}
      />
      <TextField
        label="Instructions"
        hint="For example: take with food"
        multiline
        value={instructions}
        onChange={setInstructions}
        error={fieldError(error, 'instructions')}
      />
      <TextField
        label="Pills in stock"
        type="number"
        inputMode="numeric"
        min={0}
        value={pills}
        onChange={setPills}
        error={fieldError(error, 'pills_remaining')}
      />
      <TextField
        label="Low-supply alert at"
        type="number"
        inputMode="numeric"
        min={0}
        hint="You are warned when the pills left reach this number or fewer"
        value={threshold}
        onChange={setThreshold}
        error={fieldError(error, 'refill_threshold')}
      />
      <Button type="submit" className="w-full" disabled={busy}>
        {submitLabel}
      </Button>
    </form>
  )
}