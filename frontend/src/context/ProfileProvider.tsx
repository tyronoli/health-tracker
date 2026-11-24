import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { getProfiles } from '../api/profiles'
import Button from '../components/Button'
import { ProfileContext, type ProfileContextValue } from './profile-context'

const STORAGE_KEY = 'ht-profile'

function loadStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const id = raw === null ? Number.NaN : Number(raw)
    return Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const query = useQuery({ queryKey: ['profiles'], queryFn: getProfiles, staleTime: 60_000 })
  const [storedId, setStoredId] = useState<number | null>(loadStoredId)

  const profiles = useMemo(() => query.data ?? [], [query.data])
  // A stored id that is no longer in the list (access ended) falls back to yourself.
  const selected =
    profiles.find((p) => p.user_id === storedId) ?? profiles.find((p) => p.relationship === 'self')

  const select = useCallback((id: number) => {
    setStoredId(id)
    try {
      localStorage.setItem(STORAGE_KEY, String(id))
    } catch {
      // Storage can be blocked; the choice still works for this visit.
    }
  }, [])

  const value = useMemo<ProfileContextValue | null>(
    () =>
      selected
        ? {
            profiles,
            selected,
            select,
            canWrite: selected.relationship === 'self' || selected.permission === 'edit',
            canWriteTo: (userId: number) => {
              const profile = profiles.find((p) => p.user_id === userId)
              return !!profile && (profile.relationship === 'self' || profile.permission === 'edit')
            },
          }
        : null,
    [profiles, selected, select],
  )

  if (query.isPending) return <p className="text-muted">Loading…</p>
  if (query.isError || !value) {
    return (
      <div role="alert" className="space-y-3 rounded-2xl bg-missed-bg p-4 text-missed-ink">
        <p>We couldn't load your profiles.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    )
  }
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}