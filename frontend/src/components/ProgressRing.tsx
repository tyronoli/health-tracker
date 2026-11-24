const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ProgressRing({ done, total }: { done: number; total: number }) {
  const fraction = total === 0 ? 0 : Math.min(1, done / total)
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true" className="flex-none fill-none">
      <circle cx="32" cy="32" r={RADIUS} strokeWidth="7" className="stroke-on-hero opacity-30" />
      <circle
        cx="32"
        cy="32"
        r={RADIUS}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${fraction * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
        transform="rotate(-90 32 32)"
        className="stroke-on-hero"
      />
    </svg>
  )
}