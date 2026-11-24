export type User = {
    id: number
    email: string
    display_name: string
    timezone: string
}

export type RegisterInput = {
    email: string
    password: string
    display_name: string
    timezone: string
}

export type Profile = {
  user_id: number
  display_name: string
  relationship: 'self' | 'recipient'
  permission: 'view' | 'edit'
}

export type DoseStatus = 'pending' | 'taken' | 'skipped' | 'missed'

export type TodayDose = {
  schedule: number
  medication: { id: number; name: string; dosage: string }
  scheduled_for: string
  status: DoseStatus
  dose_log_id: number | null
  logged_at: string | null
  pills_per_dose: number
}

export type TodayResponse = { date: string; timezone: string; doses: TodayDose[] }