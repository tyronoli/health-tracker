import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import html from '../../index.html?raw'
import { ACCENTS } from './theme'

// Vitest blanks CSS imports (even ?raw), so read the stylesheet from disk instead.
// fileURLToPath is Node's own helper, so jsdom's replacement URL class is not involved.
const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8')

type Block = Record<string, string>

function parseBlocks(source: string): Record<string, Block> {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '')
  const blocks: Record<string, Block> = {}
  for (const match of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = (match[1] ?? '').split(';').pop()?.trim() ?? ''
    const vars: Block = {}
    for (const decl of (match[2] ?? '').matchAll(/--color-([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) {
      const [, name = '', value = ''] = decl
      vars[name] = value
    }
    blocks[selector] = { ...(blocks[selector] ?? {}), ...vars }
  }
  return blocks
}

const blocks = parseBlocks(css)

function tokensFor(mode: 'light' | 'dark', accent: string): Block {
  const tokens: Block = { ...blocks['@theme static'] }
  if (mode === 'dark') Object.assign(tokens, blocks['[data-theme="dark"]'])
  if (accent !== 'pine') Object.assign(tokens, blocks[`[data-accent="${accent}"]`])
  if (mode === 'dark' && accent !== 'pine') {
    Object.assign(tokens, blocks[`[data-theme="dark"][data-accent="${accent}"]`])
  }
  return tokens
}

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
}

function contrast(a: string, b: string): number {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// [foreground token, background token, minimum ratio]
const PAIRS: [string, string, number][] = [
  ['ink', 'paper', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'nav', 4.5],
  ['muted', 'paper', 4.5],
  ['muted', 'surface', 4.5],
  ['muted', 'nav', 4.5],
  ['accent-ink', 'paper', 4.5],
  ['accent-ink', 'surface', 4.5],
  ['accent-ink', 'accent-soft', 4.5],
  ['on-accent', 'accent', 4.5],
  ['on-hero', 'hero', 4.5],
  ['taken-ink', 'taken-bg', 4.5],
  ['missed-ink', 'missed-bg', 4.5],
  ['missed-ink', 'surface', 4.5],
  ['low-ink', 'low-bg', 4.5],
  ['skipped-ink', 'skipped-bg', 4.5],
  ['info-ink', 'info-bg', 4.5],
  ['accent', 'paper', 3], // the accent as a border, ring or icon
  ['accent', 'surface', 3],
]

const COMBOS = (['light', 'dark'] as const).flatMap((mode) =>
  ACCENTS.map((accent) => [mode, accent] as const),
)

describe('theme contrast', () => {
  it.each(COMBOS)('%s mode with the %s accent meets WCAG contrast', (mode, accent) => {
    const tokens = tokensFor(mode, accent)
    const failures: string[] = []
    for (const [fg, bg, min] of PAIRS) {
      const a = tokens[fg]
      const b = tokens[bg]
      if (!a || !b) {
        failures.push(`${fg} on ${bg}: token missing`)
        continue
      }
      const ratio = contrast(a, b)
      if (ratio < min) failures.push(`${fg} on ${bg}: ${ratio.toFixed(2)} (needs ${min})`)
    }
    expect(failures).toEqual([])
  })
})

describe('pre-paint script', () => {
  it('uses the same storage keys as the theme code', () => {
    expect(html).toContain('ht-theme-mode')
    expect(html).toContain('ht-theme-accent')
  })
})