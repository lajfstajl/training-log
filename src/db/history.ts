import type { Exposure, TrainingHistory } from '../engine/types'
import { uuid } from '../lib/format'
import { db, type Run } from './schema'

// Maps stored data to the engine's plain history shape, and stores runs.

/** Everything the engine needs: exposures from finished sessions, all runs, and session dates. */
export async function loadEngineHistory(): Promise<TrainingHistory> {
  const sessions = (await db.sessions.where('status').equals('finished').toArray()).sort((a, b) => a.startedAt - b.startedAt)
  const ids = sessions.map((s) => s.id)
  const sets = await db.sets.where('sessionId').anyOf(ids).toArray()
  const bySession = new Map(sessions.map((s) => [s.id, s]))

  const groups = new Map<string, Exposure>()
  for (const s of sets) {
    if (s.isWarmup || s.completedAt === undefined) continue
    const session = bySession.get(s.sessionId)!
    const key = `${s.sessionId}|${s.exerciseId}`
    let e = groups.get(key)
    if (!e) {
      e = { exerciseId: s.exerciseId, sessionId: s.sessionId, date: session.startedAt, sets: [] }
      groups.set(key, e)
    }
    e.sets.push(s)
  }
  for (const e of groups.values()) e.sets.sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0))

  const runs = (await db.runs.toArray()).map((r) => ({ date: r.date, distanceKm: r.distanceKm, durationSec: r.durationSec, runType: r.runType }))
  return {
    exposures: [...groups.values()],
    runs,
    sessions: sessions
      .filter((s) => sets.some((x) => x.sessionId === s.id && x.completedAt !== undefined))
      .map((s) => ({ date: s.startedAt, kind: s.kind ?? 'free' })),
  }
}

export type RunInput = Omit<Run, 'id' | 'source'> & { source?: Run['source'] }

export async function saveRun(input: RunInput, id?: string): Promise<string> {
  const runId = id ?? uuid()
  await db.runs.put({ source: 'manual', ...input, id: runId })
  return runId
}

export async function deleteRun(id: string): Promise<void> {
  await db.runs.delete(id)
}

export async function listRuns(): Promise<Run[]> {
  return db.runs.orderBy('date').reverse().toArray()
}

/** "5:32" per km. */
export function paceText(distanceKm: number, durationSec: number): string {
  if (!(distanceKm > 0) || !(durationSec > 0)) return '–'
  const s = Math.round(durationSec / distanceKm)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function durationText(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`
}
