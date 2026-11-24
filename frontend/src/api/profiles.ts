import { api } from './client'
import type { Profile } from './types'

export const getProfiles = () => api<Profile[]>('/api/profiles/')