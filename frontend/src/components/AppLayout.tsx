import { Outlet } from 'react-router'
import { useAuth } from '../context/auth-context'

export default function AppLayout() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-semibold">Health Tracker</span>
          <div className="flex items-center gap-3 text-sm">
            <span>{user?.display_name || user?.email}</span>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded border px-3 py-1 hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}