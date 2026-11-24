import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfileProvider } from '../context/ProfileProvider'
import { jsonResponse, mockApi } from '../test/mockApi'
import TodayPage from './TodayPage'

const ME = { user_id: 1, display_name: 'Alex', relationship: 'self', permission: 'edit' }
const MUM_VIEW = { user_id: 2, display_name: 'Mum', relationship: 'recipient', permission: 'view' }
const MUM_EDIT = { ...MUM_VIEW, permission: 'edit' }

const METFORMIN = { id: 1, name: 'Metformin', dosage: '500 mg' }
const VITAMIN_D = { id: 2, name: 'Vitamin D', dosage: '1000 IU' }
const STATIN = { id: 3, name: 'Atorvastatin', dosage: '20 mg' }

const NOW = new Date('2026-11-22T12:00:00Z')
const iso = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString()

function dose(overrides: Record<string, unknown> = {}) {
  return {
    schedule: 1,
    medication: METFORMIN,
    scheduled_for: iso(30),
    status: 'pending',
    dose_log_id: null,
    logged_at: null,
    pills_per_dose: 1,
    ...overrides,
  }
}

const today = (doses: unknown[]) => ({ date: '2026-11-22', timezone: 'UTC', doses })
const profiles = (...list: unknown[]) => () => jsonResponse(200, list)
const PROFILES = 'GET /api/profiles/'
const TODAY_1 = 'GET /api/doses/today/?profile=1'
const TODAY_2 = 'GET /api/doses/today/?profile=2'

function renderToday() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProfileProvider>
          <TodayPage />
        </ProfileProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('Today screen', () => {
  it('shows the date, progress and every dose with its status', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () =>
        jsonResponse(
          200,
          today([
            dose({
              schedule: 1,
              scheduled_for: '2026-11-22T08:00:00Z',
              status: 'taken',
              dose_log_id: 301,
              logged_at: '2026-11-22T08:03:00Z',
            }),
            dose({ schedule: 2, medication: VITAMIN_D, scheduled_for: '2026-11-22T11:30:00Z', status: 'missed' }),
            dose({ schedule: 3, scheduled_for: iso(30), pills_per_dose: 2 }),
            dose({ schedule: 4, medication: STATIN, scheduled_for: iso(300) }),
          ]),
        ),
    })
    renderToday()

    expect(await screen.findByText('Sunday, 22 November')).toBeInTheDocument()
    expect(screen.getByText('1 of 4 doses taken')).toBeInTheDocument()
    expect(screen.getByText('Next: Metformin at 12:30')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText('Taken 08:03')).toBeInTheDocument()
    expect(screen.getByText('Missed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log it late' })).toBeInTheDocument()
    expect(screen.getByText(/500 mg · 2 pills · due in 30 min/)).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Taken' })).toHaveLength(1) // only the dose due soon
    expect(screen.getAllByRole('button', { name: 'Skip' })).toHaveLength(1)
    expect(screen.getByText(/later today/i)).toBeInTheDocument()
  })

  it('shows a friendly empty day', async () => {
    mockApi({ [PROFILES]: profiles(ME), [TODAY_1]: () => jsonResponse(200, today([])) })
    renderToday()
    expect(await screen.findByText('No doses scheduled today')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /add a medication/i })).toBeInTheDocument()
  })

  it('hides the switcher when there is only one profile', async () => {
    mockApi({ [PROFILES]: profiles(ME), [TODAY_1]: () => jsonResponse(200, today([])) })
    renderToday()
    await screen.findByRole('heading', { name: 'Today' })
    expect(screen.queryByRole('group', { name: /whose day/i })).not.toBeInTheDocument()
  })

  it('shows a friendly error and lets you retry', async () => {
    let attempts = 0
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, { error: { code: 'server_error', message: 'Boom' } })
          : jsonResponse(200, today([dose()]))
      },
    })
    renderToday()
    expect(await screen.findByText(/couldn't load today's doses/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText(/^Next: Metformin/)).toBeInTheDocument()
  })
})

describe('logging doses', () => {
  it('logs a dose as taken and refreshes the list', async () => {
    const soon = iso(30)
    let logged = false
    let sent: unknown
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () =>
        jsonResponse(
          200,
          today([
            logged
              ? dose({ scheduled_for: soon, status: 'taken', dose_log_id: 5, logged_at: iso(0) })
              : dose({ scheduled_for: soon }),
          ]),
        ),
      'POST /api/doses/': (init) => {
        sent = JSON.parse(String(init?.body))
        logged = true
        return jsonResponse(201, { id: 5 })
      },
    })
    renderToday()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Taken' }))

    expect(await screen.findByText('1 of 1 dose taken')).toBeInTheDocument()
    expect(sent).toEqual({ schedule: 1, scheduled_for: soon, status: 'taken' })
  })

  it('logs a dose as skipped', async () => {
    const soon = iso(30)
    let sent: unknown
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () => jsonResponse(200, today([dose({ scheduled_for: soon })])),
      'POST /api/doses/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, { id: 5 })
      },
    })
    renderToday()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(sent).toEqual({ schedule: 1, scheduled_for: soon, status: 'skipped' }))
  })

  it('logs a missed dose late with a POST when nothing was recorded yet', async () => {
    const when = '2026-11-22T08:00:00Z'
    let sent: unknown
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () => jsonResponse(200, today([dose({ scheduled_for: when, status: 'missed' })])),
      'POST /api/doses/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, { id: 6 })
      },
    })
    renderToday()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log it late' }))
    await waitFor(() => expect(sent).toEqual({ schedule: 1, scheduled_for: when, status: 'taken' }))
  })

  it('corrects a missed dose the system already recorded with a PATCH', async () => {
    let sent: unknown
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () =>
        jsonResponse(
          200,
          today([dose({ scheduled_for: '2026-11-22T08:00:00Z', status: 'missed', dose_log_id: 77 })]),
        ),
      'PATCH /api/doses/77/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, { id: 77 })
      },
    })
    renderToday()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Log it late' }))
    await waitFor(() => expect(sent).toEqual({ status: 'taken' }))
  })

  it('lets you change a taken dose to skipped', async () => {
    let sent: unknown
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () =>
        jsonResponse(
          200,
          today([
            dose({
              scheduled_for: '2026-11-22T08:00:00Z',
              status: 'taken',
              dose_log_id: 301,
              logged_at: '2026-11-22T08:03:00Z',
            }),
          ]),
        ),
      'PATCH /api/doses/301/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, { id: 301 })
      },
    })
    renderToday()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mark as skipped' }))
    await waitFor(() => expect(sent).toEqual({ status: 'skipped' }))
  })

  it('explains a 409 and reloads the latest state', async () => {
    let loads = 0
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () => {
        loads += 1
        return jsonResponse(200, today([dose()]))
      },
      'POST /api/doses/': () =>
        jsonResponse(409, {
          error: { code: 'already_logged', message: 'This dose has already been logged.' },
        }),
    })
    renderToday()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Taken' }))
    expect(await screen.findByText(/already logged somewhere else/i)).toBeInTheDocument()
    await waitFor(() => expect(loads).toBe(2))
  })

  it('explains a 403 when access changed', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [TODAY_1]: () => jsonResponse(200, today([dose()])),
      'POST /api/doses/': () =>
        jsonResponse(403, { error: { code: 'permission_denied', message: 'No.' } }),
    })
    renderToday()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Taken' }))
    expect(await screen.findByText(/only have view access/i)).toBeInTheDocument()
  })
})

describe('profile switcher', () => {
  const MUMS_DAY = today([
    dose({ schedule: 9 }),
    dose({ schedule: 10, medication: VITAMIN_D, scheduled_for: '2026-11-22T08:00:00Z', status: 'missed' }),
    dose({
      schedule: 11,
      medication: STATIN,
      scheduled_for: '2026-11-22T07:00:00Z',
      status: 'taken',
      dose_log_id: 3,
      logged_at: '2026-11-22T07:02:00Z',
    }),
  ])

  it('hides every write action on a view-only profile', async () => {
    mockApi({
      [PROFILES]: profiles(ME, MUM_VIEW),
      [TODAY_1]: () => jsonResponse(200, today([])),
      [TODAY_2]: () => jsonResponse(200, MUMS_DAY),
    })
    renderToday()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mum' }))

    expect(await screen.findByText('View only')).toBeInTheDocument()
    expect(await screen.findByText('Vitamin D')).toBeInTheDocument()
    for (const name of ['Taken', 'Skip', 'Log it late', 'Mark as skipped']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('offers the actions on a profile you can edit', async () => {
    mockApi({
      [PROFILES]: profiles(ME, MUM_EDIT),
      [TODAY_1]: () => jsonResponse(200, today([])),
      [TODAY_2]: () => jsonResponse(200, MUMS_DAY),
    })
    renderToday()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mum' }))

    expect(await screen.findByText('Can edit')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Taken' })).toBeInTheDocument()
  })

  it('remembers the selected profile', async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({
      [PROFILES]: profiles(ME, MUM_VIEW),
      [TODAY_2]: () => jsonResponse(200, today([])),
    })
    renderToday()
    expect(await screen.findByText('View only')).toBeInTheDocument()
  })

  it('falls back to your own profile when the stored one is gone', async () => {
    localStorage.setItem('ht-profile', '99')
    mockApi({
      [PROFILES]: profiles(ME, MUM_VIEW),
      [TODAY_1]: () => jsonResponse(200, today([])),
    })
    renderToday()
    expect(await screen.findByText('No doses scheduled today')).toBeInTheDocument()
    expect(screen.queryByText('View only')).not.toBeInTheDocument()
  })
})