import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect } from 'react'
import { loadEngineHistory } from '../../db/history'
import { loadSessionView, priorSets, updateSession } from '../../db/repo'
import { db, type Session } from '../../db/schema'
import { nextTimeChanges } from '../../engine/events'
import { fmtDuration, fmtKg, loadLabel } from '../../lib/format'
import { findPrs, sessionVolumeKg, type Pr } from '../../lib/records'
import { navigate } from '../../router'
import { Button, Chip, Header } from '../../ui'

const FEELS: { value: NonNullable<Session['feel']>; label: string }[] = [
  { value: 'too_easy', label: 'Too easy' },
  { value: 'about_right', label: 'About right' },
  { value: 'too_hard', label: 'Too hard' },
]

async function loadSummary(sessionId: string) {
  const view = await loadSessionView(sessionId)
  if (!view) return null
  const prs: (Pr & { name: string; type: string })[] = []
  for (const it of view.items) {
    const before = await priorSets(it.exercise.id, sessionId, view.session.startedAt)
    for (const pr of findPrs(it.exercise.id, it.exercise.trackingType, it.sets, before)) {
      prs.push({ ...pr, name: it.exercise.name, type: it.exercise.trackingType })
    }
  }
  const flat = view.items.flatMap((it) => it.sets.map((s) => ({ ...s, trackingType: it.exercise.trackingType })))
  const next =
    view.session.status === 'finished'
      ? nextTimeChanges({
          exerciseIds: view.items.map((it) => it.exercise.id),
          exercises: await db.exercises.toArray(),
          progressions: await db.progressions.toArray(),
          history: await loadEngineHistory(),
          now: view.session.finishedAt ?? Date.now(),
        })
      : []
  return {
    view,
    next,
    prs,
    volume: sessionVolumeKg(flat),
    setsDone: flat.filter((s) => !s.isWarmup && s.completedAt !== undefined).length,
  }
}

export function FinishSummary({ sessionId }: { sessionId: string }) {
  const data = useLiveQuery(() => loadSummary(sessionId), [sessionId])

  // Record the engine's decisions in the events log, once per session.
  const next = data?.next
  useEffect(() => {
    if (!next?.length) return
    // Deterministic ids make this idempotent (effects can run twice).
    db.events.bulkPut(
      next.map((n) => ({
        id: `${sessionId}:${n.exerciseId}`,
        date: data?.view.session.finishedAt ?? Date.now(),
        exerciseId: n.exerciseId,
        type: n.event,
        ruleId: n.ruleIds[0] ?? '',
        sessionId,
        change: n.change,
      })),
    )
  }, [next, sessionId])

  if (data === undefined) return null
  if (data === null) return <p className="p-4 text-muted">Session not found.</p>
  const { view, prs, volume, setsDone } = data
  const { session } = view

  return (
    <div className="flex min-h-full flex-col">
      <Header title="Session done" />
      <div className="flex-1 px-4 py-4">
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Duration" value={fmtDuration((session.finishedAt ?? Date.now()) - session.startedAt)} />
          <Stat label="Volume" value={`${Math.round(volume).toLocaleString('en-GB')} kg`} />
          <Stat label="Sets" value={String(setsDone)} />
        </dl>

        <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Records</h2>
        {prs.length === 0 ? (
          <p className="text-muted">No new records this time.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {prs.map((p) => (
              <li key={p.exerciseId + p.kind} className="rounded-xl bg-surface px-3 py-2">
                <span className="font-semibold">{p.name}</span>{' '}
                <span className="text-good num">
                  {p.kind === 'e1rm'
                    ? `e1RM ${fmtKg(Math.round(p.value * 10) / 10)} kg`
                    : `${p.value} ${p.kind === 'seconds' ? 's' : 'reps'} at ${loadLabel('bodyweight_reps', p.kg)}`}
                </span>
              </li>
            ))}
          </ul>
        )}

        {data.next.length > 0 && (
          <>
            <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">Next time</h2>
            <ul className="flex flex-col gap-1">
              {data.next.map((n) => (
                <li key={n.exerciseId} className="rounded-xl bg-surface px-3 py-2">
                  <span className="font-semibold">{n.name}</span>{' '}
                  <span className={n.event === 'reset' || n.event === 'ladder_down' ? 'text-warn' : 'text-target'}>{n.change}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <h2 className="mt-6 mb-2 text-sm font-semibold text-muted">How did that feel?</h2>
        <div className="flex gap-2">
          {FEELS.map((f) => (
            <Chip key={f.value} selected={session.feel === f.value} onClick={() => updateSession(sessionId, { feel: f.value })} className="flex-1 whitespace-nowrap px-1">
              {f.label}
            </Chip>
          ))}
        </div>
        <textarea
          placeholder="Optional note"
          defaultValue={session.notes}
          onChange={(e) => updateSession(sessionId, { notes: e.target.value })}
          rows={3}
          className="mt-3 w-full rounded-xl border border-line bg-surface-2 p-3 outline-none"
        />
      </div>
      <div className="pb-safe sticky bottom-0 border-t border-line bg-bg px-4 pt-3">
        <Button variant="primary" big className="w-full" onClick={() => navigate('/', true)}>
          Done
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-bold num">{value}</dd>
    </div>
  )
}
