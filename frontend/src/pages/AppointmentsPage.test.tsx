import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_VIEW, appointment, page } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import AppointmentsPage from './AppointmentsPage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)
const PROFILES = 'GET /api/profiles/'
const url = (query: string, profile = 1) => `GET /api/appointments/?profile=${profile}${query}&page_size=100`
const UPCOMING = url('&upcoming=true')

const XRAY = appointment({ id: 5 })
const CHECKUP = appointment({
  id: 6,
  title: 'Check-up',
  type: 'checkup',
  provider_name: 'Dr. Santos',
  location: 'City Clinic',
  starts_at: '2026-11-30T06:00:00Z', // 14:00 in Manila
  duration_minutes: null,
  preparation: '',
  notes: 'Bring your medication list',
})
const PET = appointment({
  id: 7,
  title: 'PET scan',
  type: 'imaging',
  provider_name: 'Metro Nuclear Medicine',
  location: '',
  starts_at: '2026-12-03T23:00:00Z', // 07:00 on 4 December in Manila
  preparation: 'No food for 6 hours (from your clinic)',
  notes: '',
})

function renderAppointments(route = '/appointments') {
  return renderPage(<AppointmentsPage />, { route, path: '/appointments' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T12:00:00Z')) // 20:00 on Sunday 22 November in Manila
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('upcoming appointments', () => {
  it('shows the next one prominently and every upcoming one as a card', async () => {
    mockApi({ [PROFILES]: profiles(ME), [UPCOMING]: () => jsonResponse(200, page([XRAY, CHECKUP, PET])) })
    renderAppointments()

    expect(await screen.findByText('Next up · in 4 days')).toBeInTheDocument()
    expect(screen.getByText('Thursday 26 Nov, 09:30')).toBeInTheDocument()
    expect(screen.getByText('3 coming up')).toBeInTheDocument()

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByRole('link', { name: 'Chest X-ray' })).toHaveAttribute('href', '/appointments/5')
    expect(within(rows[0]!).getByText('Imaging')).toBeInTheDocument()
    expect(within(rows[0]!).getByText("09:30 · St. Luke's Imaging · Level 2")).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Prep: Wear loose clothing')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Thu')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('26')).toBeInTheDocument()
    expect(within(rows[1]!).getByRole('link', { name: 'Check-up' })).toHaveAttribute('href', '/appointments/6')
    expect(within(rows[1]!).getByText('14:00 · Dr. Santos · City Clinic')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('Prep: No food for 6 hours (from your clinic)')).toBeInTheDocument()
  })

  it('filters by type and drops the next-up card while filtered', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [UPCOMING]: () => jsonResponse(200, page([XRAY, CHECKUP, PET])),
      [url('&upcoming=true&type=imaging')]: () => jsonResponse(200, page([XRAY, PET])),
    })
    renderAppointments()
    await screen.findByText('Next up · in 4 days')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Imaging' }))

    expect(await screen.findByText('2 coming up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imaging', pressed: true })).toBeInTheDocument()
    expect(screen.queryByText(/next up/i)).not.toBeInTheDocument()
  })

  it('explains an empty list and offers to add one', async () => {
    mockApi({ [PROFILES]: profiles(ME), [UPCOMING]: () => jsonResponse(200, page([])) })
    renderAppointments()
    expect(await screen.findByText(/no upcoming appointments/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New appointment' })).toHaveAttribute('href', '/appointments/new')
  })

  it("shows times in the viewed person's own timezone", async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({
      [PROFILES]: profiles(ME, { ...MUM_VIEW, timezone: 'Europe/London' }),
      [url('&upcoming=true', 2)]: () => jsonResponse(200, page([XRAY])),
    })
    renderAppointments()
    expect(await screen.findByText("01:30 · St. Luke's Imaging · Level 2")).toBeInTheDocument()
  })

  it('offers no way to add on a view-only profile', async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({
      [PROFILES]: profiles(ME, MUM_VIEW),
      [url('&upcoming=true', 2)]: () => jsonResponse(200, page([XRAY])),
    })
    renderAppointments()
    expect(await screen.findByText('View only')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Chest X-ray' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'New appointment' })).not.toBeInTheDocument()
  })

  it('shows a friendly error and lets you retry', async () => {
    let attempts = 0
    mockApi({
      [PROFILES]: profiles(ME),
      [UPCOMING]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, { error: { code: 'server_error', message: 'Boom' } })
          : jsonResponse(200, page([XRAY]))
      },
    })
    renderAppointments()
    expect(await screen.findByText(/couldn't load the appointments/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('link', { name: 'Chest X-ray' })).toBeInTheDocument()
  })
})

describe('past appointments', () => {
  it('shows what happened to each one', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [url('&upcoming=false')]: () =>
        jsonResponse(
          200,
          page([
            appointment({ id: 8, title: 'Dentist', status: 'completed', starts_at: '2026-11-10T02:00:00Z' }),
            appointment({ id: 9, title: 'Eye test', status: 'cancelled', starts_at: '2026-10-20T02:00:00Z' }),
          ]),
        ),
    })
    renderAppointments('/appointments?view=past')

    const rows = await screen.findAllByRole('listitem')
    expect(within(rows[0]!).getByText('Completed')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Cancelled')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Past', pressed: true })).toBeInTheDocument()
  })
})

describe('calendar', () => {
  const NOVEMBER = url('&from=2026-11-01&to=2026-11-30')
  const DECEMBER = url('&from=2026-12-01&to=2026-12-31')

  it('marks days that have appointments and shows the chosen day below', async () => {
    mockApi({ [PROFILES]: profiles(ME), [NOVEMBER]: () => jsonResponse(200, page([XRAY, CHECKUP])) })
    renderAppointments('/appointments?view=calendar')
    const user = userEvent.setup()

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    // Today is selected first, and has nothing on it.
    expect(await screen.findByText(/no appointments on Sunday, 22 November/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '26 November, 1 appointment' }))

    expect(screen.getByRole('heading', { name: 'Thursday, 26 November' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chest X-ray' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30 November, 1 appointment' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '22 November' })).toHaveAttribute('aria-current', 'date')
  })

  it('moves to the next month and loads it', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [NOVEMBER]: () => jsonResponse(200, page([XRAY])),
      [DECEMBER]: () => jsonResponse(200, page([PET])),
    })
    renderAppointments('/appointments?view=calendar')

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Next month' }))

    expect(await screen.findByRole('heading', { name: 'December 2026' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '4 December, 1 appointment' })).toBeInTheDocument()
    expect(screen.getByText(/no appointments on Tuesday, 1 December/i)).toBeInTheDocument()
  })

  it('switches to the calendar from the view buttons', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [UPCOMING]: () => jsonResponse(200, page([XRAY])),
      [NOVEMBER]: () => jsonResponse(200, page([XRAY])),
    })
    renderAppointments()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Calendar' }))

    expect(await screen.findByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calendar', pressed: true })).toBeInTheDocument()
  })
})