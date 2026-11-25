import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ME, MUM_EDIT, page } from '../test/fixtures'
import { jsonResponse, mockApi } from '../test/mockApi'
import { renderPage } from '../test/render'
import CarePage from './CarePage'

const profiles = (...list: unknown[]) => () => jsonResponse(200, list)
const PROFILES = 'GET /api/profiles/'
const CARE = 'GET /api/care-links/?page_size=100'

const person = (id: number, name: string) => ({ id, display_name: name, email: `${name.toLowerCase()}@example.com` })
const ALEX = person(1, 'Alex')

function link(overrides: Record<string, unknown>) {
  return {
    id: 10,
    caregiver: person(3, 'Sam'),
    recipient: ALEX,
    permission: 'view',
    status: 'pending',
    created_at: '2026-11-20T01:00:00Z',
    responded_at: null,
    ...overrides,
  }
}

const SAM_REQUEST = link({ id: 10 })
const KIM_REQUEST = link({ id: 11, caregiver: person(4, 'Kim'), permission: 'edit' })
const DAD_VIEWER = link({ id: 12, caregiver: person(5, 'Dad'), status: 'active' })
const MUM_CARED_FOR = link({ id: 13, caregiver: ALEX, recipient: person(2, 'Mum'), status: 'active', permission: 'edit' })
const GRAN_WAITING = link({ id: 14, caregiver: ALEX, recipient: person(6, 'Gran'), status: 'pending' })
const OLD_REVOKED = link({ id: 15, caregiver: person(7, 'Lee'), status: 'revoked' })
const ALL = [SAM_REQUEST, KIM_REQUEST, DAD_VIEWER, MUM_CARED_FOR, GRAN_WAITING, OLD_REVOKED]

const card = (name: string) => screen.getByText(name).closest('li') as HTMLElement

function renderCare() {
  return renderPage(<CarePage />, { route: '/care', path: '/care' })
}

function withLinks(extra: Record<string, (init?: RequestInit) => Response> = {}, links: unknown[] = ALL) {
  return mockApi({
    [PROFILES]: profiles(ME, MUM_EDIT),
    [CARE]: () => jsonResponse(200, page(links)),
    ...extra,
  })
}

beforeEach(() => {
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('who is in my circle', () => {
  it('sorts links into requests, viewers, people I care for and waiting', async () => {
    withLinks()
    renderCare()

    expect(await screen.findByText('Sam')).toBeInTheDocument()
    expect(screen.getAllByText(/wants to see your medications and doses/)).toHaveLength(2) // Sam and Kim
    expect(screen.getByText(/Requested access: view only/)).toBeInTheDocument()
    expect(screen.getByText(/Requested access: can edit/)).toBeInTheDocument()

    expect(within(card('Dad')).getByText('View only')).toBeInTheDocument()
    expect(within(card('Mum')).getByText('Can edit')).toBeInTheDocument()
    expect(within(card('Gran')).getByText('Waiting')).toBeInTheDocument()
    expect(screen.queryByText('Lee')).not.toBeInTheDocument() // revoked links stay hidden
  })

  it('explains an empty circle', async () => {
    withLinks({}, [])
    renderCare()
    expect(await screen.findByText(/no one is connected yet/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/their email/i)).toBeInTheDocument()
  })

  it('shows a friendly error and lets you retry', async () => {
    let attempts = 0
    mockApi({
      [PROFILES]: profiles(ME),
      [CARE]: () => {
        attempts += 1
        return attempts === 1
          ? jsonResponse(500, { error: { code: 'server_error', message: 'Boom' } })
          : jsonResponse(200, page([SAM_REQUEST]))
      },
    })
    renderCare()
    expect(await screen.findByText(/couldn't load your care circle/i)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: /try again/i }))
    expect(await screen.findByText('Sam')).toBeInTheDocument()
  })
})

describe('requests for me', () => {
  it('accepts a view-only request', async () => {
    let sent: unknown
    withLinks({
      'POST /api/care-links/10/accept/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, { ...SAM_REQUEST, status: 'active' })
      },
    })
    renderCare()
    await screen.findByText('Sam')

    await userEvent.setup().click(within(card('Sam')).getByRole('button', { name: 'Accept' }))

    await waitFor(() => expect(sent).toEqual({}))
  })

  it('lets me accept an edit request as view only', async () => {
    let sent: unknown
    withLinks({
      'POST /api/care-links/11/accept/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, { ...KIM_REQUEST, status: 'active', permission: 'view' })
      },
    })
    renderCare()
    await screen.findByText('Kim')

    await userEvent.setup().click(within(card('Kim')).getByRole('button', { name: 'Accept: view only' }))

    await waitFor(() => expect(sent).toEqual({ permission: 'view' }))
  })

  it('declines a request', async () => {
    let declined = false
    withLinks({
      'POST /api/care-links/10/decline/': () => {
        declined = true
        return jsonResponse(200, { ...SAM_REQUEST, status: 'declined' })
      },
    })
    renderCare()
    await screen.findByText('Sam')

    await userEvent.setup().click(within(card('Sam')).getByRole('button', { name: 'Decline' }))

    await waitFor(() => expect(declined).toBe(true))
  })

  it('explains it when the request already changed', async () => {
    withLinks({
      'POST /api/care-links/10/accept/': () =>
        jsonResponse(409, { error: { code: 'invalid_state', message: 'This link is active.' } }),
    })
    renderCare()
    await screen.findByText('Sam')

    await userEvent.setup().click(within(card('Sam')).getByRole('button', { name: 'Accept' }))

    expect(await screen.findByText(/already changed/i)).toBeInTheDocument()
  })
})

describe('people who can see my data', () => {
  it('lets me allow editing', async () => {
    let sent: unknown
    withLinks({
      'PATCH /api/care-links/12/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, { ...DAD_VIEWER, permission: 'edit' })
      },
    })
    renderCare()
    await screen.findByText('Dad')

    await userEvent.setup().click(within(card('Dad')).getByRole('button', { name: 'Allow editing' }))

    await waitFor(() => expect(sent).toEqual({ permission: 'edit' }))
  })

  it('asks before removing access', async () => {
    let revoked = false
    withLinks({
      'POST /api/care-links/12/revoke/': () => {
        revoked = true
        return jsonResponse(200, { ...DAD_VIEWER, status: 'revoked' })
      },
    })
    renderCare()
    await screen.findByText('Dad')
    const user = userEvent.setup()

    await user.click(within(card('Dad')).getByRole('button', { name: 'Remove access' }))
    expect(revoked).toBe(false)
    expect(screen.getByText(/will no longer see your data/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }))

    await waitFor(() => expect(revoked).toBe(true))
  })
})

describe('people I care for', () => {
  it("opens the person's day", async () => {
    withLinks()
    renderCare()
    await screen.findByText('Mum')

    await userEvent.setup().click(screen.getByRole('button', { name: "Open Mum's day" }))

    expect(await screen.findByTestId('location')).toHaveTextContent('/')
    expect(localStorage.getItem('ht-profile')).toBe('2')
  })

  it('asks before I stop viewing someone', async () => {
    let revoked = false
    withLinks({
      'POST /api/care-links/13/revoke/': () => {
        revoked = true
        return jsonResponse(200, { ...MUM_CARED_FOR, status: 'revoked' })
      },
    })
    renderCare()
    await screen.findByText('Mum')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Stop viewing Mum' }))
    expect(revoked).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Yes, stop viewing' }))

    await waitFor(() => expect(revoked).toBe(true))
  })
})

describe('requests I sent', () => {
  it('cancels a request that is still waiting', async () => {
    let revoked = false
    withLinks({
      'POST /api/care-links/14/revoke/': () => {
        revoked = true
        return jsonResponse(200, { ...GRAN_WAITING, status: 'revoked' })
      },
    })
    renderCare()
    await screen.findByText('Gran')

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel request to Gran' }))

    await waitFor(() => expect(revoked).toBe(true))
  })

  it('sends a request and shows the same message whether or not the account exists', async () => {
    let sent: unknown
    withLinks({
      'POST /api/care-links/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, { message: 'If an account exists for that email, an invitation has been sent.' })
      },
    }, [])
    renderCare()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/their email/i), 'mum@example.com')
    await user.click(screen.getByRole('radio', { name: /can edit/i }))
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText(/if an account exists for that email/i)).toBeInTheDocument()
    expect(sent).toEqual({ email: 'mum@example.com', permission: 'edit' })
    expect(screen.getByLabelText(/their email/i)).toHaveValue('')
  })

  it('shows a problem with the email under the field', async () => {
    withLinks({
      'POST /api/care-links/': () =>
        jsonResponse(400, {
          error: {
            code: 'validation_error',
            message: 'One or more fields are invalid.',
            fields: { email: ['You cannot link to yourself.'] },
          },
        }),
    }, [])
    renderCare()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/their email/i), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('You cannot link to yourself.')).toBeInTheDocument()
  })

  it('explains it when a link already exists', async () => {
    withLinks({
      'POST /api/care-links/': () =>
        jsonResponse(409, { error: { code: 'link_exists', message: 'A link with this person already exists.' } }),
    }, [])
    renderCare()
    const user = userEvent.setup()

    await user.type(await screen.findByLabelText(/their email/i), 'mum@example.com')
    await user.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument()
  })
})