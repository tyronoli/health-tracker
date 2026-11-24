
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './context/AuthProvider'
import { jsonResponse, mockApi } from './test/mockApi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const USER = {
  id: 1,
  email: 'alex@example.com',
  display_name: 'Alex',
  timezone: 'Asia/Manila',
}

const NOT_LOGGED_IN = () =>
  jsonResponse(401, {
    error: { code: 'not_authenticated', message: 'Not logged in.' },
  })

const LOGGED_IN_DAY = {
  'GET /api/profiles/': () =>
    jsonResponse(200, [
      {
        user_id: 1,
        display_name: 'Alex',
        relationship: 'self',
        permission: 'edit',
      },
    ]),
  'GET /api/doses/today/?profile=1': () =>
    jsonResponse(200, {
      date: '2026-11-22',
      timezone: 'Asia/Manila',
      doses: [],
    }),
}

function renderApp(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  document.cookie = 'csrftoken=test-token; path=/'
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

describe('authentication screens', () => {
  it('sends an anonymous visitor to the login page', async () => {
    mockApi({
      'GET /api/auth/me/': NOT_LOGGED_IN,
    })

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: /log in/i }),
    ).toBeInTheDocument()
  })

  it('keeps a logged-in user on the home page after a refresh', async () => {
    mockApi({
      'GET /api/auth/me/': () => jsonResponse(200, USER),
      ...LOGGED_IN_DAY,
    })

    renderApp('/')

    expect(
      await screen.findByRole('heading', { name: 'Today' }),
    ).toBeInTheDocument()
  })

  it('logs in and lands on the home page', async () => {
    let sent: unknown

    mockApi({
      'GET /api/auth/me/': NOT_LOGGED_IN,
      'POST /api/auth/login/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(200, USER)
      },
      ...LOGGED_IN_DAY,
    })

    renderApp('/login')
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText(/email/i),
      'alex@example.com',
    )
    await user.type(screen.getByLabelText(/password/i), 'S3cret-pass')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(
      await screen.findByRole('heading', { name: 'Today' }),
    ).toBeInTheDocument()

    expect(sent).toEqual({
      email: 'alex@example.com',
      password: 'S3cret-pass',
    })
  })

  it('shows the backend message when the password is wrong', async () => {
    mockApi({
      'GET /api/auth/me/': NOT_LOGGED_IN,
      'POST /api/auth/login/': () =>
        jsonResponse(400, {
          error: {
            code: 'invalid_credentials',
            message: 'Invalid email or password.',
          },
        }),
    })

    renderApp('/login')
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText(/email/i),
      'alex@example.com',
    )
    await user.type(screen.getByLabelText(/password/i), 'wrong')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(
      await screen.findByText('Invalid email or password.'),
    ).toBeInTheDocument()

    expect(
      screen.getByRole('heading', { name: /log in/i }),
    ).toBeInTheDocument()
  })

  it('registers a new account and signs in', async () => {
    let sent: Record<string, string> = {}

    mockApi({
      'GET /api/auth/me/': NOT_LOGGED_IN,
      'POST /api/auth/register/': (init) => {
        sent = JSON.parse(String(init?.body))
        return jsonResponse(201, USER)
      },
      ...LOGGED_IN_DAY,
    })

    renderApp('/register')
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText(/display name/i),
      'Alex',
    )
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/password/i), 'S3cret-pass')
    await user.click(
      screen.getByRole('button', { name: /create account/i }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Today' }),
    ).toBeInTheDocument()

    expect(sent).toMatchObject({
      email: 'alex@example.com',
      display_name: 'Alex',
    })

    expect(sent.timezone).toBeTruthy()
  })

  it('shows field errors from the backend under the right input', async () => {
    mockApi({
      'GET /api/auth/me/': NOT_LOGGED_IN,
      'POST /api/auth/register/': () =>
        jsonResponse(400, {
          error: {
            code: 'validation_error',
            message: 'One or more fields are invalid.',
            fields: {
              password: ['This password is too common.'],
            },
          },
        }),
    })

    renderApp('/register')
    const user = userEvent.setup()

    await user.type(
      await screen.findByLabelText(/email/i),
      'alex@example.com',
    )
    await user.type(screen.getByLabelText(/password/i), 'password')
    await user.click(
      screen.getByRole('button', { name: /create account/i }),
    )

    expect(
      await screen.findByText('This password is too common.'),
    ).toBeInTheDocument()
  })

  it('logs out and returns to the login page', async () => {
    mockApi({
      'GET /api/auth/me/': () => jsonResponse(200, USER),
      'POST /api/auth/logout/': () => jsonResponse(204),
    })

    renderApp('/')
    const user = userEvent.setup()

    await user.click(
      await screen.findByRole('button', { name: /log out/i }),
    )

    expect(
      await screen.findByRole('heading', { name: /log in/i }),
    ).toBeInTheDocument()
  })
})
