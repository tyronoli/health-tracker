import { useQuery, type QueryClient } from '@tanstack/react-query'
import { getMedication, listMedications } from '../api/medications'

export const medicationKeys = {
  all: ['medications'] as const,
  list: (profileId: number, active: boolean) => ['medications', 'list', profileId, active] as const,
  detail: (id: number) => ['medications', 'detail', id] as const,
}

/** Medications, pills and doses all change together, so refresh both screens' data. */
export function invalidateMedicationData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: medicationKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['today'] }),
  ])
}

export function useMedications(profileId: number, active: boolean) {
  return useQuery({
    queryKey: medicationKeys.list(profileId, active),
    queryFn: () => listMedications(profileId, active),
  })
}

export function useMedication(id: number) {
  return useQuery({
    queryKey: medicationKeys.detail(id),
    queryFn: () => getMedication(id),
    enabled: Number.isInteger(id),
  })
}