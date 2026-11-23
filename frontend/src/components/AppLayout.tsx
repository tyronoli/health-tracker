import { Link, Outlet } from 'react-router'
import { useAuth } from '../context/auth-context'
import Button from './Button'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const initial = (user?.display_name || user?.email || '?').charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-nav">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <span className="font-display text-lg font-bold">Health Tracker</span>
          <div className="flex items-center gap-3">
            <Button variant="secondary" className="min-h-9 px-3 text-sm" onClick={() => void logout()}>
              Log out
            </Button>
            <Link
              to="/settings/appearance"
              aria-label="Appearance settings"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-accent font-semibold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {initial}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}