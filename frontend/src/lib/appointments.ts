import type { Appointment, AppointmentStatus, AppointmentType } from '../api/types'
import type { Status } from '../components/StatusTag'
import { formatTime, localDate } from './format'

export const APPOINTMENT_TYPES: { value: AppointmentType; label: string; filterLabel: string; tag: Status }[] = [
  { value: 'checkup', label: 'Check-up', filterLabel: 'Check-ups', tag: 'taken' },
  { value: 'consultation', label: 'Consultation', filterLabel: 'Consultations', tag: 'taken' },
  { value: 'imaging', label: 'Imaging', filterLabel: 'Imaging', tag: 'info' },
  { value: 'lab_test', label: 'Lab test', filterLabel: 'Lab tests', tag: 'skipped' },
  { value: 'procedure', label: 'Procedure', filterLabel: 'Procedures', tag: 'info' },
  { value: 'other', label: 'Other', filterLabel: 'Other', tag: 'skipped' },
]

export function typeInfo(type: AppointmentType) {
  return (
    APPOINTMENT_TYPES.find((t) => t.value === type) ?? {
      value: type,
      label: type,
      filterLabel: type,
      tag: 'skipped' as Status,
    }
  )
}

export const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// ---------- dates and times in a person's timezone ----------

function parts(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).formatToParts(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).formatToParts(new Date(iso))
  }
}

const part = (list: Intl.DateTimeFormatPart[], type: string) => list.find((p) => p.type === type)?.value ?? ''

export function dateTile(iso: string, timeZone: string) {
  const p = parts(iso, timeZone, { weekday: 'short', day: 'numeric', month: 'short' })
  return { weekday: part(p, 'weekday'), day: part(p, 'day'), month: part(p, 'month') }
}

/** "Thursday 26 Nov, 09:30" */
export function formatWhen(iso: string, timeZone: string): string {
  const p = parts(iso, timeZone, { weekday: 'long', day: 'numeric', month: 'short' })
  return `${part(p, 'weekday')} ${part(p, 'day')} ${part(p, 'month')}, ${formatTime(iso, timeZone)}`
}

function offsetMinutes(utcMs: number, timeZone: string): number {
  const p = parts(new Date(utcMs).toISOString(), timeZone, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  const value = (type: string) => Number(part(p, type))
  const asUtc = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'))
  return (asUtc - utcMs) / 60_000
}

/**
 * A date and time typed in someone's timezone -> the UTC instant, as an ISO string.
 * The second pass settles the offset when the time falls near a daylight-saving change.
 */
export function zonedToUtcIso(date: string, time: string, timeZone: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const first = wall - offsetMinutes(wall, timeZone) * 60_000
  return new Date(wall - offsetMinutes(first, timeZone) * 60_000).toISOString()
}

/** "in 30 min", "in 3 h", "tomorrow", "in 4 days" (days count local calendar days). */
export function describeUntil(startIso: string, nowMs: number, timeZone: string): string {
  const diff = Date.parse(startIso) - nowMs
  if (diff <= 0) return 'now'
  if (diff < 3_600_000) return `in ${Math.max(1, Math.round(diff / 60_000))} min`
  const days = Math.round(
    (Date.parse(localDate(startIso, timeZone)) - Date.parse(localDate(new Date(nowMs).toISOString(), timeZone))) /
      86_400_000,
  )
  if (days === 0) return `in ${Math.round(diff / 3_600_000)} h`
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

// ---------- the month calendar ----------

/** Weeks starting on Monday. Days from neighbouring months are included and marked. */
export function buildMonthGrid(month: string): { date: string; inMonth: boolean }[][] {
  const [year = 0, mon = 1] = month.split('-').map(Number)
  const offset = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  const cells = Math.ceil((offset + daysInMonth) / 7) * 7
  const weeks: { date: string; inMonth: boolean }[][] = []
  for (let i = 0; i < cells; i++) {
    const d = new Date(Date.UTC(year, mon - 1, 1 - offset + i))
    const cell = { date: d.toISOString().slice(0, 10), inMonth: d.getUTCMonth() === mon - 1 }
    if (i % 7 === 0) weeks.push([cell])
    else weeks[weeks.length - 1]?.push(cell)
  }
  return weeks
}

export function monthRange(month: string): { from: string; to: string } {
  const [year = 0, mon = 1] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function shiftMonth(month: string, delta: number): string {
  const [year = 0, mon = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(year, mon - 1 + delta, 1)).toISOString().slice(0, 7)
}

export function formatMonthTitle(month: string): string {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${month}-01T00:00:00Z`),
  )
}

export function groupAppointmentsByDay(items: Appointment[], timeZone: string): Map<string, Appointment[]> {
  const groups = new Map<string, Appointment[]>()
  for (const item of items) {
    const date = localDate(item.starts_at, timeZone)
    groups.set(date, [...(groups.get(date) ?? []), item])
  }
  return groups
}