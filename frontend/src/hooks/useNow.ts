import { useEffect, useState } from 'react'

/** The current time in ms, refreshed on an interval so "due in 30 min" stays accurate. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}