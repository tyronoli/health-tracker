import type { ApiError } from '../api/client'

/** Shows the general message. Field-level errors are shown under their inputs instead. */
export default function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null
  if (error.code === 'validation_error' && Object.keys(error.fields).length > 0) return null
  return (
    <p role="alert" className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
      {error.message}
    </p>
  )
}