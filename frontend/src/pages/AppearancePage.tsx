import { Link } from 'react-router'
import Button from '../components/Button'
import Card from '../components/Card'
import StatusTag from '../components/StatusTag'
import { ACCENT_LABELS, ACCENTS, DEFAULT_ACCENT, MODES, type ThemeMode } from '../theme/theme'
import { useTheme } from '../theme/theme-context'

const MODE_LABELS: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' }

function ModeSwatch({ mode }: { mode: ThemeMode }) {
  const frame = 'flex h-7 w-11 overflow-hidden rounded-lg border border-line-strong'
  if (mode === 'system') {
    // Half light, half dark. data-theme scopes the colors to each half.
    return (
      <span className={frame} aria-hidden="true">
        <span data-theme="light" className="w-1/2 bg-paper" />
        <span data-theme="dark" className="w-1/2 bg-paper" />
      </span>
    )
  }
  return (
    <span className={frame} aria-hidden="true">
      <span data-theme={mode} className="w-full bg-paper" />
    </span>
  )
}

const optionBase =
  'flex min-h-11 items-center rounded-2xl border bg-surface text-sm font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function sectionTitle(text: string, id: string) {
  return (
    <h2 id={id} className="mb-2 mt-6 text-xs font-bold uppercase tracking-wider text-muted">
      {text}
    </h2>
  )
}

export default function AppearancePage() {
  const { mode, accent, resolved, setMode, setAccent } = useTheme()

  return (
    <div>
      <div className="flex items-center gap-3">
        <Link
          to="/"
          aria-label="Back"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-current stroke-2" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <div>
          <p className="text-sm text-muted">Settings</p>
          <h1 className="font-display text-2xl font-bold">Appearance</h1>
        </div>
      </div>

      <section aria-labelledby="mode-title">
        {sectionTitle('Mode', 'mode-title')}
        <div className="flex gap-2">
          {MODES.map((value) => {
            const active = mode === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(value)}
                className={`${optionBase} flex-1 flex-col justify-center gap-2 py-4 ${
                  active ? 'border-accent ring-1 ring-accent' : 'border-line'
                }`}
              >
                <ModeSwatch mode={value} />
                {MODE_LABELS[value]}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-sm text-muted">System follows your phone's light or dark setting.</p>
      </section>

      <section aria-labelledby="accent-title">
        {sectionTitle('Accent color', 'accent-title')}
        <div className="grid grid-cols-2 gap-2">
          {ACCENTS.map((value) => {
            const active = accent === value
            return (
              <button
                key={value}
                type="button"
                aria-pressed={active}
                onClick={() => setAccent(value)}
                className={`${optionBase} gap-3 px-3 text-left ${
                  active ? 'border-accent ring-1 ring-accent' : 'border-line'
                }`}
              >
                {/* Both attributes scope this dot to the accent it represents. */}
                <span
                  data-theme={resolved}
                  data-accent={value}
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent text-on-accent"
                  aria-hidden="true"
                >
                  {active && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-current stroke-3">
                      <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span>{ACCENT_LABELS[value]}</span>
                {value === DEFAULT_ACCENT && <span className="text-sm font-normal text-muted">Default</span>}
              </button>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="preview-title">
        {sectionTitle('Preview', 'preview-title')}
        <Card>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">Metformin</p>
              <p className="text-sm text-muted">500 mg · 1 pill</p>
            </div>
            <StatusTag status="taken">Taken 08:03</StatusTag>
          </div>
          <Button className="mt-3">Taken</Button>
        </Card>
        <p className="mt-3 text-sm text-muted">
          Missed, low supply, and skipped keep their own colors in every theme, so they are always easy to
          tell apart. Your choice is saved on this device.
        </p>
      </section>
    </div>
  )
}