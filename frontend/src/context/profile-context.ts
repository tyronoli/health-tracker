import { createContext, useContext } from 'react'
import type { Profile } from '../api/types'

export type ProfileContextValue = {
  profiles: Profile[]
  selected: Profile
  select: (id: number) => void
  canWrite: boolean
}

export const ProfileContext = createContext<ProfileContextValue | null>(null)

export function useProfiles(): ProfileContextValue {
  const value = useContext(ProfileContext)
  if (!value) throw new Error('useProfiles must be used inside <ProfileProvider>')
  return value
}