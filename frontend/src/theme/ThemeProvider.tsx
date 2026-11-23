import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  applyTheme,
  loadPreferences,
  resolveTheme,
  savePreferences,
  systemPrefersDark,
  type Accent,
  type ThemeMode,
} from './theme'
import { ThemeContext, type ThemeContextValue } from './theme-context'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(() => loadPreferences())
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark)

  // Follow the operating system live while the mode is "system".
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    applyTheme(prefs.mode, prefs.accent, prefersDark)
  }, [prefs, prefersDark])

  useEffect(() => {
    savePreferences(prefs)
  }, [prefs])

  const setMode = useCallback((mode: ThemeMode) => setPrefs((p) => ({ ...p, mode })), [])
  const setAccent = useCallback((accent: Accent) => setPrefs((p) => ({ ...p, accent })), [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode: prefs.mode,
      accent: prefs.accent,
      resolved: resolveTheme(prefs.mode, prefersDark),
      setMode,
      setAccent,
    }),
    [prefs, prefersDark, setMode, setAccent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}