import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { listRuns } from '../../db/history'
import { getProfile } from '../../db/profile'
import { activeSession, discardEmptySessions, sessionSummaries } from '../../db/repo'
import { db } from '../../db/schema'
import { config } from '../../engine/config'
import { MUSCLES } from '../../engine/types'
import { fractionalVolume } from '../../engine/volume'
import { MUSCLE_LABEL } from '../../lib/format'
import { navigate } from '../../router'
import { Button } from '../../ui'
import { RunRow, SessionRow } from '../history/SessionRow'

async function weeklyVolume(now: number) {
  const from = now - config.r4.windowDays * 86400000
  const sets = await db.sets.where('completedAt').between(from, now, true, true).toArray()
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  return fractionalVolume(sets, exercises, now)
}

export function TodayTab() {
  const active = useLiveQuery(async () => {
    const s = await activeSession()
    if (!s) return null
    const done = await db.sets.where('sessionId').equals(s.id).filter((x) => x.completedAt !== undefined && !x.isWarmup).count()
    return { session: s, done }
  }, [])
  const recent = useLiveQuery(() => sessionSummaries(3), []) ?? []
  const runs = useLiveQuery(() => listRuns(), []) ?? []
  const volume = useLiveQuery(() => weeklyVolume(Date.now()), [])
  const hasProfile = useLiveQuery(async () => !!(await getProfile()), [])

  // Clean up sessions that were started but never got an exercise.
  useEffect(() => {
    discardEmptySessions()
  }, [])

  const start = () => navigate(hasProfile ? '/checkin' : '/welcome')
  const hasVolume = volume && Object.values(volume).some((v) => v > 0)
  const now = Date.now()
  const kmWeek = runs.filter((r) => now - r.date < 7 * 86_400_000).reduce((s, r) => s + r.distanceKm, 0)
  const longest30 = Math.max(0, ...runs.filter((r) => now - r.date < 30 * 86_400_000).map((r) => r.distanceKm))
  // Recent activity: sessions and runs together, newest first.
  const activity = [
    ...recent.map((s) => ({ date: s.session.startedAt, node: <SessionRow key={s.session.id} s={s} /> })),
    ...runs.slice(0, 3).map((r) => ({ date: r.date, node: <RunRow key={r.id} run={r} /> })),
  ]
    .sort((a, b) => b.date - a.date)
    .slice(0, 3)

  return (
    <div className="pt-safe px-4">
      <h1 className="pt-6 pb-4 text-2xl font-bold">Today</h1>

      {hasProfile === false && !active && (
        <div className="mb-4 rounded-2xl bg-surface p-4">
          <p className="font-semibold">Meet your coach</p>
          <p className="mt-1 text-sm text-muted">A few quick questions (about a minute) so I can suggest the right session each time.</p>
          <Button variant="primary" className="mt-3 w-full" onClick={() => navigate('/welcome')}>
            Let’s go
          </Button>
        </div>
      )}

      {active ? (
        <div className="rounded-2xl border border-target/40 bg-surface p-4">
          <p className="text-sm text-muted">
            Session in progress since{' '}
            {new Date(active.session.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {active.done} sets done
          </p>
          <Button variant="primary" big className="mt-3 w-full" onClick={() => navigate(`/session/${active.session.id}`)}>
            Resume session
          </Button>
        </div>
      ) : (
        <Button variant="primary" big className="w-full" onClick={start}>
          Start training
        </Button>
      )}
      <Button className="mt-2 w-full" onClick={() => navigate('/run/new')}>
        Log a run
      </Button>
      {runs.length > 0 && (
        <p className="mt-3 text-sm text-muted num">
          Running: {Math.round(kmWeek * 10) / 10} km in the last 7 days · longest in 30 days {longest30} km
        </p>
      )}

      <section className="mt-8">
        <h2 className="mb-1 text-sm font-semibold text-muted">Sets per muscle, last 7 days</h2>
        {hasVolume ? (
          <>
            <p className="mb-3 text-sm text-muted">
              Aim for {config.r4.targetMin}–{config.r4.targetMax} (the shaded band). A set counts 1 for the muscle it mainly works and ½ for
              muscles that help.
            </p>
            <VolumeBars volume={volume} />
          </>
        ) : (
          <p className="text-muted">Appears after your first session.</p>
        )}
      </section>

      <section className="mt-8 mb-4">
        <h2 className="mb-2 text-sm font-semibold text-muted">Recent</h2>
        {activity.length === 0 ? <p className="text-muted">Nothing logged yet.</p> : <div className="flex flex-col gap-2">{activity.map((a) => a.node)}</div>}
      </section>
    </div>
  )
}

function VolumeBars({ volume }: { volume: Record<string, number> }) {
  const { targetMin, targetMax } = config.r4
  const scale = targetMax * 1.25
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`
  return (
    <ul className="flex flex-col gap-1.5">
      {MUSCLES.map((m) => {
        const v = volume[m] ?? 0
        const tone = v < targetMin ? 'bg-muted/60' : v > targetMax ? 'bg-target' : 'bg-good'
        return (
          <li key={m} className="flex items-center gap-2 text-sm">
            <span className="w-24 shrink-0 text-muted">{MUSCLE_LABEL[m]}</span>
            <div className="relative h-3 flex-1 overflow-hidden rounded bg-surface-2">
              <div className="absolute inset-y-0 bg-line/70" style={{ left: pct(targetMin), width: `calc(${pct(targetMax)} - ${pct(targetMin)})` }} />
              <div className={`absolute inset-y-0 left-0 rounded ${tone}`} style={{ width: pct(v) }} />
            </div>
            <span className="w-9 text-right num">{v % 1 ? v.toFixed(1) : v}</span>
          </li>
        )
      })}
    </ul>
  )
}
