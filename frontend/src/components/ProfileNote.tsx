import { useProfiles } from '../context/profile-context'
import StatusTag from './StatusTag'

export default function ProfileNote({ noun }: { noun: string }) {
  const { selected, canWrite } = useProfiles()
  if (selected.relationship === 'self') return null
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
      Viewing {selected.display_name}'s {noun}
      {canWrite ? (
        <StatusTag status="taken">Can edit</StatusTag>
      ) : (
        <StatusTag status="skipped">View only</StatusTag>
      )}
    </p>
  )
}