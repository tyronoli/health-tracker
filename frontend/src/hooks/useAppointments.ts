import { useQuery } from '@tanstack/react-query'
import { getAppointment, listAppointments, type AppointmentQuery } from '../api/appointments'

export const appointmentKeys = {
  all: ['appointments'] as const,
  list: (profileId: number, q: AppointmentQuery) => ['appointments', 'list', profileId, q] as const,
  detail: (id: number) => ['appointments', 'detail', id] as const,
}

export function useAppointments(profileId: number, q: AppointmentQuery) {
  return useQuery({
    queryKey: appointmentKeys.list(profileId, q),
    queryFn: () => listAppointments(profileId, q),
  })
}

export function useAppointment(id: number) {
  return useQuery({
    queryKey: appointmentKeys.detail(id),
    queryFn: () => getAppointment(id),
    enabled: Number.isInteger(id),
  })
}