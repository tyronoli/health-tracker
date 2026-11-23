import Card from '../components/Card'
import { useAuth } from '../context/auth-context'

export default function HomePage() {
  const { user } = useAuth()
  if (!user) return null
  return (
    <Card className="space-y-1">
      <h1 className="font-display text-xl font-bold">Welcome</h1>
      <p>Signed in as {user.email}</p>
      <p className="text-sm text-muted">Timezone: {user.timezone}</p>
    </Card>
  )
}