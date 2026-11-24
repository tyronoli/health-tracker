import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Retry network problems and server errors, never answers like 403 or 404.
        retry: (failureCount, error) =>
          error instanceof ApiError && (error.status === 0 || error.status >= 500) && failureCount < 2,
        staleTime: 15_000,
      },
    },
  })
}