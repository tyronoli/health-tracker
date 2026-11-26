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
  timezone: string
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

export type Schedule = {
  id: number
  medication: number
  time_of_day: string
  days_of_week: number[]
  start_date: string
  end_date: string | null
  pills_per_dose: number
  active: boolean
}

export type Medication = {
  id: number
  owner: number
  name: string
  dosage: string
  instructions: string
  pills_remaining: number
  refill_threshold: number
  active: boolean
  low_supply: boolean
  days_supply_left: number | null
  schedules: Schedule[]
  created_at: string
  updated_at: string
}

export type MedicationInput = {
  name: string
  dosage: string
  instructions: string
  pills_remaining: number
  refill_threshold: number
}

export type ScheduleInput = {
  time_of_day: string
  days_of_week: number[]
  start_date: string
  end_date: string | null
  pills_per_dose: number
  active: boolean
}

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }

export type Permission = 'view' | 'edit'

export type DoseLogStatus = 'taken' | 'skipped' | 'missed'

export type DoseLogEntry = {
  id: number
  medication: number
  schedule: number | null
  scheduled_for: string
  status: DoseLogStatus
  logged_at: string
  note: string
}

export type PersonSummary = { id: number; display_name: string; email: string }

export type CareLink = {
  id: number
  caregiver: PersonSummary
  recipient: PersonSummary
  permission: Permission
  status: 'pending' | 'active' | 'declined' | 'revoked'
  created_at: string
  responded_at: string | null
}

export type AppointmentType = 'checkup' | 'consultation' | 'imaging' | 'lab_test' | 'procedure' | 'other'
export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled'

export type Appointment = {
  id: number
  owner: number
  title: string
  type: AppointmentType
  provider_name: string
  location: string
  starts_at: string
  duration_minutes: number | null
  preparation: string
  notes: string
  status: AppointmentStatus
  created_at: string
  updated_at: string
}

export type AppointmentInput = {
  title: string
  type: AppointmentType
  provider_name: string
  location: string
  starts_at: string
  duration_minutes: number | null
  preparation: string
  notes: string
  status?: AppointmentStatus
}