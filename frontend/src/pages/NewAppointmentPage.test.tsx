import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_EDIT, MUM_VIEW, appointment } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import NewAppointmentPage from './NewAppointmentPage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)

function renderNew() {
  return renderPage(<NewAppointmentPage />, { route: '/appointments/new', path: '/appointments/new' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-22T12:00:00Z')) // 20:00 on 22 November in Manila
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('new appointment', () => {
  it("saves it, converting the person's local time to UTC", async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      'POST /api/appointments/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, appointment())
      },
    })
    renderNew()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/^title$/i), 'Chest X-ray')
    await user.selectOptions(screen.getByLabelText(/^type$/i), 'imaging')
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: '2026-11-26' } })
    fireEvent.change(screen.getByLabelText(/^time$/i), { target: { value: '09:30' } })
    await user.type(screen.getByLabelText(/duration/i), '30')
    await user.type(screen.getByLabelText(/^provider$/i), "St. Luke's Imaging")
    await user.type(screen.getByLabelText(/^location$/i), 'Level 2')
    await user.type(screen.getByLabelText(/^preparation$/i), 'Wear loose clothing')
    await user.type(screen.getByLabelText(/^notes$/i), 'Bring the referral')
    expect(screen.getByText(/times are in Asia\/Manila/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save appointment' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/appointments')
    expect(sent).toEqual({
      profile: 1,
      title: 'Chest X-ray',
      type: 'imaging',
      provider_name: "St. Luke's Imaging",
      location: 'Level 2',
      starts_at: '2026-11-26T01:30:00.000Z', // 09:30 in Manila is 01:30 UTC
      duration_minutes: 30,
      preparation: 'Wear loose clothing',
      notes: 'Bring the referral',
    })
  })

  it("starts with today's date in the person's timezone", async () => {
    mockApi({ 'GET /api/profiles/': profiles(ME) })
    renderNew()
    expect(await screen.findByLabelText(/^date$/i)).toHaveValue('2026-11-22')
    expect(screen.getByLabelText(/^time$/i)).toHaveValue('09:00')
  })

  it("uses the other person's timezone when you can edit their profile", async () => {
    localStorage.setItem('ht-profile', '2')
    let sent: { profile?: number; starts_at?: string } = {}
    mockApi({
      'GET /api/profiles/': profiles(ME, { ...MUM_EDIT, timezone: 'Europe/London' }),
      'POST /api/appointments/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, appointment({ id: 9, owner: 2 }))
      },
    })
    renderNew()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/^title$/i), 'Dentist')
    fireEvent.change(screen.getByLabelText(/^date$/i), { target: { value: '2026-11-26' } })
    fireEvent.change(screen.getByLabelText(/^time$/i), { target: { value: '09:30' } })
    expect(screen.getByText(/times are in Europe\/London/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save appointment' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/appointments')
    expect(sent.profile).toBe(2)
    expect(sent.starts_at).toBe('2026-11-26T09:30:00.000Z') // London is UTC+0 in November
  })

  it('shows a problem from the server under the right field', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME),
      'POST /api/appointments/': () =>
        jsonResponse(400, {
          error: {
            code: 'validation_error',
            message: 'One or more fields are invalid.',
            fields: { duration_minutes: ['Ensure this value is less than or equal to 1440.'] },
          },
        }),
    })
    renderNew()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/^title$/i), 'Long visit')
    await user.type(screen.getByLabelText(/duration/i), '9999')
    fireEvent.submit(screen.getByRole('button', { name: 'Save appointment' }).closest('form')!)

    expect(await screen.findByText(/less than or equal to 1440/i)).toBeInTheDocument()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('shows no form on a view-only profile', async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({ 'GET /api/profiles/': profiles(ME, MUM_VIEW) })
    renderNew()
    expect(await screen.findByText(/view-only access/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^title$/i)).not.toBeInTheDocument()
  })
})