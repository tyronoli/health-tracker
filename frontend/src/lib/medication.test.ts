import { afterEach, describe, expect, it, vi } from 'vitest'
import { daysLeftText, describeDays, scheduleLine, supplyFraction, todayDate } from './medication'
import { medication, schedule } from '../test/fixtures'
import type { Medication, Schedule } from '../api/types'

const med = (overrides: Record<string, unknown> = {}) => medication(overrides) as unknown as Medication
const sched = (overrides: Record<string, unknown> = {}) => schedule(overrides) as unknown as Schedule

describe('describeDays', () => {
  it.each([
    [[0, 1, 2, 3, 4, 5, 6], 'every day'],
    [[4, 3, 2, 1, 0], 'weekdays'],
    [[5, 6], 'weekends'],
    [[2, 0], 'Mon, Wed'],
    [[6], 'Sun'],
  ])('%j is "%s"', (days, expected) => {
    expect(describeDays(days)).toBe(expected)
  })
})

describe('scheduleLine', () => {
  it('lists the times of active schedules', () => {
    const line = scheduleLine([sched({ time_of_day: '08:00' }), sched({ id: 12, time_of_day: '14:00' })])
    expect(line).toBe('08:00 · 14:00')
  })

  it('names the days when a schedule is not daily', () => {
    expect(scheduleLine([sched({ days_of_week: [0, 2] })])).toBe('08:00 (Mon, Wed)')
  })

  it('ignores paused schedules and says so when none are left', () => {
    expect(scheduleLine([sched({ active: false })])).toBe('No schedule yet')
    expect(scheduleLine([])).toBe('No schedule yet')
  })
})

describe('daysLeftText', () => {
  it.each([
    [null, 'No schedule set'],
    [0, 'Less than a day left'],
    [1, 'About 1 day left'],
    [12, 'About 12 days left'],
  ])('%s days is "%s"', (days, expected) => {
    expect(daysLeftText(med({ days_supply_left: days }))).toBe(expected)
  })
})

describe('supplyFraction', () => {
  it('uses days left out of 30 when there is a schedule', () => {
    expect(supplyFraction(med({ days_supply_left: 15 }))).toBe(0.5)
    expect(supplyFraction(med({ days_supply_left: 90 }))).toBe(1)
    expect(supplyFraction(med({ days_supply_left: 0 }))).toBe(0)
  })

  it('falls back to pills against three times the alert level', () => {
    expect(supplyFraction(med({ days_supply_left: null, pills_remaining: 15, refill_threshold: 10 }))).toBe(0.5)
    expect(supplyFraction(med({ days_supply_left: null, pills_remaining: 0, refill_threshold: 0 }))).toBe(0)
  })
})

describe('todayDate', () => {
  afterEach(() => vi.useRealTimers())

  it('is the local date as YYYY-MM-DD', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0)) // 4 November, local time
    expect(todayDate()).toBe('2026-11-04')
  })
})