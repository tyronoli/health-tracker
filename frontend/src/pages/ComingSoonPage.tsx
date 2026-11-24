import Card from '../components/Card'

export default function ComingSoonPage({ title }: { title: string }) {
  return (
    <Card>
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-muted">This screen is coming soon.</p>
    </Card>
  )
}