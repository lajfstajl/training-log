import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/schema'
import { epley } from '../../engine/e1rm'
import { fmtKg, fmtSet } from '../../lib/format'
import { Empty } from '../../ui'

async function bests() {
  const finished = new Set((await db.sessions.where('status').equals('finished').toArray()).map((s) => s.id))
  const sets = (await db.sets.toArray()).filter((s) => finished.has(s.sessionId) && !s.isWarmup && s.completedAt !== undefined)
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  const byEx = new Map<string, typeof sets>()
  for (const s of sets) byEx.set(s.exerciseId, [...(byEx.get(s.exerciseId) ?? []), s])

  return [...byEx.entries()]
    .map(([id, xs]) => {
      const ex = exercises.get(id)!
      const sessions = new Set(xs.map((s) => s.sessionId)).size
      let bestE1rm = 0
      let best = xs[0]
      for (const s of xs) {
        if (ex.trackingType === 'weight_reps') {
          const e = epley(s.kg ?? 0, s.reps ?? 0) ?? 0
          if (e > bestE1rm) [bestE1rm, best] = [e, s]
        } else {
          const v = ex.trackingType === 'timed_hold' ? (s.seconds ?? 0) : (s.reps ?? 0)
          const b = ex.trackingType === 'timed_hold' ? (best.seconds ?? 0) : (best.reps ?? 0)
          if (v > b || (v === b && (s.kg ?? 0) > (best.kg ?? 0))) best = s
        }
      }
      return { ex, sessions, bestE1rm, best }
    })
    .sort((a, b) => b.sessions - a.sessions)
}

export function ProgressTab() {
  const rows = useLiveQuery(bests, [])
  return (
    <div className="pt-safe px-4">
      <h1 className="pt-6 pb-1 text-2xl font-bold">Progress</h1>
      <p className="mb-4 text-sm text-muted">Your best set so far for each exercise.</p>
      {rows && rows.length === 0 && <Empty>Log a session to see progress.</Empty>}
      <ul className="flex flex-col gap-2">
        {rows?.map(({ ex, sessions, bestE1rm, best }) => (
          <li key={ex.id} className="rounded-xl bg-surface px-3 py-2">
            <div className="flex items-baseline justify-between">
              <span className="font-semibold">{ex.name}</span>
              <span className="text-xs text-muted">{sessions} sessions</span>
            </div>
            <div className="text-sm num">
              Best {fmtSet(ex.trackingType, best)}
              {bestE1rm > 0 && <span className="text-muted"> · e1RM {fmtKg(Math.round(bestE1rm * 10) / 10)} kg</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
