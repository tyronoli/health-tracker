import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'danger'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }

const base =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50'

const variants: Record<Variant, string> = {
  primary: 'border-accent bg-accent text-on-accent hover:opacity-90',
  secondary: 'border-line-strong bg-surface text-accent-ink hover:bg-accent-soft',
  danger: 'border-missed-ink bg-surface text-missed-ink hover:bg-missed-bg',
}

export default function Button({ variant = 'primary', className = '', type = 'button', ...props }: Props) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />
}