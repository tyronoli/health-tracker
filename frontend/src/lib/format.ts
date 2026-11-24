export function formatTime(iso: string, timeZone: string): string {
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: 'UTC' }).format(new Date(iso))
  }
}

/** "2026-11-22" -> "Sunday, 22 November" */
export function formatLongDate(date: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).formatToParts(new Date(`${date}T00:00:00Z`))
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${part('weekday')}, ${part('day')} ${part('month')}`
}

function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

export function describeDue(scheduledMs: number, nowMs: number): string {
  const minutes = Math.round((scheduledMs - nowMs) / 60_000)
  if (minutes > 120) return 'later today'
  if (minutes >= 2) return `due in ${duration(minutes)}`
  if (minutes >= -1) return 'due now'
  return `was due ${duration(-minutes)} ago`
}

/** "2026-11-17" -> "17 Nov 2026" */
export function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}