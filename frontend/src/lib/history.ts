import { localDate } from './format'

export type DayGroup<T> = { date: string; items: T[] }

/** Groups a newest-first list by the person's local day, keeping the order. */
export function groupByDay<T extends { scheduled_for: string }>(items: T[], timeZone: string): DayGroup<T>[] {
  const groups: DayGroup<T>[] = []
  for (const item of items) {
    const date = localDate(item.scheduled_for, timeZone)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.items.push(item)
    else groups.push({ date, items: [item] })
  }
  return groups
}