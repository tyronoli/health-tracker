import { Link, useNavigate } from 'react-router'
import { toApiError } from '../api/client'
import Card from '../components/Card'
import MedicationForm from '../components/MedicationForm'
import ProfileNote from '../components/ProfileNote'
import { useProfiles } from '../context/profile-context'
import { useCreateMedication } from '../hooks/useMedicationMutations'

export default function NewMedicationPage() {
  const { selected, canWrite } = useProfiles()
  const navigate = useNavigate()
  const create = useCreateMedication()

  return (
    <div className="space-y-4">
      <Link to="/medications" className="text-sm font-medium text-accent-ink underline">
        ← Medications
      </Link>
      <h1 className="font-display text-3xl font-bold">Add a medication</h1>
      <ProfileNote noun="medications" />

      {canWrite ? (
        <MedicationForm
          submitLabel="Save medication"
          busy={create.isPending}
          error={create.error ? toApiError(create.error) : null}
          onSubmit={(input) =>
            create.mutate(
              { profileId: selected.user_id, input },
              { onSuccess: (created) => navigate(`/medications/${created.id}`) },
            )
          }
        />
      ) : (
        <Card>
          <p>You have view-only access to {selected.display_name}, so you can't add medications for them.</p>
        </Card>
      )}
    </div>
  )
}