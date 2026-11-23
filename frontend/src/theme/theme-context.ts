import { createContext, useContext } from 'react'
import type { Accent, ThemeMode } from './theme'

export type ThemeContextValue = {
    mode: ThemeMode
    accent: Accent
    resolved: 'light' | 'dark'
    setMode: (mode: ThemeMode) => void
    setAccent: (accent: Accent) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
    const value = useContext(ThemeContext)
    if (!value) throw new Error('useTheme must be used inside <ThemeProvider>')
    return value
}