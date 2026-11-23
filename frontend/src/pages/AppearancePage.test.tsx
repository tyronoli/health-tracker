import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { ThemeProvider } from '../theme/ThemeProvider'
import AppearancePage from './AppearancePage'

const root = document.documentElement

function stubSystemDark(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <AppearancePage />
      </ThemeProvider>
    </MemoryRouter>,
  )
}

describe('Appearance screen', () => {
  it('starts on System mode with the Pine accent', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /^system$/i, pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pine/i, pressed: true })).toBeInTheDocument()
    expect(root.dataset.theme).toBe('light')
    expect(root.dataset.accent).toBe('pine')
  })

  it('follows the system setting in System mode', () => {
    stubSystemDark(true)
    renderPage()
    expect(root.dataset.theme).toBe('dark')
  })

  it('switches to dark and remembers it', async () => {
    renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /^dark$/i }))
    expect(screen.getByRole('button', { name: /^dark$/i, pressed: true })).toBeInTheDocument()
    expect(root.dataset.theme).toBe('dark')
    expect(localStorage.getItem('ht-theme-mode')).toBe('dark')
  })

  it('lets Light override a dark system setting', async () => {
    stubSystemDark(true)
    renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /^light$/i }))
    expect(root.dataset.theme).toBe('light')
  })

  it('changes the accent and remembers it', async () => {
    renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /indigo/i }))
    expect(screen.getByRole('button', { name: /indigo/i, pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /pine/i, pressed: false })).toBeInTheDocument()
    expect(root.dataset.accent).toBe('indigo')
    expect(localStorage.getItem('ht-theme-accent')).toBe('indigo')
  })

  it('restores saved choices', () => {
    localStorage.setItem('ht-theme-mode', 'dark')
    localStorage.setItem('ht-theme-accent', 'plum')
    renderPage()
    expect(screen.getByRole('button', { name: /^dark$/i, pressed: true })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /plum/i, pressed: true })).toBeInTheDocument()
    expect(root.dataset.theme).toBe('dark')
    expect(root.dataset.accent).toBe('plum')
  })

  it('ignores junk in storage', () => {
    localStorage.setItem('ht-theme-mode', 'neon')
    localStorage.setItem('ht-theme-accent', 'pink')
    renderPage()
    expect(root.dataset.theme).toBe('light')
    expect(root.dataset.accent).toBe('pine')
  })
})