import type { ApiError } from '../api/client'

/** Shows the general message. Field-level errors are shown under their inputs instead. */
export default function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.code === 'validation_error' && Object.keys(error.fields).length > 0) return null
  return (
    <p role="alert" className="rounded-xl bg-missed-bg px-3 py-2 text-sm text-missed-ink">
      {error.message}
    </p>
  )
}