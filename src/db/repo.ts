import { nextSetLoad } from '../engine/progression'
import type { Exercise, LoggedSet, SetRecord } from '../engine/types'
import { uuid } from '../lib/format'
import { effectiveValues, missingField, planFromHistory } from '../lib/prefill'
import { adjustRest, startRest } from '../lib/timer'
import { db, type Session, type SessionExercise } from './schema'

// All writes go through here. Every call persists immediately; the UI reads with useLiveQuery.

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}

export async function activeSession(): Promise<Session | undefined> {
  return db.sessions.where('status').equals('active').first()
}

/** Working sets of the most recent finished session that included this exercise. */
export async function lastExposure(
  exerciseId: string,
  excludeSessionId?: string,
  before = Infinity,
): Promise<{ sessionId: string; date: number; sets: SetRecord[] } | undefined> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const bySession = new Map<string, SetRecord[]>()
  for (const s of sets) {
    if (s.sessionId === excludeSessionId || s.isWarmup || s.completedAt === undefined) continue
    bySession.set(s.sessionId, [...(bySession.get(s.sessionId) ?? []), s])
  }
  if (bySession.size === 0) return undefined
  const sessions = (await db.sessions.bulkGet([...bySession.keys()])).filter(
    (s): s is Session => !!s && s.status === 'finished' && s.startedAt < before,
  )
  if (sessions.length === 0) return undefined
  const latest = sessions.reduce((a, b) => (b.startedAt > a.startedAt ? b : a))
  return {
    sessionId: latest.id,
    date: latest.startedAt,
    sets: bySession.get(latest.id)!.sort((a, b) => a.order - b.order),
  }
}

export async function startSession(exerciseIds: string[] = [], now = Date.now()): Promise<string> {
  const existing = await activeSession()
  if (existing) return existing.id
  const id = uuid()
  await db.sessions.add({ id, status: 'active', startedAt: now, notes: '', calibration: false, createdAt: now, updatedAt: now })
  for (const exId of exerciseIds) await addExerciseToSession(id, exId, now)
  return id
}

export async function addExerciseToSession(sessionId: string, exerciseId: string, now = Date.now(), atOrder?: number): Promise<string> {
  const ex = await db.exercises.get(exerciseId)
  if (!ex) throw new Error(`Unknown exercise ${exerciseId}`)
  const last = await lastExposure(exerciseId, sessionId)
  const plan = planFromHistory(ex, last?.sets, last?.date)

  return db.transaction('rw', db.sessionExercises, db.sets, async () => {
    const siblings = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order')
    const order = atOrder ?? (siblings.length ? siblings[siblings.length - 1].order + 1 : 0)
    if (atOrder !== undefined) {
      for (const s of siblings) if (s.order >= atOrder) await db.sessionExercises.update(s.id, { order: s.order + 1 })
    }
    const seId = uuid()
    await db.sessionExercises.add({ id: seId, sessionId, exerciseId, order, why: plan.why })
    await db.sets.bulkAdd(
      plan.sets.map((p, i) => ({
        id: uuid(),
        sessionId,
        sessionExerciseId: seId,
        exerciseId,
        order: i,
        isWarmup: false,
        ...p,
        note: '',
        createdAt: now,
        updatedAt: now,
      })),
    )
    return seId
  })
}

export type SetPatch = Partial<Pick<SetRecord, 'kg' | 'reps' | 'seconds' | 'rir' | 'isWarmup' | 'note'>>

export async function updateSet(id: string, patch: SetPatch, now = Date.now()): Promise<void> {
  await db.sets.update(id, { ...patch, updatedAt: now })
}

/** The confirmed working set just before this one in the same exercise, for carrying load forward. */
export async function previousConfirmed(set: SetRecord): Promise<SetRecord | undefined> {
  const siblings = await db.sets.where('sessionExerciseId').equals(set.sessionExerciseId).sortBy('order')
  return siblings.filter((s) => s.order < set.order && !s.isWarmup && s.completedAt !== undefined).pop()
}

/**
 * Confirms a set with what is stored (actual if edited, else target, else carried-forward load)
 * and starts rest. Reads from the DB, never from UI state, so a fast tap sequence cannot confirm stale values.
 * This is the only way a set starts counting. Returns false if a required value is missing.
 */
export async function confirmSet(id: string, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', [db.sets, db.sessions, db.exercises, db.sessionExercises], async () => {
    const set = await db.sets.get(id)
    const ex = set && (await db.exercises.get(set.exerciseId))
    if (!set || !ex) return false
    const values = effectiveValues(ex.trackingType, set, await previousConfirmed(set))
    if (missingField(ex.trackingType, values, set.isWarmup)) return false
    await db.sets.update(id, { ...values, completedAt: now, updatedAt: now })

    // R15: while calibrating, the next working set's suggested load follows from this set.
    // Only the engine's suggestion changes; a load the user already entered is left alone.
    const se = await db.sessionExercises.get(set.sessionExerciseId)
    if (se?.calibrating && !set.isWarmup) {
      const siblings = await db.sets.where('sessionExerciseId').equals(set.sessionExerciseId).sortBy('order')
      const next = siblings.find((s) => s.order > set.order && !s.isWarmup && s.completedAt === undefined)
      if (next && next.kg === undefined) {
        const kg = nextSetLoad(ex, values, next.targetReps ?? ex.rangeMin, next.targetRir ?? ex.targetRir)
        if (kg !== undefined && kg !== next.targetKg) {
          await db.sets.update(next.id, { targetKg: kg, ruleIds: [...new Set([...(next.ruleIds ?? []), 'R15'])], updatedAt: now })
        }
      }
    }
    const session = await db.sessions.get(set.sessionId)
    if (session?.status === 'active') {
      const sec = set.isWarmup ? 60 : ex.defaultRestSec
      await db.sessions.update(set.sessionId, { ...startRest(sec, now), updatedAt: now })
    }
    return true
  })
}

/** Un-confirming keeps the entered values but the set stops counting. */
export async function unconfirmSet(id: string, now = Date.now()): Promise<void> {
  await db.sets.update(id, { completedAt: undefined, updatedAt: now })
}

export async function addSet(sessionExerciseId: string, now = Date.now()): Promise<void> {
  const se = await db.sessionExercises.get(sessionExerciseId)
  if (!se) return
  const sets = await db.sets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('order')
  const last = sets[sets.length - 1]
  const ex = await db.exercises.get(se.exerciseId)
  await db.sets.add({
    id: uuid(),
    sessionId: se.sessionId,
    sessionExerciseId,
    exerciseId: se.exerciseId,
    order: last ? last.order + 1 : 0,
    isWarmup: false,
    targetKg: last?.targetKg ?? last?.kg,
    targetReps: last?.targetReps,
    targetSec: last?.targetSec,
    targetRir: last?.targetRir ?? ex?.targetRir,
    plannedFrom: 'manual',
    note: '',
    createdAt: now,
    updatedAt: now,
  })
}

/** Adds a warm-up set at the top of the exercise, at about half the first working target. */
export async function addWarmupSet(sessionExerciseId: string, now = Date.now()): Promise<void> {
  const se = await db.sessionExercises.get(sessionExerciseId)
  if (!se) return
  const sets = await db.sets.where('sessionExerciseId').equals(sessionExerciseId).sortBy('order')
  const first = sets.find((s) => !s.isWarmup)
  const kg = first?.targetKg !== undefined ? Math.round(first.targetKg / 2 / 2.5) * 2.5 : undefined
  await db.sets.add({
    id: uuid(),
    sessionId: se.sessionId,
    sessionExerciseId,
    exerciseId: se.exerciseId,
    order: (sets[0]?.order ?? 0) - 1,
    isWarmup: true,
    targetKg: kg,
    targetReps: first?.targetReps !== undefined ? 5 : undefined,
    targetSec: first?.targetSec,
    plannedFrom: 'manual',
    note: '',
    createdAt: now,
    updatedAt: now,
  })
}

export async function deleteSet(id: string): Promise<void> {
  await db.sets.delete(id)
}

export async function removeSessionExercise(id: string): Promise<void> {
  await db.transaction('rw', db.sessionExercises, db.sets, async () => {
    await db.sets.where('sessionExerciseId').equals(id).delete()
    await db.sessionExercises.delete(id)
  })
}

export async function moveSessionExercise(id: string, dir: -1 | 1): Promise<void> {
  await db.transaction('rw', db.sessionExercises, async () => {
    const se = await db.sessionExercises.get(id)
    if (!se) return
    const list = await db.sessionExercises.where('sessionId').equals(se.sessionId).sortBy('order')
    const i = list.findIndex((x) => x.id === id)
    const j = i + dir
    if (j < 0 || j >= list.length) return
    await db.sessionExercises.update(list[i].id, { order: list[j].order })
    await db.sessionExercises.update(list[j].id, { order: list[i].order })
  })
}

/**
 * Swaps an exercise. With no confirmed sets it is replaced in place.
 * If some sets are already confirmed, those stay and the new exercise is inserted after it.
 */
export async function swapSessionExercise(id: string, newExerciseId: string, now = Date.now()): Promise<void> {
  const se = await db.sessionExercises.get(id)
  if (!se) return
  const sets = await db.sets.where('sessionExerciseId').equals(id).toArray()
  const anyDone = sets.some((s) => s.completedAt !== undefined)
  if (anyDone) {
    await db.sets.bulkDelete(sets.filter((s) => s.completedAt === undefined).map((s) => s.id))
    const newId = await addExerciseToSession(se.sessionId, newExerciseId, now, se.order + 1)
    await db.sessionExercises.update(newId, { swappedFrom: se.exerciseId })
  } else {
    await removeSessionExercise(id)
    const newId = await addExerciseToSession(se.sessionId, newExerciseId, now, se.order)
    await db.sessionExercises.update(newId, { swappedFrom: se.exerciseId })
  }
}

export async function adjustSessionRest(sessionId: string, deltaSec: number, now = Date.now()): Promise<void> {
  const s = await db.sessions.get(sessionId)
  if (!s) return
  await db.sessions.update(sessionId, { ...adjustRest(s, deltaSec, now), updatedAt: now })
}

export async function skipRest(sessionId: string, now = Date.now()): Promise<void> {
  await db.sessions.update(sessionId, { restEndsAt: undefined, restTotalSec: undefined, updatedAt: now })
}

export async function finishSession(sessionId: string, now = Date.now()): Promise<void> {
  await db.sessions.update(sessionId, {
    status: 'finished',
    finishedAt: now,
    restEndsAt: undefined,
    restTotalSec: undefined,
    updatedAt: now,
  })
}

export async function updateSession(sessionId: string, patch: Partial<Pick<Session, 'feel' | 'notes'>>, now = Date.now()): Promise<void> {
  await db.sessions.update(sessionId, { ...patch, updatedAt: now })
}

/** Deletes active sessions that have no exercises (e.g. started and abandoned). Returns how many. */
export async function discardEmptySessions(): Promise<number> {
  const active = await db.sessions.where('status').equals('active').toArray()
  let n = 0
  for (const s of active) {
    if ((await db.sessionExercises.where('sessionId').equals(s.id).count()) === 0) {
      await deleteSession(s.id)
      n++
    }
  }
  return n
}

/** Discards an active session and everything logged in it. */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.transaction('rw', db.sessions, db.sessionExercises, db.sets, async () => {
    await db.sets.where('sessionId').equals(sessionId).delete()
    await db.sessionExercises.where('sessionId').equals(sessionId).delete()
    await db.sessions.delete(sessionId)
  })
}

/** Starts a new session with the same exercises in the same order, pre-filled from history. */
export async function repeatSession(sessionId: string, now = Date.now()): Promise<string> {
  const list = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order')
  return startSession(
    list.map((x) => x.exerciseId),
    now,
  )
}

export interface SessionView {
  session: Session
  items: { se: SessionExercise; exercise: Exercise; sets: SetRecord[]; last?: SetRecord[] }[]
}

/** null when the session does not exist (undefined is reserved for "still loading" in useLiveQuery). */
export async function loadSessionView(sessionId: string): Promise<SessionView | null> {
  const session = await db.sessions.get(sessionId)
  if (!session) return null
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order')
  const allSets = await db.sets.where('sessionId').equals(sessionId).toArray()
  const exercises = await db.exercises.bulkGet(ses.map((s) => s.exerciseId))
  const items = []
  for (let i = 0; i < ses.length; i++) {
    const exercise = exercises[i]
    if (!exercise) continue
    const last = await lastExposure(exercise.id, sessionId, session.startedAt)
    items.push({
      se: ses[i],
      exercise,
      sets: allSets.filter((s) => s.sessionExerciseId === ses[i].id).sort((a, b) => a.order - b.order),
      last: last?.sets,
    })
  }
  return { session, items }
}

export type SessionKind = 'weights' | 'calisthenics' | 'mixed' | 'empty'

export interface SessionSummary {
  session: Session
  kind: SessionKind
  names: string[]
  setsDone: number
}

/** Finished sessions, newest first, with a short summary for lists. */
export async function sessionSummaries(limit = Infinity): Promise<SessionSummary[]> {
  const sessions = (await db.sessions.orderBy('startedAt').reverse().toArray()).filter((s) => s.status === 'finished').slice(0, limit)
  const ids = sessions.map((s) => s.id)
  const ses = await db.sessionExercises.where('sessionId').anyOf(ids).toArray()
  const sets = await db.sets.where('sessionId').anyOf(ids).toArray()
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  return sessions.map((session) => {
    const mine = ses.filter((x) => x.sessionId === session.id).sort((a, b) => a.order - b.order)
    const types = new Set(mine.map((x) => exercises.get(x.exerciseId)?.trackingType))
    const hasW = types.has('weight_reps')
    const hasC = types.has('bodyweight_reps') || types.has('timed_hold')
    return {
      session,
      kind: hasW && hasC ? 'mixed' : hasW ? 'weights' : hasC ? 'calisthenics' : 'empty',
      names: mine.map((x) => exercises.get(x.exerciseId)?.name ?? '?'),
      setsDone: sets.filter((s) => s.sessionId === session.id && !s.isWarmup && s.completedAt !== undefined).length,
    }
  })
}

/** Confirmed sets of an exercise from finished sessions other than `excludeSessionId`. */
export async function priorSets(exerciseId: string, excludeSessionId: string, before: number): Promise<LoggedSet[]> {
  const sets = await db.sets.where('exerciseId').equals(exerciseId).toArray()
  const ids = [...new Set(sets.map((s) => s.sessionId))].filter((id) => id !== excludeSessionId)
  const ok = new Set(
    (await db.sessions.bulkGet(ids)).filter((s) => s?.status === 'finished' && s.startedAt < before).map((s) => s!.id),
  )
  return sets.filter((s) => ok.has(s.sessionId))
}
