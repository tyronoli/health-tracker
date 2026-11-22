import { api } from './client'
import type { RegisterInput, User } from './types'

export const getMe = () => api<User>('/api/auth/me/')

export const login = (email: string, password: string) =>
    api<User>('/api/auth/login/', { method: 'POST', body: { email, password } })

export const register = (input: RegisterInput) =>
    api<User>('/api/auth/register/', { method: 'POST', body: input })

export const logout = () => api('/api/auth/logout/', { method: 'POST' })