import { useId } from 'react'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  required?: boolean
  error?: string
  hint?: string
  multiline?: boolean
  inputMode?: 'numeric' | 'text'
  min?: number
  max?: number
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent'

export default function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required,
  error,
  hint,
  multiline,
  inputMode,
  min,
  max,
}: Props) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : '', error ? errorId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          required={required}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          autoComplete={autoComplete}
          required={required}
          inputMode={inputMode}
          min={min}
          max={max}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClass}
        />
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-sm text-missed-ink">
          {error}
        </p>
      )}
    </div>
  )
}