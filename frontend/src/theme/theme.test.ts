import { describe, expect, it } from 'vitest'
import { applyTheme, loadPreferences, resolveTheme, savePreferences } from './theme'

function fakeStorage(initial: Record<string, string> = {}) {
  const data: Record<string, string> = { ...initial }
  return {
    data,
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value
    },
  }
}

describe('preferences', () => {
  it('defaults to system mode and the pine accent', () => {
    expect(loadPreferences(fakeStorage())).toEqual({ mode: 'system', accent: 'pine' })
  })

  it('reads saved values', () => {
    const storage = fakeStorage({ 'ht-theme-mode': 'dark', 'ht-theme-accent': 'plum' })
    expect(loadPreferences(storage)).toEqual({ mode: 'dark', accent: 'plum' })
  })

  it('ignores values it does not know', () => {
    const storage = fakeStorage({ 'ht-theme-mode': 'neon', 'ht-theme-accent': 'pink' })
    expect(loadPreferences(storage)).toEqual({ mode: 'system', accent: 'pine' })
  })

  it('saves both values', () => {
    const storage = fakeStorage()
    savePreferences({ mode: 'light', accent: 'slate' }, storage)
    expect(storage.data).toEqual({ 'ht-theme-mode': 'light', 'ht-theme-accent': 'slate' })
  })

  it('survives storage that throws, such as private browsing', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(loadPreferences(broken)).toEqual({ mode: 'system', accent: 'pine' })
    expect(() => savePreferences({ mode: 'dark', accent: 'plum' }, broken)).not.toThrow()
  })
})

describe('resolveTheme', () => {
  it.each([
    ['system', false, 'light'],
    ['system', true, 'dark'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
  ] as const)('%s with system dark=%s is %s', (mode, prefersDark, expected) => {
    expect(resolveTheme(mode, prefersDark)).toBe(expected)
  })
})

describe('applyTheme', () => {
  it('sets the data attributes the CSS listens to', () => {
    const element = document.createElement('div')
    applyTheme('system', 'indigo', true, element)
    expect(element.dataset.theme).toBe('dark')
    expect(element.dataset.accent).toBe('indigo')
  })
})