import { useId } from 'react'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  required?: boolean
  error?: string
}

export default function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  required,
  error,
}: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
      />
      {error && (
        <p role="alert" className="mt-1 text-sm text-missed-ink">
          {error}
        </p>
      )}
    </div>
  )
}