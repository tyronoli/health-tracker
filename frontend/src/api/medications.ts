import { api } from './client'
import type { Medication, MedicationInput, Page, Schedule, ScheduleInput } from './types'

export const listMedications = (profileId: number, active?: boolean) =>
  api<Page<Medication>>('/api/medications/', { query: { profile: profileId, active, page_size: 100 } })

export const getMedication = (id: number) => api<Medication>(`/api/medications/${id}/`)

export const createMedication = (profileId: number, input: MedicationInput) =>
  api<Medication>('/api/medications/', { method: 'POST', body: { profile: profileId, ...input } })

export const updateMedication = (id: number, changes: Partial<MedicationInput> & { active?: boolean }) =>
  api<Medication>(`/api/medications/${id}/`, { method: 'PATCH', body: changes })

export const stopMedication = (id: number) => api(`/api/medications/${id}/`, { method: 'DELETE' })

export const refillMedication = (id: number, pillsAdded: number) =>
  api<Medication>(`/api/medications/${id}/refill/`, { method: 'POST', body: { pills_added: pillsAdded } })

export const createSchedule = (medicationId: number, input: ScheduleInput) =>
  api<Schedule>(`/api/medications/${medicationId}/schedules/`, { method: 'POST', body: input })

export const updateSchedule = (id: number, changes: Partial<ScheduleInput>) =>
  api<Schedule>(`/api/schedules/${id}/`, { method: 'PATCH', body: changes })

export const deleteSchedule = (id: number) => api(`/api/schedules/${id}/`, { method: 'DELETE' })