import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../context/auth-context'

export default function RequireAuth() {
  const { user, status } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <p className="p-6 text-slate-500">Loading…</p>
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}