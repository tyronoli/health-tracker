import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { fieldError, toApiError, type ApiError } from '../api/client'
import AuthCard from '../components/AuthCard'
import FormError from '../components/FormError'
import TextField from '../components/TextField'
import { useAuth } from '../context/auth-context'

export default function LoginPage() {
  const { user, login } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<ApiError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    const from = typeof location.state?.from === 'string' ? location.state.from : '/'
    return <Navigate to={from} replace />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password)
    } catch (err) {
      setError(toApiError(err))
      setSubmitting(false)
    }
  }

  return (
    <AuthCard title="Log in">
      <form onSubmit={handleSubmit} className="space-y-4">
        <FormError error={error} />
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
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          error={fieldError(error, 'password')}
        />
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Log in
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-600">
        No account yet?{' '}
        <Link to="/register" className="text-blue-600 hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  )
}