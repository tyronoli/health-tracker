import { describe, expect, it } from 'vitest'
import type { Appointment } from '../api/types'
import { appointment } from '../test/fixtures'
import {
  buildMonthGrid,
  dateTile,
  describeUntil,
  formatMonthTitle,
  formatWhen,
  groupAppointmentsByDay,
  monthRange,
  shiftMonth,
  zonedToUtcIso,
} from './appointments'
import { formatTime, localDate } from './format'

describe('zonedToUtcIso', () => {
  it.each([
    ['2026-11-26', '09:30', 'Asia/Manila', '2026-11-26T01:30:00.000Z'],
    ['2026-11-26', '09:30', 'UTC', '2026-11-26T09:30:00.000Z'],
    ['2026-03-07', '08:00', 'America/New_York', '2026-03-07T13:00:00.000Z'], // winter time, UTC-5
    ['2026-03-09', '08:00', 'America/New_York', '2026-03-09T12:00:00.000Z'], // summer time, UTC-4
  ])('%s %s in %s is %s', (date, time, zone, expected) => {
    expect(zonedToUtcIso(date, time, zone)).toBe(expected)
  })

  it.each([
    ['Asia/Manila', '2026-11-26', '23:30'],
    ['Europe/London', '2026-06-15', '00:15'],
    ['America/New_York', '2026-12-31', '12:00'],
    ['Pacific/Auckland', '2026-11-26', '23:30'],
  ])('round-trips in %s on %s at %s', (zone, date, time) => {
    const iso = zonedToUtcIso(date, time, zone)
    expect(localDate(iso, zone)).toBe(date)
    expect(formatTime(iso, zone)).toBe(time)
  })
})

describe('describeUntil', () => {
  const now = Date.parse('2026-11-22T12:00:00Z') // 20:00 on Nov 22 in Manila

  it.each([
    ['2026-11-22T12:30:00Z', 'in 30 min'],
    ['2026-11-22T15:00:00Z', 'in 3 h'], // 23:00 the same local day
    ['2026-11-22T16:30:00Z', 'tomorrow'], // 00:30 on Nov 23 in Manila
    ['2026-11-26T01:30:00Z', 'in 4 days'],
    ['2026-11-22T11:00:00Z', 'now'], // already started
  ])('%s is "%s"', (start, expected) => {
    expect(describeUntil(start, now, 'Asia/Manila')).toBe(expected)
  })
})

describe('date helpers', () => {
  it('builds the date tile in the given timezone', () => {
    expect(dateTile('2026-11-26T01:30:00Z', 'Asia/Manila')).toEqual({ weekday: 'Thu', day: '26', month: 'Nov' })
    expect(dateTile('2026-11-26T20:00:00Z', 'Asia/Manila')).toEqual({ weekday: 'Fri', day: '27', month: 'Nov' })
  })

  it('writes the full date and time', () => {
    expect(formatWhen('2026-11-26T01:30:00Z', 'Asia/Manila')).toBe('Thursday 26 Nov, 09:30')
  })
})

describe('calendar helpers', () => {
  it('lays out a month starting on Monday, padding with days from the neighbours', () => {
    const grid = buildMonthGrid('2026-11') // 1 November 2026 is a Sunday
    expect(grid).toHaveLength(6)
    expect(grid.every((week) => week.length === 7)).toBe(true)
    expect(grid[0]![0]).toEqual({ date: '2026-10-26', inMonth: false })
    expect(grid[0]![6]).toEqual({ date: '2026-11-01', inMonth: true })
    expect(grid[5]![6]).toEqual({ date: '2026-12-06', inMonth: false })
  })

  it('uses exactly four rows when a month fits them', () => {
    const grid = buildMonthGrid('2027-02') // starts on a Monday and has 28 days
    expect(grid).toHaveLength(4)
    expect(grid[0]![0]).toEqual({ date: '2027-02-01', inMonth: true })
    expect(grid[3]![6]).toEqual({ date: '2027-02-28', inMonth: true })
  })

  it('finds the first and last day of a month, including leap years', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(monthRange('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('moves between months across year boundaries', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-11', 0)).toBe('2026-11')
  })

  it('names a month', () => {
    expect(formatMonthTitle('2026-11')).toBe('November 2026')
  })

  it('groups appointments by the local day in the given timezone', () => {
    const items = [
      appointment({ id: 1, starts_at: '2026-11-26T01:30:00Z' }),
      appointment({ id: 2, starts_at: '2026-11-26T14:00:00Z' }), // 22:00 on the 26th in Manila
      appointment({ id: 3, starts_at: '2026-11-26T16:30:00Z' }), // 00:30 on the 27th in Manila
    ] as unknown as Appointment[]
    const groups = groupAppointmentsByDay(items, 'Asia/Manila')
    expect([...groups.keys()]).toEqual(['2026-11-26', '2026-11-27'])
    expect(groups.get('2026-11-26')?.map((a) => a.id)).toEqual([1, 2])
  })
})