import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ProfileProvider } from '../context/ProfileProvider'
import Location from './Location'

export function renderPage(
  element: ReactElement,
  { route, path }: { route: string; path: string },
) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>
        <ProfileProvider>
          <Routes>
            <Route path={path} element={element} />
            <Route path="*" element={<Location />} />
          </Routes>
        </ProfileProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}