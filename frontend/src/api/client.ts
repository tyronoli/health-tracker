type Query = Record<string, string | number | boolean | undefined>

type RequestOptions = {
    method?: string
    body?: unknown
    query?: Query
}

type ErrorBody = {
    error?: { code?: unknown; message?: unknown; fields?: unknown }
}

export class ApiError extends Error {
    readonly status: number
    readonly code: string
    readonly fields: Record<string, string[]>

    constructor(
        status: number,
        code: string,
        message: string,
        fields: Record<string, string[]> = {},
    ) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.code = code
        this.fields = fields
    }
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function getCookie(name: string): string | null {
    const prefix = `${name}=`
    const entry = document.cookie.split('; ').find((part) => part.startsWith(prefix))
    return entry ? decodeURIComponent(entry.slice(prefix.length)) : null
}

async function ensureCsrfCookie(): Promise<void> {
    if (getCookie('csrftoken')) return
    await fetch('/api/auth/csrf/', { credentials: 'same-origin' })
}

function withQuery(path: string, query?: Query): string {
    if (!query) return path
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) params.set(key, String(value))
    }
    const text = params.toString()
    return text ? `${path}?${text}` : path
}

function normalizeFields(raw: unknown): Record<string, string[]> {
    const fields: Record<string, string[]> = {}
    if (raw && typeof raw === 'object') {
        for (const [name, value] of Object.entries(raw)) {
            if (typeof value === 'string') fields[name] = [value]
            else if (Array.isArray(value)) fields[name] = value.map(String)
        }
    }
    return fields
}

function parseError(status: number, data: unknown): ApiError {
    const error = (data as ErrorBody | null)?.error
    if (error && typeof error.code === 'string') {
        const message = typeof error.message === 'string' ? error.message : 'Request failed.'
        return new ApiError(status, error.code, message, normalizeFields(error.fields))
    }
    const message =
        status >= 500 ? 'The server had a problem. Please try again.' : 'Request failed.'
    return new ApiError(status, 'unexpected', message)
}

/** Anything thrown becomes an ApiError, so screens only handle one kind of error. */
export function toApiError(error: unknown): ApiError {
    if (error instanceof ApiError) return error
    return new ApiError(0, 'unexpected', 'Something went wrong. Please try again.')
}

export function fieldError(error: ApiError | null, name: string): string | undefined {
    const messages = error?.fields[name]
    return messages && messages.length > 0 ? messages.join(' ') : undefined
}

export async function api<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
    const method = (options.method ?? 'GET').toUpperCase()
    const headers: Record<string, string> = { Accept: 'application/json' }

    let body: string | undefined
    if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json'
        body = JSON.stringify(options.body)
    }

    let response: Response
    try {
        if (UNSAFE_METHODS.has(method)) {
            await ensureCsrfCookie()
            const token = getCookie('csrftoken')
            if (token) headers['X-CSRFToken'] = token
        }
        response = await fetch(withQuery(path, options.query), {
            method,
            headers,
            body,
            credentials: 'same-origin',
        })
    } catch {
        throw new ApiError(0, 'network_error', 'Cannot reach the server. Check your connection.')
    }

    if (response.status === 204) return undefined as T

    const data: unknown = await response.json().catch(() => null)
    if (!response.ok) throw parseError(response.status, data)
    return data as T
}