import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

const TABS: { to: string; label: string; end?: boolean; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Today',
    end: true,
    icon: (
      <>
        <rect x="3" y="4" width="18" height="17" rx="3" />
        <path d="M8 2v4M16 2v4M3 10h18" />
      </>
    ),
  },
  {
    to: '/medications',
    label: 'Medications',
    icon: (
      <>
        <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
        <path d="m8.5 8.5 7 7" />
      </>
    ),
  },
  {
    to: '/appointments',
    label: 'Appointments',
    icon: (
      <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1M9 13l2 2 4-4" />
      </>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    to: '/care',
    label: 'Care',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M17.5 14.2c2.4 0 4 1.7 4 4.3" />
      </>
    ),
  },
]

export default function TabBar() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-nav">
      <ul className="mx-auto flex max-w-3xl">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex h-[76px] flex-col items-center justify-center gap-1 text-[11px] focus-visible:outline-2 focus-visible:outline-accent ${
                  isActive ? 'font-bold text-accent-ink' : 'font-medium text-muted'
                }`
              }
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                className="h-[22px] w-[22px] fill-none stroke-current stroke-2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {tab.icon}
              </svg>
              {tab.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}