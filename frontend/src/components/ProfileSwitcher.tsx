import { useProfiles } from '../context/profile-context'

export default function ProfileSwitcher() {
  const { profiles, selected, select } = useProfiles()
  if (profiles.length < 2) return null

  return (
    <div role="group" aria-label="Whose day" className="flex flex-wrap gap-2">
      {profiles.map((profile) => {
        const active = profile.user_id === selected.user_id
        return (
          <button
            key={profile.user_id}
            type="button"
            aria-pressed={active}
            onClick={() => select(profile.user_id)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              active ? 'border-ink bg-ink text-paper' : 'border-line-strong bg-surface text-ink'
            }`}
          >
            {profile.relationship === 'self' ? 'Me' : profile.display_name}
          </button>
        )
      })}
    </div>
  )
}