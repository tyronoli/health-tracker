import { vi } from 'vitest'

type Handler = (init?: RequestInit) => Response | Promise<Response>

export const jsonResponse = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

/** Routes are keyed like "POST /api/auth/login/". Unexpected requests fail the test. */
export function mockApi(routes: Record<string, Handler>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const key = `${(init?.method ?? 'GET').toUpperCase()} ${String(input)}`
        const handler = routes[key]
        if (!handler) throw new Error(`Unexpected request: ${key}`)
        return handler(init)
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}