import { useAuth } from '../context/auth-context'

export default function HomePage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold">Welcome</h1>
      <p>Signed in as {user.email}</p>
      <p className="text-sm text-slate-500">Timezone: {user.timezone}</p>
    </div>
  )
}