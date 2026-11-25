import { describe, expect, it } from 'vitest'
import { groupByDay } from './history'

const log = (id: number, scheduled_for: string) => ({ id, scheduled_for })

describe('groupByDay', () => {
  it("groups consecutive items by the person's local day and keeps the order", () => {
    const groups = groupByDay(
      [
        log(1, '2026-11-22T00:00:00Z'), // 08:00 on the 22nd in Manila
        log(2, '2026-11-21T14:00:00Z'), // 22:00 on the 21st
        log(3, '2026-11-21T00:00:00Z'), // 08:00 on the 21st
      ],
      'Asia/Manila',
    )
    expect(groups.map((g) => [g.date, g.items.map((i) => i.id)])).toEqual([
      ['2026-11-22', [1]],
      ['2026-11-21', [2, 3]],
    ])
  })

  it('returns nothing for an empty list', () => {
    expect(groupByDay([], 'UTC')).toEqual([])
  })
})