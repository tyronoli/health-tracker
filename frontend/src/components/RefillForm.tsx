import { useState, type FormEvent } from 'react'
import { fieldError, toApiError } from '../api/client'
import type { Medication } from '../api/types'
import { useRefill } from '../hooks/useMedicationMutations'
import Button from './Button'
import FormError from './FormError'
import TextField from './TextField'

export default function RefillForm({ medication, onDone }: { medication: Medication; onDone?: () => void }) {
  const refill = useRefill()
  const [amount, setAmount] = useState('')
  const error = refill.error ? toApiError(refill.error) : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    refill.mutate(
      { id: medication.id, pillsAdded: Number(amount) },
      {
        onSuccess: () => {
          setAmount('')
          onDone?.()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <TextField
        label="Pills added"
        type="number"
        inputMode="numeric"
        min={1}
        max={10000}
        required
        value={amount}
        onChange={setAmount}
        error={fieldError(error, 'pills_added')}
      />
      <FormError error={error} />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={refill.isPending}>
          Add pills
        </Button>
        {onDone && (
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}