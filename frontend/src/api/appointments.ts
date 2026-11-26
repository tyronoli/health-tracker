import { api } from './client'
import type { Appointment, AppointmentInput, AppointmentType, Page } from './types'

export type AppointmentQuery = { upcoming?: boolean; type?: AppointmentType; from?: string; to?: string }

export const listAppointments = (profileId: number, q: AppointmentQuery) =>
  api<Page<Appointment>>('/api/appointments/', {
    query: { profile: profileId, upcoming: q.upcoming, type: q.type, from: q.from, to: q.to, page_size: 100 },
  })

export const getAppointment = (id: number) => api<Appointment>(`/api/appointments/${id}/`)

export const createAppointment = (profileId: number, input: AppointmentInput) =>
  api<Appointment>('/api/appointments/', { method: 'POST', body: { profile: profileId, ...input } })

export const updateAppointment = (id: number, input: Partial<AppointmentInput>) =>
  api<Appointment>(`/api/appointments/${id}/`, { method: 'PATCH', body: input })

export const deleteAppointment = (id: number) => api(`/api/appointments/${id}/`, { method: 'DELETE' })