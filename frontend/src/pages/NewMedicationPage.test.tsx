import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_EDIT, MUM_VIEW, medication } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import NewMedicationPage from './NewMedicationPage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)

function renderNew() {
  return renderPage(<NewMedicationPage />, { route: '/medications/new', path: '/medications/new' })
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/^name$/i), 'Metformin')
  await user.type(screen.getByLabelText(/^dosage$/i), '500 mg')
  await user.type(screen.getByLabelText(/^instructions$/i), 'with food')
  await user.type(screen.getByLabelText(/pills in stock/i), '30')
  await user.type(screen.getByLabelText(/low-supply alert at/i), '10')
}

beforeEach(() => {
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('add medication', () => {
  it('saves the medication and opens its page', async () => {
    let sent: unknown
    mockApi({
      'GET /api/profiles/': profiles(ME),
      'POST /api/medications/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, medication({ id: 7 }))
      },
    })
    renderNew()
    const user = userEvent.setup()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save medication' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/medications/7')
    expect(sent).toEqual({
      profile: 1,
      name: 'Metformin',
      dosage: '500 mg',
      instructions: 'with food',
      pills_remaining: 30,
      refill_threshold: 10,
    })
  })

  it('shows the backend validation message under the field', async () => {
    mockApi({
      'GET /api/profiles/': profiles(ME),
      'POST /api/medications/': () =>
        jsonResponse(400, {
          error: {
            code: 'validation_error',
            message: 'One or more fields are invalid.',
            fields: { pills_remaining: ['Ensure this value is less than or equal to 100000.'] },
          },
        }),
    })
    renderNew()
    const user = userEvent.setup()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save medication' }))

    expect(await screen.findByText(/less than or equal to 100000/i)).toBeInTheDocument()
    expect(screen.queryByTestId('location')).not.toBeInTheDocument()
  })

  it('creates it for the selected profile when you can edit it', async () => {
    localStorage.setItem('ht-profile', '2')
    let sent: { profile?: number } = {}
    mockApi({
      'GET /api/profiles/': profiles(ME, MUM_EDIT),
      'POST /api/medications/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, medication({ id: 9, owner: 2 }))
      },
    })
    renderNew()
    const user = userEvent.setup()

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: 'Save medication' }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/medications/9')
    expect(sent.profile).toBe(2)
  })

  it('shows no form on a view-only profile', async () => {
    localStorage.setItem('ht-profile', '2')
    mockApi({ 'GET /api/profiles/': profiles(ME, MUM_VIEW) })
    renderNew()
    expect(await screen.findByText(/view-only access/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument()
  })
})