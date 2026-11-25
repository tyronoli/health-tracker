import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_VIEW, medication, page } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import HistoryPage from './HistoryPage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)
const PROFILES = 'GET /api/profiles/'
const MEDICATIONS = 'GET /api/medications/?profile=1&page_size=100'
const MEDS = page([medication({ id: 1, name: 'Metformin' }), medication({ id: 2, name: 'Vitamin D' })])
const doses = (extra = '', pageNumber = 1) =>
  `GET /api/doses/?profile=1${extra}&page=${pageNumber}&page_size=30`

function log(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    medication: 1,
    schedule: 11,
    scheduled_for: '2026-11-22T00:00:00Z',
    status: 'taken',
    logged_at: '2026-11-22T00:03:00Z',
    note: '',
    ...overrides,
  }
}

function renderHistory(route = '/history') {
  return renderPage(<HistoryPage />, { route, path: '/history' })
}

beforeEach(() => {
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('History screen', () => {
  it("groups doses by the person's local day", async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () =>
        jsonResponse(
          200,
          page([
            log({ id: 1 }),
            log({ id: 2, medication: 2, scheduled_for: '2026-11-21T14:00:00Z', status: 'missed' }),
            log({ id: 3, scheduled_for: '2026-11-21T00:00:00Z', status: 'skipped', note: 'felt sick' }),
          ]),
        ),
    })
    renderHistory()

    expect(await screen.findByRole('heading', { name: 'Sunday, 22 November' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Saturday, 21 November' })).toBeInTheDocument()
    expect(screen.getByText('3 doses')).toBeInTheDocument()

    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(3)
    expect(within(rows[0]!).getByText('Metformin')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('08:00')).toBeInTheDocument()
    expect(within(rows[0]!).getByText('Taken')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Vitamin D')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('22:00')).toBeInTheDocument()
    expect(within(rows[1]!).getByText('Missed')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('Skipped')).toBeInTheDocument()
    expect(within(rows[2]!).getByText('felt sick')).toBeInTheDocument()
  })

  it('filters by status', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () => jsonResponse(200, page([log({ id: 1 })])),
      [doses('&status=missed')]: () =>
        jsonResponse(200, page([log({ id: 2, medication: 2, status: 'missed' })])),
    })
    renderHistory()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Missed' }))

    const row = (await screen.findAllByRole('listitem'))[0]!
    expect(await within(row).findByText('Vitamin D')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Missed', pressed: true })).toBeInTheDocument()
  })

  it('filters by medication', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () => jsonResponse(200, page([log({ id: 1 })])),
      [doses('&medication=2')]: () => jsonResponse(200, page([log({ id: 2, medication: 2 })])),
    })
    renderHistory()
    await screen.findByText('1 dose')

    await userEvent.setup().selectOptions(screen.getByLabelText('Medication'), 'Vitamin D')

    const row = (await screen.findAllByRole('listitem'))[0]!
    expect(await within(row).findByText('Vitamin D')).toBeInTheDocument()
  })

  it('filters by date range', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () => jsonResponse(200, page([log({ id: 1 })])),
      [doses('&from=2026-11-01')]: () => jsonResponse(200, page([log({ id: 1 })])),
      [doses('&from=2026-11-01&to=2026-11-30')]: () => jsonResponse(200, page([log({ id: 5 })])),
    })
    renderHistory()
    await screen.findByText('1 dose')

    fireEvent.change(screen.getByLabelText(/^from$/i), { target: { value: '2026-11-01' } })
    fireEvent.change(await screen.findByLabelText(/^to$/i), { target: { value: '2026-11-30' } })

    expect(await screen.findByRole('button', { name: 'Clear filters' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^from$/i)).toHaveValue('2026-11-01')
    expect(screen.getByLabelText(/^to$/i)).toHaveValue('2026-11-30')
  })

  it('starts from the filters in the address and can clear them', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses('&status=taken&from=2026-11-01')]: () => jsonResponse(200, page([log({ id: 1 })])),
      [doses()]: () => jsonResponse(200, page([log({ id: 1 }), log({ id: 2, status: 'skipped' })])),
    })
    renderHistory('/history?status=taken&from=2026-11-01')

    expect(await screen.findByText('1 dose')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Taken', pressed: true })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(await screen.findByText('2 doses')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('loads more pages', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () =>
        jsonResponse(200, { count: 2, next: 'http://x/api/doses/?page=2', previous: null, results: [log({ id: 1 })] }),
      [doses('', 2)]: () =>
        jsonResponse(200, {
          count: 2,
          next: null,
          previous: null,
          results: [log({ id: 2, scheduled_for: '2026-11-20T00:00:00Z' })],
        }),
    })
    renderHistory()

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Load more' }))

    expect(await screen.findAllByRole('listitem')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('explains an empty history, with and without filters', async () => {
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () => jsonResponse(200, page([])),
      [doses('&status=missed')]: () => jsonResponse(200, page([])),
    })
    const { unmount } = renderHistory()
    expect(await screen.findByText(/no history yet/i)).toBeInTheDocument()
    unmount()

    renderHistory('/history?status=missed')
    expect(await screen.findByText(/no doses match these filters/i)).toBeInTheDocument()
  })

  it("shows another person's history in their name", async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({
      [PROFILES]: profiles(ME, MUM_VIEW),
      'GET /api/medications/?profile=2&page_size=100': () => jsonResponse(200, MEDS),
      'GET /api/doses/?profile=2&page=1&page_size=30': () => jsonResponse(200, page([log({ id: 1 })])),
    })
    renderHistory()

    expect(await screen.findByText(/viewing Mum's history/i)).toBeInTheDocument()
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
  })

  it('shows a friendly error and lets you retry', async () => {
    let attempts = 0
    mockApi({
      [PROFILES]: profiles(ME),
      [MEDICATIONS]: () => jsonResponse(200, MEDS),
      [doses()]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, { error: { code: 'server_error', message: 'Boom' } })
          : jsonResponse(200, page([log({ id: 1 })]))
      },
    })
    renderHistory()
    expect(await screen.findByText(/couldn't load the history/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findAllByRole('listitem')).toHaveLength(1)
  })
})