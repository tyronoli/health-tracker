import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createMedication,
  createSchedule,
  deleteSchedule,
  refillMedication,
  stopMedication,
  updateMedication,
  updateSchedule,
} from '../api/medications'
import type { MedicationInput, ScheduleInput } from '../api/types'
import { invalidateMedicationData } from './useMedications'

// Every change refreshes the data it affects, whether it succeeded or failed.
function useChange<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn, onSettled: () => invalidateMedicationData(queryClient) })
}

export const useCreateMedication = () =>
  useChange(({ profileId, input }: { profileId: number; input: MedicationInput }) =>
    createMedication(profileId, input),
  )

export const useUpdateMedication = () =>
  useChange(({ id, changes }: { id: number; changes: Partial<MedicationInput> & { active?: boolean } }) =>
    updateMedication(id, changes),
  )

export const useStopMedication = () => useChange((id: number) => stopMedication(id))

export const useRefill = () =>
  useChange(({ id, pillsAdded }: { id: number; pillsAdded: number }) => refillMedication(id, pillsAdded))

export const useCreateSchedule = () =>
  useChange(({ medicationId, input }: { medicationId: number; input: ScheduleInput }) =>
    createSchedule(medicationId, input),
  )

export const useUpdateSchedule = () =>
  useChange(({ id, changes }: { id: number; changes: Partial<ScheduleInput> }) => updateSchedule(id, changes))

export const useDeleteSchedule = () => useChange((id: number) => deleteSchedule(id))