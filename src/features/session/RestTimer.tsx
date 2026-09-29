import { useEffect, useRef, useState } from 'react'
import type { Session } from '../../db/schema'
import { adjustSessionRest, skipRest } from '../../db/repo'
import { beep } from '../../lib/device'
import { formatClock, remainingSec } from '../../lib/timer'

/** Sticky rest timer. Display is derived from the stored end time, so reloads resume exactly. */
export function RestTimer({ session }: { session: Session }) {
  const [now, setNow] = useState(Date.now())
  const beeped = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (session.restEndsAt === undefined) return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [session.restEndsAt])

  const left = remainingSec(session, now)
  useEffect(() => {
    if (left === 0 && session.restEndsAt !== undefined && beeped.current !== session.restEndsAt) {
      beeped.current = session.restEndsAt
      // Only beep if the rest just ended, not when reopening long after.
      if (now - session.restEndsAt < 3000) beep()
    }
  }, [left, now, session.restEndsAt])

  if (left === undefined) return null
  const total = session.restTotalSec ?? 1
  const pct = Math.min(100, Math.max(0, (1 - left / total) * 100))
  const done = left === 0

  return (
    <div className="border-b border-line">
      <div className="h-1 bg-line">
        <div className={`h-1 ${done ? 'bg-good' : 'bg-target'}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 px-3 py-1">
        <div className="flex-1">
          <span className="text-xs text-muted">{done ? 'Rest done' : 'Rest'}</span>
          <span className={`ml-2 text-2xl font-bold num ${done ? 'text-good' : ''}`}>{formatClock(left)}</span>
        </div>
        {!done && (
          <>
            <button onClick={() => adjustSessionRest(session.id, -15)} className="min-h-12 min-w-14 rounded-xl bg-surface-2 num">
              −15
            </button>
            <button onClick={() => adjustSessionRest(session.id, 15)} className="min-h-12 min-w-14 rounded-xl bg-surface-2 num">
              +15
            </button>
          </>
        )}
        <button onClick={() => skipRest(session.id)} className="min-h-12 min-w-14 rounded-xl bg-surface-2 px-3">
          {done ? 'Hide' : 'Skip'}
        </button>
      </div>
    </div>
  )
}
