import type { ReactNode } from 'react'

export type Status = 'taken' | 'missed' | 'low' | 'skipped' | 'info'

const styles: Record<Status, string> = {
  taken: 'bg-taken-bg text-taken-ink',
  missed: 'bg-missed-bg text-missed-ink',
  low: 'bg-low-bg text-low-ink',
  skipped: 'bg-skipped-bg text-skipped-ink',
  info: 'bg-info-bg text-info-ink',
}

export default function StatusTag({ status, children }: { status: Status; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}
    >
      {children}
    </span>
  )
}