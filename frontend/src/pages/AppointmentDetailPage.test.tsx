import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_VIEW, appointment } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import AppointmentDetailPage from './AppointmentDetailPage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)
const DETAIL = 'GET /api/appointments/5/'

function renderDetail() {
  return renderPage(<AppointmentDetailPage />, { route: '/appointments/5', path: '/appointments/:id' })
}

beforeEach(() => {
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('appointment details', () => {
  it("fills the form in the owner's timezone", async () => {
    mockApi({ 'GET /api/profiles/': profiles(ME), [DETAIL]: () => jsonResponse(200, appointment()) })
    renderDetail()

    expect(await screen.findByLabelText(/^title$/i)).toHaveValue('Chest X-ray')
    expect(screen.getByLabelText(/^type$/i)).toHaveValue('imaging')
    expect(screen.getByLabelText(/^date$/i)).toHaveValue('2026-11-26')
    expect(screen.getByLabelText(/^time$/i)).toHaveValue('09:30') // 01:30 UTC in Manila
    expect(screen.getByLabelText(/duration/i)).toHaveValue(30)
    expect(screen.getByLabelText(/^status$/i)).toHaveValue('scheduled')
    expect(screen.getByText(/times are in Asia\/Manila/i)).toBeInTheDocument()
  })

  it('saves edits', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, appointment()),
      'PATCH /api/appointments/5/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, appointment({ location: 'Room 5' }))
      },
    })
    renderDetail()
    const user = userEvent.setup()

    const location = await screen.findByLabelText(/^location$/i)
    await user.clear(location)
    await user.type(location, 'Room 5')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(sent).toEqual({
        title: 'Chest X-ray',
        type: 'imaging',
        provider_name: "St. Luke's Imaging",
        location: 'Room 5',
        starts_at: '2026-11-26T01:30:00.000Z',
        duration_minutes: 30,
        preparation: 'Wear loose clothing',
        notes: 'Bring the referral',
        status: 'scheduled',
      }),
    )
  })

  it('marks an appointment as completed', async () => {
    let sent: { status?: string } = {}
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, appointment()),
      'PATCH /api/appointments/5/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, appointment({ status: 'completed' }))
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.selectOptions(await screen.findByLabelText(/^status$/i), 'completed')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent.status).toBe('completed'))
  })

  it('clears the duration', async () => {
    let sent: { duration_minutes?: number | null } = {}
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, appointment()),
      'PATCH /api/appointments/5/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, appointment({ duration_minutes: null }))
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.clear(await screen.findByLabelText(/duration/i))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent.duration_minutes).toBeNull())
  })

  it('asks before deleting and then returns to the list', async () => {
    let deleted = false
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, appointment()),
      'DELETE /api/appointments/5/': () => {
        deleted = true
        return jsonResponse(204)
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Delete appointment' }))
    expect(deleted).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/appointments')
    expect(deleted).toBe(true)
  })
})

describe('access and errors', () => {
  it('is read-only on a view-only profile', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME, MUM_VIEW),
      [DETAIL]: () => jsonResponse(200, appointment({ owner: 2 })),
    })
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Chest X-ray' })).toBeInTheDocument()
    expect(screen.getByText('Thursday 26 Nov, 09:30')).toBeInTheDocument()
    expect(screen.getByText('Wear loose clothing')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument()
    for (const name of ['Save changes', 'Delete appointment']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  it('says so when the appointment cannot be found', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(404, { error: { code: 'not_found', message: 'Not found.' } }),
    })
    renderDetail()
    expect(await screen.findByText(/couldn't find that appointment/i)).toBeInTheDocument()
  })
})