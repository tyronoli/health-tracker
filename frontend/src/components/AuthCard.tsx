import type { ReactNode } from 'react'

export default function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
      <div className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm">
        <h1 className="mb-4 text-xl font-semibold">{title}</h1>
        {children}
      </div>
    </div>
  )
}