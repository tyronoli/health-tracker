import { useState, type FormEvent } from 'react'
import { fieldError, toApiError } from '../api/client'
import type { Permission } from '../api/types'
import { useInvite } from '../hooks/useCare'
import Button from './Button'
import Card from './Card'
import FormError from './FormError'
import TextField from './TextField'

const CHOICES: { value: Permission; label: string }[] = [
  { value: 'view', label: 'View only' },
  { value: 'edit', label: 'Can edit' },
]

export default function InviteForm() {
  const invite = useInvite()
  const [email, setEmail] = useState('')
  const [permission, setPermission] = useState<Permission>('view')
  const error = invite.error ? toApiError(invite.error) : null

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    invite.mutate({ email, permission }, { onSuccess: () => setEmail('') })
  }

  return (
    <Card>
      <h2 className="font-display text-xl font-bold">Ask to see someone's profile</h2>
      <p className="mt-1 text-sm text-muted">
        Enter their email. If they have an account, they get a request and can accept it.
      </p>
      <form onSubmit={handleSubmit} className="mt-3 space-y-3">
        <FormError error={error} />
        <TextField
          label="Their email"
          type="email"
          required
          value={email}
          onChange={setEmail}
          error={fieldError(error, 'email')}
        />
        <fieldset>
          <legend className="block text-sm font-medium text-ink">Access you are asking for</legend>
          <div className="mt-1 flex gap-4">
            {CHOICES.map((choice) => (
              <label key={choice.value} className="flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="permission"
                  value={choice.value}
                  checked={permission === choice.value}
                  onChange={() => setPermission(choice.value)}
                  className="h-5 w-5 accent-accent"
                />
                {choice.label}
              </label>
            ))}
          </div>
        </fieldset>
        <Button type="submit" className="w-full" disabled={invite.isPending}>
          Send request
        </Button>
        {invite.isSuccess && (
          <p role="status" className="text-sm text-muted">
            {invite.data.message}
          </p>
        )}
      </form>
    </Card>
  )
}