import { api } from './client'
import type { DoseLogEntry, DoseLogStatus, Page } from './types'

export type HistoryFilters = {
  status?: DoseLogStatus
  medication?: number
  from?: string
  to?: string
}

export const PAGE_SIZE = 30

export const listDoses = (profileId: number, filters: HistoryFilters, pageNumber: number) =>
  api<Page<DoseLogEntry>>('/api/doses/', {
    query: {
      profile: profileId,
      status: filters.status,
      medication: filters.medication,
      from: filters.from,
      to: filters.to,
      page: pageNumber,
      page_size: PAGE_SIZE,
    },
  })