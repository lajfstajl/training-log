import { beforeEach, describe, expect, it } from 'vitest'
import { exportBackup, parseBackup, restoreBackup } from '../src/db/backup'
import {
  activeSession,
  addExerciseToSession,
  confirmSet,
  discardEmptySessions,
  finishSession,
  lastExposure,
  loadSessionView,
  repeatSession,
  startSession,
  swapSessionExercise,
  updateSet,
} from '../src/db/repo'
import { db, SCHEMA_VERSION, TABLE_NAMES } from '../src/db/schema'
import { SEED_EXERCISES, SEED_PROGRESSIONS, seedIfNeeded } from '../src/db/seed'

beforeEach(async () => {
  await Promise.all(TABLE_NAMES.map((t) => db[t].clear()))
  await seedIfNeeded(db, 0)
})

describe('schema and seed', () => {
  it('opens at the current schema version', async () => {
    await db.open()
    expect(db.verno).toBe(SCHEMA_VERSION)
  })

  it('seeds about 50 exercises and 6 ladders, idempotently', async () => {
    expect(await db.exercises.count()).toBe(SEED_EXERCISES.length)
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(40)
    expect(await db.progressions.count()).toBe(6)
    await db.exercises.update('back-squat', { increment: 5 })
    expect(await seedIfNeeded(db, 0)).toBe(0)
    expect((await db.exercises.get('back-squat'))!.increment).toBe(5) // user edit kept
  })

  it('every ladder step and seed reference is consistent', () => {
    const ids = new Set(SEED_EXERCISES.map((e) => e.id))
    for (const p of SEED_PROGRESSIONS) for (const s of p.steps) expect(ids.has(s.exerciseId)).toBe(true)
    for (const e of SEED_EXERCISES) {
      expect(e.rangeMin).toBeLessThanOrEqual(e.rangeMax)
      if (e.progressionId) {
        const p = SEED_PROGRESSIONS.find((x) => x.id === e.progressionId)!
        expect(p.steps[e.progressionStep!].exerciseId).toBe(e.id)
      }
    }
  })
})

describe('session flow', () => {
  it('logs, finishes, and pre-fills the next session from history', async () => {
    const t0 = 1_000_000
    const sid = await startSession(['back-squat'], t0)
    expect(await startSession([], t0)).toBe(sid) // only one active session

    const view = (await loadSessionView(sid))!
    const sets = view.items[0].sets
    expect(sets).toHaveLength(3)
    expect(sets[0].plannedFrom).toBe('default')

    // Pre-filled target is not a confirmed set.
    expect(sets.every((s) => s.completedAt === undefined)).toBe(true)

    // No load yet on a first exposure: confirm is refused rather than logging a guess.
    expect(await confirmSet(sets[0].id, t0 + 1)).toBe(false)

    await updateSet(sets[0].id, { kg: 100, reps: 5, rir: 2 }, t0 + 1)
    expect(await confirmSet(sets[0].id, t0 + 2)).toBe(true)
    // Set 2: load carries forward from set 1, reps come from the target, RIR as tapped.
    await updateSet(sets[1].id, { reps: 5, rir: 1 }, t0 + 2)
    await confirmSet(sets[1].id, t0 + 3)
    const s2 = await db.sets.get(sets[1].id)
    expect([s2!.kg, s2!.reps, s2!.rir, s2!.targetKg]).toEqual([100, 5, 1, undefined])
    const session = await db.sessions.get(sid)
    expect(session!.restEndsAt).toBe(t0 + 3 + 180_000) // main lift rest

    // "Kill the app": nothing in memory; the active session is found from the DB.
    expect((await activeSession())!.id).toBe(sid)

    await finishSession(sid, t0 + 10)
    expect(await activeSession()).toBeUndefined()

    const last = await lastExposure('back-squat')
    expect(last!.sets.map((s) => s.kg)).toEqual([100, 100])

    const sid2 = await repeatSession(sid, t0 + 100)
    const view2 = (await loadSessionView(sid2))!
    expect(view2.items[0].sets.map((s) => [s.targetKg, s.targetReps, s.plannedFrom])).toEqual([
      [100, 5, 'history'],
      [100, 5, 'history'],
    ])
    expect(view2.items[0].last!.map((s) => s.reps)).toEqual([5, 5])
    // Target is kept separate from actual.
    expect(view2.items[0].sets[0].kg).toBeUndefined()
  })

  it('swap replaces in place when nothing is confirmed, and keeps confirmed sets otherwise', async () => {
    const sid = await startSession(['bench-press', 'barbell-row'])
    let v = (await loadSessionView(sid))!
    await swapSessionExercise(v.items[0].se.id, 'incline-db-press')
    v = (await loadSessionView(sid))!
    expect(v.items.map((i) => i.exercise.id)).toEqual(['incline-db-press', 'barbell-row'])

    await updateSet(v.items[1].sets[0].id, { kg: 60 })
    await confirmSet(v.items[1].sets[0].id)
    await swapSessionExercise(v.items[1].se.id, 'seated-cable-row')
    v = (await loadSessionView(sid))!
    expect(v.items.map((i) => i.exercise.id)).toEqual(['incline-db-press', 'barbell-row', 'seated-cable-row'])
    expect(v.items[1].sets).toHaveLength(1)
    expect(v.items[2].se.swappedFrom).toBe('barbell-row')
  })

  it('discards active sessions that never got an exercise, and keeps the rest', async () => {
    const empty = await startSession([], 1)
    expect(await discardEmptySessions()).toBe(1)
    expect(await db.sessions.get(empty)).toBeUndefined()
    const real = await startSession(['plank'], 2)
    expect(await discardEmptySessions()).toBe(0)
    expect(await db.sessions.get(real)).toBeDefined()
  })

  it('adds an exercise with default plan when there is no history', async () => {
    const sid = await startSession()
    await addExerciseToSession(sid, 'plank')
    const v = (await loadSessionView(sid))!
    expect(v.items[0].sets[0].targetSec).toBe(30)
  })
})

describe('backup', () => {
  it('round-trips exactly and never exports the API key', async () => {
    const sid = await startSession(['deadlift'], 5)
    const v = (await loadSessionView(sid))!
    await updateSet(v.items[0].sets[0].id, { kg: 140, reps: 5 }, 6)
    await confirmSet(v.items[0].sets[0].id, 6)
    await finishSession(sid, 7)
    await db.settings.put({ key: 'apiKey', value: 'secret' })

    const backup = await exportBackup(10)
    expect(backup.tables.settings.find((s) => s.key === 'apiKey')).toBeUndefined()
    const text = JSON.stringify(backup)

    await Promise.all(TABLE_NAMES.map((t) => db[t].clear()))
    await db.settings.put({ key: 'apiKey', value: 'local' })

    const parsed = parseBackup(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.counts.sets).toBe(3)
    await restoreBackup(parsed.backup)

    const again = await exportBackup(10)
    expect(again).toEqual(backup)
    expect((await db.settings.get('apiKey'))!.value).toBe('local')
  })

  it('rejects files that are not backups', () => {
    expect(parseBackup('nope').ok).toBe(false)
    expect(parseBackup('{"app":"other"}').ok).toBe(false)
    expect(parseBackup(JSON.stringify({ app: 'training-log', schemaVersion: 99, exportedAt: 0, tables: {} })).ok).toBe(false)
  })
})
