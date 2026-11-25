import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDose, updateDose, type LogStatus } from '../api/doses'
import { ApiError } from '../api/client'
import type { TodayDose } from '../api/types'

/** Records a dose as taken or skipped: a POST if nothing is logged yet, a PATCH if it is. */
export function useSetDoseStatus(profileId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ dose, status }: { dose: TodayDose; status: LogStatus }) =>
      dose.dose_log_id !== null
        ? updateDose(dose.dose_log_id, status)
        : createDose({ schedule: dose.schedule, scheduled_for: dose.scheduled_for, status }),
    // Success or failure, reload the truth from the server.
    onSettled: (_data, error) => {
      void queryClient.invalidateQueries({ queryKey: ['today', profileId] })
      void queryClient.invalidateQueries({ queryKey: ['medications'] }) // pill counts change
      void queryClient.invalidateQueries({ queryKey: ['doses'] })
      if (error instanceof ApiError && (error.status === 403 || error.status === 404)) {
        void queryClient.invalidateQueries({ queryKey: ['profiles'] }) // access may have changed
      }
    },
  })
}