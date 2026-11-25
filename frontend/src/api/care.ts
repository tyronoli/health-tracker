import { api } from './client'
import type { CareLink, Page, Permission } from './types'

export const listCareLinks = () => api<Page<CareLink>>('/api/care-links/', { query: { page_size: 100 } })

export const inviteToCare = (email: string, permission: Permission) =>
  api<{ message: string }>('/api/care-links/', { method: 'POST', body: { email, permission } })

export const acceptInvite = (id: number, permission?: Permission) =>
  api<CareLink>(`/api/care-links/${id}/accept/`, { method: 'POST', body: permission ? { permission } : {} })

export const declineInvite = (id: number) => api<CareLink>(`/api/care-links/${id}/decline/`, { method: 'POST' })

export const revokeLink = (id: number) => api<CareLink>(`/api/care-links/${id}/revoke/`, { method: 'POST' })

export const changeLinkPermission = (id: number, permission: Permission) =>
  api<CareLink>(`/api/care-links/${id}/`, { method: 'PATCH', body: { permission } })