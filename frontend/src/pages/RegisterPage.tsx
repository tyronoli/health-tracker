import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { fieldError, toApiError, type ApiError } from '../api/client'
import AuthCard from '../components/AuthCard'
import FormError from '../components/FormError'
import TextField from '../components/TextField'
import Button from '../components/Button'
import { useAuth } from '../context/auth-context'

const browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const zones = Array.from(new Set([browserZone, 'UTC', ...Intl.supportedValuesOf('timeZone')])).sort()

export default function RegisterPage() {
  const { user, register } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [timezone, setTimezone] = useState(browserZone)
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await register({ email, password, display_name: displayName, timezone })
    } catch (err) {
      setError(toApiError(err))
      setSubmitting(false)
    }
  }

  const timezoneProblem = fieldError(error, 'timezone')

  return (
    <AuthCard title="Create your account">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError error={error} />
        <TextField
          label="Display name"
          autoComplete="name"
          value={displayName}
          onChange={setDisplayName}
          error={fieldError(error, 'display_name')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={setEmail}
          error={fieldError(error, 'email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={setPassword}
          error={fieldError(error, 'password')}
        />
        <div>
          <label htmlFor="timezone" className="block text-sm font-medium text-ink">
            Timezone
          </label>
          <select
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
          {timezoneProblem && (
            <p role="alert" className="mt-1 text-sm text-missed-ink">
              {timezoneProblem}
            </p>
          )}
        </div>
        <Button type="submit" disabled={submitting} className="w-full">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        Already registered?{' '}
        <Link to="/login" className="text-blue-600 hover:underline">
          Log in
        </Link>
      </p>
    </AuthCard>
  )
}