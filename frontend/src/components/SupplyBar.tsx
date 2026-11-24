export default function SupplyBar({ fraction, low }: { fraction: number; low: boolean }) {
  return (
    <div aria-hidden="true" className="my-3 h-2 overflow-hidden rounded-full bg-skipped-bg">
      <div
        className={`h-full rounded-full ${low ? 'bg-low-ink' : 'bg-accent'}`}
        style={{ width: `${Math.round(fraction * 100)}%` }}
      />
    </div>
  )
}