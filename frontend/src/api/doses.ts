import { api } from './client'
import type { TodayResponse } from './types'

export type LogStatus = 'taken' | 'skipped'

export const getToday = (profileId: number) =>
  api<TodayResponse>('/api/doses/today/', { query: { profile: profileId } })

export const createDose = (input: { schedule: number; scheduled_for: string; status: LogStatus }) =>
  api<{ id: number }>('/api/doses/', { method: 'POST', body: input })

export const updateDose = (id: number, status: LogStatus) =>
  api<{ id: number }>(`/api/doses/${id}/`, { method: 'PATCH', body: { status } })