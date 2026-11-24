import { describe, expect, it } from 'vitest'
import { describeDue, formatLongDate, formatTime, formatShortDate } from './format'

describe('formatTime', () => {
  it('shows the time in the given timezone', () => {
    expect(formatTime('2026-11-17T00:00:00Z', 'Asia/Manila')).toBe('08:00')
    expect(formatTime('2026-11-17T12:30:00Z', 'UTC')).toBe('12:30')
  })

  it('writes midnight as 00:xx, not 24:xx', () => {
    expect(formatTime('2026-11-17T00:05:00Z', 'UTC')).toBe('00:05')
  })

  it('falls back to UTC for an unknown timezone', () => {
    expect(formatTime('2026-11-17T08:00:00Z', 'Nowhere/Land')).toBe('08:00')
  })
})

describe('formatLongDate', () => {
  it('writes the weekday, day and month', () => {
    expect(formatLongDate('2026-11-22')).toBe('Sunday, 22 November')
  })
})

describe('describeDue', () => {
  const now = Date.parse('2026-11-22T12:00:00Z')
  const at = (minutes: number) => now + minutes * 60_000

  it.each([
    [300, 'later today'],
    [121, 'later today'],
    [120, 'due in 2 h'],
    [90, 'due in 1 h 30 min'],
    [40, 'due in 40 min'],
    [2, 'due in 2 min'],
    [1, 'due now'],
    [0, 'due now'],
    [-1, 'due now'],
    [-10, 'was due 10 min ago'],
    [-90, 'was due 1 h 30 min ago'],
  ])('%i minutes away is "%s"', (minutes, expected) => {
    expect(describeDue(at(minutes), now)).toBe(expected)
  })
})

describe('formatShortDate', () => {
  it('writes day, short month and year', () => {
    expect(formatShortDate('2026-11-17')).toBe('17 Nov 2026')
  })
})