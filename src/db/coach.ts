import type { Candidate } from '../engine/candidates'
import { ENGINE_VERSION } from '../engine/config'
import { uuid } from '../lib/format'
import { activeSession } from './repo'
import { db, type Checkin, type Suggestion } from './schema'

// Storage for the coach flow: check-in → candidate list → suggestion(s) → session.
// Everything is kept (with engine version and rule ids) so any past suggestion can be explained.

export async function saveCheckin(c: Omit<Checkin, 'id' | 'createdAt'>, now = Date.now()): Promise<string> {
  const id = uuid()
  await db.checkins.add({ ...c, id, createdAt: now })
  return id
}

export async function saveCandidates(checkinId: string, cands: Candidate[], now = Date.now()): Promise<string> {
  const id = uuid()
  await db.candidates.add({
    id,
    checkinId,
    engineVersion: ENGINE_VERSION,
    createdAt: now,
    items: cands.map((c) => ({ id: c.id, role: c.role, baseScore: c.baseScore, target: c.target, marks: c.marks, estMinutes: c.estMinutes })),
  })
  return id
}

export async function saveSuggestion(s: Omit<Suggestion, 'id' | 'createdAt'>, now = Date.now()): Promise<string> {
  const id = uuid()
  await db.suggestions.add({ ...s, id, createdAt: now })
  return id
}

export interface LoadedPlan {
  checkin: Checkin
  candidates: Candidate[]
  candidatesId?: string
  suggestion: Suggestion
  /** The suggestion's chosen candidates, in order. */
  chosen: Candidate[]
}

/** The latest suggestion for a check-in, with candidates re-joined to their exercises. */
export async function loadPlan(checkinId: string): Promise<LoadedPlan | null> {
  const checkin = await db.checkins.get(checkinId)
  if (!checkin) return null
  const suggestions = await db.suggestions.where('checkinId').equals(checkinId).toArray()
  const suggestion = suggestions.sort((a, b) => b.createdAt - a.createdAt)[0]
  if (!suggestion) return null
  const list = suggestion.candidatesId ? await db.candidates.get(suggestion.candidatesId) : undefined
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  const candidates: Candidate[] = (list?.items ?? [])
    .filter((c) => exercises.has(c.target.exerciseId))
    .map((c) => ({ ...c, exercise: exercises.get(c.target.exerciseId)! }))
  const byId = new Map(candidates.map((c) => [c.id, c]))
  return {
    checkin,
    candidates,
    candidatesId: list?.id,
    suggestion,
    chosen: suggestion.ids.map((id) => byId.get(id)).filter((c): c is Candidate => !!c),
  }
}

/**
 * Starts a session from a coach plan. Targets are copied from the engine candidates unchanged;
 * each set records the rules that produced it.
 */
export async function startSessionFromPlan(
  items: Candidate[],
  opts: { kind: 'strength' | 'calisthenics'; suggestionId: string },
  now = Date.now(),
): Promise<string> {
  const running = await activeSession()
  if (running) return running.id
  const sessionId = uuid()
  await db.transaction('rw', db.sessions, db.sessionExercises, db.sets, async () => {
    await db.sessions.add({
      id: sessionId,
      status: 'active',
      startedAt: now,
      notes: '',
      calibration: items.some((c) => c.target.calibrating),
      kind: opts.kind,
      suggestionId: opts.suggestionId,
      createdAt: now,
      updatedAt: now,
    })
    for (const [order, c] of items.entries()) {
      const seId = uuid()
      const marks = c.marks.length ? `${c.marks.join(' · ')}. ` : ''
      await db.sessionExercises.add({
        id: seId,
        sessionId,
        exerciseId: c.exercise.id,
        order,
        why: c.target.why.startsWith(marks) ? c.target.why : `${marks}${c.target.why}`,
        ruleIds: c.target.ruleIds,
        calibrating: c.target.calibrating,
      })
      await db.sets.bulkAdd(
        c.target.sets.map((s, i) => ({
          id: uuid(),
          sessionId,
          sessionExerciseId: seId,
          exerciseId: c.exercise.id,
          order: i,
          isWarmup: false,
          ...s,
          plannedFrom: 'engine' as const,
          ruleIds: c.target.ruleIds,
          note: '',
          createdAt: now,
          updatedAt: now,
        })),
      )
    }
  })
  return sessionId
}
