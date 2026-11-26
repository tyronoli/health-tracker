import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createAppointment, deleteAppointment, updateAppointment } from '../api/appointments'
import type { AppointmentInput } from '../api/types'
import { appointmentKeys } from './useAppointments'

function useChange<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: appointmentKeys.all }),
  })
}

export const useCreateAppointment = () =>
  useChange(({ profileId, input }: { profileId: number; input: AppointmentInput }) =>
    createAppointment(profileId, input),
  )

export const useUpdateAppointment = () =>
  useChange(({ id, input }: { id: number; input: Partial<AppointmentInput> }) => updateAppointment(id, input))

export const useDeleteAppointment = () => useChange((id: number) => deleteAppointment(id))