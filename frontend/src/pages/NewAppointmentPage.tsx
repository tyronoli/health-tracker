import { Link, useNavigate } from 'react-router'
import { toApiError } from '../api/client'
import AppointmentForm from '../components/AppointmentForm'
import Card from '../components/Card'
import ProfileNote from '../components/ProfileNote'
import { useProfiles } from '../context/profile-context'
import { useCreateAppointment } from '../hooks/useAppointmentMutations'

export default function NewAppointmentPage() {
  const { selected, canWrite } = useProfiles()
  const navigate = useNavigate()
  const create = useCreateAppointment()

  return (
    <div className="space-y-4">
      <Link to="/appointments" className="text-sm font-medium text-accent-ink underline">
        ← Appointments
      </Link>
      <h1 className="font-display text-3xl font-bold">New appointment</h1>
      <ProfileNote noun="appointments" />

      {canWrite ? (
        <AppointmentForm
          timeZone={selected.timezone}
          submitLabel="Save appointment"
          busy={create.isPending}
          error={create.error ? toApiError(create.error) : null}
          onSubmit={(input) =>
            create.mutate(
              { profileId: selected.user_id, input },
              { onSuccess: () => navigate('/appointments') },
            )
          }
        />
      ) : (
        <Card>
          <p>You have view-only access to {selected.display_name}, so you can't add appointments for them.</p>
        </Card>
      )}
    </div>
  )
}