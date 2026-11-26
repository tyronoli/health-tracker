import { Link } from 'react-router'

export default function FloatingAddLink({ to, label }: { to: string; label: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10">
      <div className="mx-auto flex max-w-3xl justify-end px-4">
        <Link
          to={to}
          className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-xl border border-accent bg-accent px-4 font-semibold text-on-accent shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[3]">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          {label}
        </Link>
      </div>
    </div>
  )
}