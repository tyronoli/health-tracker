import { useState } from 'react'
import MedicationCard from '../components/MedicationCard'
import ProfileNote from '../components/ProfileNote'
import ProfileSwitcher from '../components/ProfileSwitcher'
import QueryError from '../components/QueryError'
import { useProfiles } from '../context/profile-context'
import { useMedications } from '../hooks/useMedications'
import FilterChip from '../components/FilterChip'
import FloatingAddLink from '../components/FloatingAddLink'

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

            {canWrite && !showStopped && <FloatingAddLink to="/medications/new" label="Add medication" />}
    </div>
  )
}