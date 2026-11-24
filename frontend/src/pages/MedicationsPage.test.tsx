import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_VIEW, medication, page, schedule } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import MedicationsPage from './MedicationsPage'

const PROFILES = 'GET /api/profiles/'
const ACTIVE = 'GET /api/medications/?profile=1&active=true&page_size=100'
const STOPPED = 'GET /api/medications/?profile=1&active=false&page_size=100'
const profiles = (...list: unknown[]) => () => jsonResponse(200, list)

const METFORMIN = medication({
  schedules: [schedule({ time_of_day: '08:00' }), schedule({ id: 12, time_of_day: '14:00' })],
})
const STATIN = medication({
  id: 8,
  name: 'Atorvastatin',
  dosage: '20 mg',
  instructions: '',
  pills_remaining: 6,
  low_supply: true,
  days_supply_left: 6,
  schedules: [schedule({ id: 13, medication: 8, time_of_day: '20:00' })],
})

function renderList() {
  return renderPage(<MedicationsPage />, { route: '/medications', path: '/medications' })
}

beforeEach(() => {
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('medication list', () => {
  it('shows each medication with its schedule, supply and low-supply badge', async () => {
    mockApi({ [PROFILES]: profiles(ME), [ACTIVE]: () => jsonResponse(200, page([METFORMIN, STATIN])) })
    renderList()

    expect(await screen.findByRole('link', { name: 'Metformin' })).toHaveAttribute('href', '/medications/7')
    expect(screen.getByText('2 active')).toBeInTheDocument()
    expect(screen.getByText('08:00 · 14:00 · with food')).toBeInTheDocument()
    expect(screen.getByText('24 pills')).toBeInTheDocument()
    expect(screen.getByText('About 12 days left')).toBeInTheDocument()
    expect(screen.getByText('Low supply')).toBeInTheDocument()
    expect(screen.getByText('6 pills · About 6 days left')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'I refilled' })).toHaveLength(1) // low supply only
    expect(screen.getByRole('link', { name: 'Add medication' })).toHaveAttribute('href', '/medications/new')
  })

  it('records a refill from the card', async () => {
    let sent: unknown
    let refilled = false
    mockApi({
      [PROFILES]: profiles(ME),
      [ACTIVE]: () =>
        jsonResponse(200, page([refilled ? { ...STATIN, pills_remaining: 36, low_supply: false } : STATIN])),
      'POST /api/medications/8/refill/': (init) => {
        sent = JSON.parse(String(init?.body))
        refilled = true
        return jsonResponse(200, { ...STATIN, pills_remaining: 36 })
      },
    })
    renderList()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'I refilled' }))
    await user.type(screen.getByLabelText(/pills added/i), '30')
    await user.click(screen.getByRole('button', { name: 'Add pills' }))

    await waitFor(() => expect(screen.queryByText('Low supply')).not.toBeInTheDocument())
    expect(sent).toEqual({ pills_added: 30 })
  })

  it('shows stopped medications under the Stopped filter', async () => {
    const stopped = medication({ id: 9, name: 'Ibuprofen', active: false, schedules: [] })
    mockApi({
      [PROFILES]: profiles(ME),
      [ACTIVE]: () => jsonResponse(200, page([METFORMIN])),
      [STOPPED]: () => jsonResponse(200, page([stopped])),
    })
    renderList()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Stopped' }))

    expect(await screen.findByRole('link', { name: 'Ibuprofen' })).toBeInTheDocument()
    expect(screen.getByText('1 stopped')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add medication' })).not.toBeInTheDocument()
  })

  it('explains an empty list', async () => {
    mockApi({ [PROFILES]: profiles(ME), [ACTIVE]: () => jsonResponse(200, page([])) })
    renderList()
    expect(await screen.findByText(/no medications yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add medication' })).toBeInTheDocument()
  })

  it('offers no write actions on a view-only profile', async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({
      [PROFILES]: profiles(ME, MUM_VIEW),
      'GET /api/medications/?profile=2&active=true&page_size=100': () =>
        jsonResponse(200, page([{ ...STATIN, owner: 2 }])),
    })
    renderList()

    expect(await screen.findByText('View only')).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Atorvastatin' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'I refilled' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Add medication' })).not.toBeInTheDocument()
  })

  it('shows a friendly error and lets you retry', async () => {
    let attempts = 0
    mockApi({
      [PROFILES]: profiles(ME),
      [ACTIVE]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, { error: { code: 'server_error', message: 'Boom' } })
          : jsonResponse(200, page([METFORMIN]))
      },
    })
    renderList()
    expect(await screen.findByText(/couldn't load the medications/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByRole('link', { name: 'Metformin' })).toBeInTheDocument()
  })
})