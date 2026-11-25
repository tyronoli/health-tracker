import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { HistoryFilters } from '../api/history'
import type { DoseLogStatus } from '../api/types'

export const STATUSES: DoseLogStatus[] = ['taken', 'skipped', 'missed']

const isStatus = (value: string | null): value is DoseLogStatus => STATUSES.includes(value as DoseLogStatus)
const asDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined)

export type FilterKey = 'status' | 'medication' | 'from' | 'to'

export function useHistoryFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<HistoryFilters>(() => {
    const status = params.get('status')
    const medication = Number(params.get('medication'))
    return {
      status: isStatus(status) ? status : undefined,
      medication: params.get('medication') && Number.isInteger(medication) ? medication : undefined,
      from: asDate(params.get('from')),
      to: asDate(params.get('to')),
    }
  }, [params])

  function setFilter(key: FilterKey, value: string | undefined) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const hasFilters = Object.values(filters).some((value) => value !== undefined)
  const clear = () => setParams(new URLSearchParams(), { replace: true })

  return { filters, setFilter, clear, hasFilters }
}