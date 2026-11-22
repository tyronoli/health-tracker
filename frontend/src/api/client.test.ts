import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './client'

const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })

beforeEach(() => {
    document.cookie = 'csrftoken=; Max-Age=0; path=/'
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('api client', () => {
    it('sends GET requests without a CSRF header and parses the JSON', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json(200, { ok: true }))
        vi.stubGlobal('fetch', fetchMock)

        const data = await api<{ ok: boolean }>('/api/thing/')

        expect(data).toEqual({ ok: true })
        const [, init] = fetchMock.mock.calls[0]
        expect(init.method).toBe('GET')
        expect(init.headers['X-CSRFToken']).toBeUndefined()
    })

    it('adds the CSRF header and a JSON body to unsafe requests', async () => {
        document.cookie = 'csrftoken=abc123; path=/'
        const fetchMock = vi.fn().mockResolvedValue(json(200, {}))
        vi.stubGlobal('fetch', fetchMock)

        await api('/api/thing/', { method: 'POST', body: { a: 1 } })

        const [, init] = fetchMock.mock.calls[0]
        expect(init.headers['X-CSRFToken']).toBe('abc123')
        expect(init.headers['Content-Type']).toBe('application/json')
        expect(init.body).toBe(JSON.stringify({ a: 1 }))
    })

    it('fetches the CSRF cookie first when it is missing', async () => {
        const fetchMock = vi
            .fn()
            .mockImplementationOnce(async () => {
                document.cookie = 'csrftoken=fresh; path=/'
                return new Response(null, { status: 204 })
            })
            .mockResolvedValueOnce(json(200, {}))
        vi.stubGlobal('fetch', fetchMock)

        await api('/api/thing/', { method: 'POST', body: {} })

        expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/csrf/')
        expect(fetchMock.mock.calls[1][1].headers['X-CSRFToken']).toBe('fresh')
    })

    it('returns undefined for 204 responses', async () => {
        document.cookie = 'csrftoken=abc; path=/'
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
        expect(await api('/api/auth/logout/', { method: 'POST' })).toBeUndefined()
    })

    it('turns the backend error shape into an ApiError', async () => {
        const body = {
            error: {
                code: 'validation_error',
                message: 'One or more fields are invalid.',
                fields: { password: ['Too short.'] },
            },
        }
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, body)))

        const error = await api('/api/x/').catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({
            status: 400,
            code: 'validation_error',
            message: 'One or more fields are invalid.',
            fields: { password: ['Too short.'] },
        })
    })

    it('copes with error pages that are not JSON', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<h1>Oops</h1>', { status: 500 })))
        await expect(api('/api/x/')).rejects.toMatchObject({ status: 500, code: 'unexpected' })
    })

    it('reports network failures as an ApiError', async () => {
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
        await expect(api('/api/x/')).rejects.toMatchObject({ status: 0, code: 'network_error' })
    })

    it('builds query strings and skips undefined values', async () => {
        const fetchMock = vi.fn().mockResolvedValue(json(200, []))
        vi.stubGlobal('fetch', fetchMock)

        await api('/api/doses/', { query: { profile: 2, status: undefined, active: true } })

        expect(fetchMock.mock.calls[0][0]).toBe('/api/doses/?profile=2&active=true')
    })
})