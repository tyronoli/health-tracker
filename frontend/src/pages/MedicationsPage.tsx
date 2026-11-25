import { useState } from 'react'
import { Link } from 'react-router'
import MedicationCard from '../components/MedicationCard'
import ProfileNote from '../components/ProfileNote'
import ProfileSwitcher from '../components/ProfileSwitcher'
import QueryError from '../components/QueryError'
import { useProfiles } from '../context/profile-context'
import { useMedications } from '../hooks/useMedications'
import FilterChip from '../components/FilterChip'

export default function MedicationsPage() {
  const { selected, canWrite } = useProfiles()
  const [showStopped, setShowStopped] = useState(false)
  const query = useMedications(selected.user_id, !showStopped)
  const medications = query.data?.results ?? []

  return (
    <div className="space-y-4">
      <header>
        <p className="text-sm text-muted">
          {query.data ? `${query.data.count} ${showStopped ? 'stopped' : 'active'}` : '\u00a0'}
        </p>
        <h1 className="font-display text-3xl font-bold">Medications</h1>
      </header>

      <ProfileSwitcher />
      <ProfileNote noun="medications" />

      <div role="group" aria-label="Which medications" className="flex gap-2">
        <FilterChip label="Active" active={!showStopped} onClick={() => setShowStopped(false)} />
        <FilterChip label="Stopped" active={showStopped} onClick={() => setShowStopped(true)} />
      </div>

      {query.isPending && <p className="text-muted">Loading medications…</p>}
      {query.isError && (
        <QueryError message="We couldn't load the medications." onRetry={() => void query.refetch()} />
      )}

      {query.data &&
        (medications.length === 0 ? (
          <p className="text-sm text-muted">
            {showStopped
              ? 'No stopped medications.'
              : canWrite
                ? 'No medications yet. Tap Add medication to start.'
                : 'No medications yet.'}
          </p>
        ) : (
          <ul className="space-y-3">
            {medications.map((m) => (
              <li key={m.id}>
                <MedicationCard medication={m} canWrite={canWrite} />
              </li>
            ))}
          </ul>
        ))}

      {canWrite && !showStopped && (
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-10">
          <div className="mx-auto flex max-w-3xl justify-end px-4">
            <Link
              to="/medications/new"
              className="pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-xl border border-accent bg-accent px-4 font-semibold text-on-accent shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current stroke-[3]">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
              Add medication
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}