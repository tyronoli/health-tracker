import type { Medication, Schedule } from '../api/types'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

/** Days are numbered like the API: Monday = 0 ... Sunday = 6. */
export function describeDays(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b)
  const key = sorted.join(',')
  if (key === '0,1,2,3,4,5,6') return 'every day'
  if (key === '0,1,2,3,4') return 'weekdays'
  if (key === '5,6') return 'weekends'
  return sorted.map((day) => WEEKDAYS[day]).join(', ')
}

export function scheduleLine(schedules: Schedule[]): string {
  const active = schedules.filter((s) => s.active)
  if (active.length === 0) return 'No schedule yet'
  return active
    .map((s) => (s.days_of_week.length === 7 ? s.time_of_day : `${s.time_of_day} (${describeDays(s.days_of_week)})`))
    .join(' · ')
}

export function daysLeftText(medication: Medication): string {
  const days = medication.days_supply_left
  if (days === null) return 'No schedule set'
  if (days === 0) return 'Less than a day left'
  return days === 1 ? 'About 1 day left' : `About ${days} days left`
}

/** How full the supply bar is, from 0 to 1. */
export function supplyFraction(medication: Medication): number {
  if (medication.days_supply_left !== null) return Math.min(1, medication.days_supply_left / 30)
  return Math.min(1, medication.pills_remaining / Math.max(medication.refill_threshold * 3, 1))
}

export function pillsText(count: number): string {
  return `${count} ${count === 1 ? 'pill' : 'pills'}`
}

/** Today's date in this device's timezone, as YYYY-MM-DD (what a date input expects). */
export function todayDate(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}