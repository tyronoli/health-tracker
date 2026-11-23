import type { ReactNode } from 'react'

export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 text-ink">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <h1 className="mb-4 font-display text-2xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  )
}