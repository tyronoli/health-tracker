import { useState } from 'react'
import { Link } from 'react-router'
import type { Medication } from '../api/types'
import { daysLeftText, pillsText, scheduleLine, supplyFraction } from '../lib/medication'
import Button from './Button'
import Card from './Card'
import RefillForm from './RefillForm'
import StatusTag from './StatusTag'
import SupplyBar from './SupplyBar'

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3 w-3 fill-none stroke-current stroke-[3]">
      <path d="M12 3l10 18H2z" strokeLinejoin="round" />
      <path d="M12 10v5M12 18h.01" strokeLinecap="round" />
    </svg>
  )
}

export default function MedicationCard({ medication: m, canWrite }: { medication: Medication; canWrite: boolean }) {
  const [refilling, setRefilling] = useState(false)
  const pills = pillsText(m.pills_remaining)
  const detail = [scheduleLine(m.schedules), m.instructions].filter(Boolean).join(' · ')

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p>
            <Link
              to={`/medications/${m.id}`}
              className="font-semibold text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {m.name}
            </Link>{' '}
            <span className="text-sm text-muted">{m.dosage}</span>
          </p>
          <p className="line-clamp-1 text-sm text-muted">{detail}</p>
        </div>
        {!m.active ? (
          <StatusTag status="skipped">Stopped</StatusTag>
        ) : m.low_supply ? (
          <StatusTag status="low">
            <WarningIcon />
            Low supply
          </StatusTag>
        ) : (
          <StatusTag status="taken">{pills}</StatusTag>
        )}
      </div>

      <SupplyBar fraction={supplyFraction(m)} low={m.low_supply} />
      <p className="text-sm text-muted">{m.low_supply ? `${pills} · ${daysLeftText(m)}` : daysLeftText(m)}</p>

      {canWrite && m.active && m.low_supply && (
        refilling ? (
          <RefillForm medication={m} onDone={() => setRefilling(false)} />
        ) : (
          <Button variant="secondary" className="mt-3 w-full" onClick={() => setRefilling(true)}>
            I refilled
          </Button>
        )
      )}
    </Card>
  )
}