export const ME = { user_id: 1, display_name: 'Alex', relationship: 'self', permission: 'edit' }
export const MUM_VIEW = { user_id: 2, display_name: 'Mum', relationship: 'recipient', permission: 'view' }
export const MUM_EDIT = { ...MUM_VIEW, permission: 'edit' }

export function schedule(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    medication: 7,
    time_of_day: '08:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    start_date: '2026-11-17',
    end_date: null,
    pills_per_dose: 1,
    active: true,
    ...overrides,
  }
}

export function medication(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    owner: 1,
    name: 'Metformin',
    dosage: '500 mg',
    instructions: 'with food',
    pills_remaining: 24,
    refill_threshold: 10,
    active: true,
    low_supply: false,
    days_supply_left: 12,
    schedules: [],
    created_at: '2026-11-01T02:00:00Z',
    updated_at: '2026-11-17T01:30:00Z',
    ...overrides,
  }
}

export const page = (results: unknown[]) => ({ count: results.length, next: null, previous: null, results })