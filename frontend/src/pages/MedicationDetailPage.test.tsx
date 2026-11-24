import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_VIEW, medication, schedule } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import MedicationDetailPage from './MedicationDetailPage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)
const DETAIL = 'GET /api/medications/7/'

const MORNING = schedule({ id: 11, time_of_day: '08:00' })
const EVENING = schedule({ id: 12, time_of_day: '20:00', days_of_week: [0, 1, 2, 3, 4] })
const WITH_SCHEDULES = medication({ schedules: [MORNING, EVENING] })

function renderDetail() {
  return renderPage(<MedicationDetailPage />, { route: '/medications/7', path: '/medications/:id' })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 10, 24, 12, 0)) // 24 November 2026, local time
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('medication details', () => {
  it('shows the medication, its supply and its schedules', async () => {
    mockApi({ 'GET /api/profiles/': profiles(ME), [DETAIL]: () => jsonResponse(200, WITH_SCHEDULES) })
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Metformin' })).toBeInTheDocument()
    expect(screen.getByText('About 12 days left')).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.getByText(/every day/)).toBeInTheDocument()
    expect(screen.getByText('20:00')).toBeInTheDocument()
    expect(screen.getByText(/weekdays/)).toBeInTheDocument()
  })

  it('saves edits to the details', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, WITH_SCHEDULES),
      'PATCH /api/medications/7/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, WITH_SCHEDULES)
      },
    })
    renderDetail()
    const user = userEvent.setup()

    const dosage = await screen.findByLabelText(/^dosage$/i)
    await user.clear(dosage)
    await user.type(dosage, '850 mg')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(sent).toEqual({
        name: 'Metformin',
        dosage: '850 mg',
        instructions: 'with food',
        pills_remaining: 24,
        refill_threshold: 10,
      }),
    )
  })

  it('records a refill', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, WITH_SCHEDULES),
      'POST /api/medications/7/refill/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, WITH_SCHEDULES)
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/pills added/i), '20')
    await user.click(screen.getByRole('button', { name: 'Add pills' }))

    await waitFor(() => expect(sent).toEqual({ pills_added: 20 }))
  })
})

describe('schedule editor', () => {
  it('adds a schedule', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, medication()),
      'POST /api/medications/7/schedules/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, schedule({ id: 20 }))
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Add a schedule' }))
    fireEvent.change(screen.getByLabelText(/^time$/i), { target: { value: '09:30' } })
    await user.click(screen.getByRole('button', { name: 'Weekdays' }))
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))

    await waitFor(() =>
      expect(sent).toEqual({
        time_of_day: '09:30',
        days_of_week: [0, 1, 2, 3, 4],
        start_date: '2026-11-24',
        end_date: null,
        pills_per_dose: 1,
        active: true,
      }),
    )
  })

  it('edits a schedule', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, WITH_SCHEDULES),
      'PATCH /api/schedules/11/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, MORNING)
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Edit 08:00 schedule' }))
    const pills = screen.getByLabelText(/pills per dose/i)
    await user.clear(pills)
    await user.type(pills, '2')
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))

    await waitFor(() =>
      expect(sent).toEqual({
        time_of_day: '08:00',
        days_of_week: [0, 1, 2, 3, 4, 5, 6],
        start_date: '2026-11-17',
        end_date: null,
        pills_per_dose: 2,
        active: true,
      }),
    )
  })

  it('shows a schedule problem under the right field', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, medication()),
      'POST /api/medications/7/schedules/': () =>
        jsonResponse(400, {
          error: {
            code: 'validation_error',
            message: 'One or more fields are invalid.',
            fields: { days_of_week: ['This list may not be empty.'] },
          },
        }),
    })
    renderDetail()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Add a schedule' }))
    await user.click(screen.getByRole('button', { name: 'Save schedule' }))

    expect(await screen.findByText('This list may not be empty.')).toBeInTheDocument()
  })

  it('asks before deleting a schedule', async () => {
    let deleted = false
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, WITH_SCHEDULES),
      'DELETE /api/schedules/11/': () => {
        deleted = true
        return jsonResponse(204)
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Delete 08:00 schedule' }))
    expect(deleted).toBe(false) // nothing happens until you confirm
    expect(screen.getByText(/past doses stay in your history/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, delete' }))

    await waitFor(() => expect(deleted).toBe(true))
  })
})

describe('stopping and restarting', () => {
  it('stops a medication after confirmation and returns to the list', async () => {
    let stopped = false
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, WITH_SCHEDULES),
      'DELETE /api/medications/7/': () => {
        stopped = true
        return jsonResponse(204)
      },
    })
    renderDetail()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button', { name: 'Stop medication' }))
    expect(stopped).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Yes, stop' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/medications')
    expect(stopped).toBe(true)
  })

  it('restarts a stopped medication', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(200, medication({ active: false })),
      'PATCH /api/medications/7/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, medication())
      },
    })
    renderDetail()

    expect(await screen.findByText('Stopped')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Restart medication' }))

    await waitFor(() => expect(sent).toEqual({ active: true }))
  })
})

describe('access and errors', () => {
  it('is read-only when the medication belongs to a view-only profile', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME, MUM_VIEW),
      [DETAIL]: () => jsonResponse(200, { ...WITH_SCHEDULES, owner: 2 }),
    })
    renderDetail()

    expect(await screen.findByRole('heading', { name: 'Metformin' })).toBeInTheDocument()
    expect(screen.getByText('08:00')).toBeInTheDocument()
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
    for (const name of ['Save changes', 'Add pills', 'Add a schedule', 'Stop medication']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /^Edit /i })).not.toBeInTheDocument()
  })

  it('says so when the medication cannot be found', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME),
      [DETAIL]: () => jsonResponse(404, { error: { code: 'not_found', message: 'Not found.' } }),
    })
    renderDetail()
    expect(await screen.findByText(/couldn't find that medication/i)).toBeInTheDocument()
  })
})