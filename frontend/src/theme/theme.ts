export const MODES = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof MODES)[number]

export const ACCENTS = ['pine', 'indigo', 'plum', 'slate'] as const
export type Accent = (typeof ACCENTS)[number]

export const DEFAULT_MODE: ThemeMode = 'system'
export const DEFAULT_ACCENT: Accent = 'pine'

export const ACCENT_LABELS: Record<Accent, string> = {
  pine: 'Pine',
  indigo: 'Indigo',
  plum: 'Plum',
  slate: 'Slate',
}

export type Preferences = { mode: ThemeMode; accent: Accent }

// Keep these two keys in sync with the inline script in index.html.
const MODE_KEY = 'ht-theme-mode'
const ACCENT_KEY = 'ht-theme-accent'

function isMode(value: unknown): value is ThemeMode {
  return MODES.includes(value as ThemeMode)
}

function isAccent(value: unknown): value is Accent {
  return ACCENTS.includes(value as Accent)
}

export function loadPreferences(
  storage: Pick<Storage, 'getItem'> = localStorage,
): Preferences {
  try {
    const mode = storage.getItem(MODE_KEY)
    const accent = storage.getItem(ACCENT_KEY)
    return {
      mode: isMode(mode) ? mode : DEFAULT_MODE,
      accent: isAccent(accent) ? accent : DEFAULT_ACCENT,
    }
  } catch {
    return { mode: DEFAULT_MODE, accent: DEFAULT_ACCENT }
  }
}

export function savePreferences(
  prefs: Preferences,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  try {
    storage.setItem(MODE_KEY, prefs.mode)
    storage.setItem(ACCENT_KEY, prefs.accent)
  } catch {
    // Storage can be blocked (private browsing). The theme still works for this visit.
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function applyTheme(
  mode: ThemeMode,
  accent: Accent,
  prefersDark: boolean,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = resolveTheme(mode, prefersDark)
  root.dataset.accent = accent
}