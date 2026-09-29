import { beforeEach, describe, expect, it } from 'vitest'
import { loadPlan, saveCandidates, saveCheckin, saveSuggestion, startSessionFromPlan } from '../src/db/coach'
import { loadEngineHistory, paceText, saveRun } from '../src/db/history'
import { DEFAULT_PROFILE, getProfile, saveProfile } from '../src/db/profile'
import { confirmSet, finishSession, loadSessionView, startSession, updateSet } from '../src/db/repo'
import { db, TABLE_NAMES } from '../src/db/schema'
import { seedIfNeeded } from '../src/db/seed'
import { nextTimeChanges } from '../src/engine/events'
import { planToday } from '../src/engine/plan'

beforeEach(async () => {
  await Promise.all(TABLE_NAMES.map((t) => db[t].clear()))
  await seedIfNeeded(db, 0)
})

async function coachPlan(now: number) {
  const plan = planToday({
    now,
    history: await loadEngineHistory(),
    profile: { ...DEFAULT_PROFILE, running: { runs: false, longestKm: 0, perWeek: 0 } },
    exercises: await db.exercises.toArray(),
    progressions: await db.progressions.toArray(),
    equipment: (await db.locations.get('loc-gym'))!.equipment as never,
    minutes: 60,
    energy: 3,
    pain: [],
  })
  const checkinId = await saveCheckin({ trainingType: 'recommended', minutes: 60, energy: 3, pain: [] }, now)
  const candidatesId = await saveCandidates(checkinId, plan.candidates, now)
  const suggestionId = await saveSuggestion(
    { checkinId, candidatesId, model: 'engine', rawJson: '', valid: true, usedFallback: false, ids: plan.session.map((c) => c.id), rationale: 'r', minutes: 60 },
    now,
  )
  return { plan, checkinId, suggestionId }
}

describe('coach storage', () => {
  it('profile round-trips and is validated', async () => {
    expect(await getProfile()).toBeUndefined()
    await saveProfile({ ...DEFAULT_PROFILE, baselines: { 'back-squat': { kg: 100, reps: 5 } }, completedAt: 1 })
    expect((await getProfile())!.baselines['back-squat']).toEqual({ kg: 100, reps: 5 })
    await db.settings.put({ key: 'coachProfile', value: { goal: 'nonsense' } })
    expect(await getProfile()).toBeUndefined()
  })

  it('a stored plan loads back with the same engine targets, and starts a session with rule ids', async () => {
    const now = 1_000_000_000
    const { plan, checkinId, suggestionId } = await coachPlan(now)
    const loaded = (await loadPlan(checkinId))!
    expect(loaded.chosen.map((c) => c.id)).toEqual(plan.session.map((c) => c.id))
    expect(loaded.chosen[0].target).toEqual(plan.session[0].target)

    const sid = await startSessionFromPlan(loaded.chosen, { kind: 'strength', suggestionId }, now)
    const view = (await loadSessionView(sid))!
    expect(view.session.kind).toBe('strength')
    expect(view.items).toHaveLength(plan.session.length)
    const first = view.items[0]
    expect(first.se.calibrating).toBe(true)
    expect(first.sets.every((s) => s.plannedFrom === 'engine' && s.ruleIds?.includes('R15'))).toBe(true)
  })

  it('R15 in session: confirming a calibration set re-suggests the next set’s load', async () => {
    const now = 1_000_000_000
    const { checkinId, suggestionId } = await coachPlan(now)
    const loaded = (await loadPlan(checkinId))!
    const sid = await startSessionFromPlan(loaded.chosen, { kind: 'strength', suggestionId }, now)
    const item = (await loadSessionView(sid))!.items.find((i) => i.exercise.trackingType === 'weight_reps')!
    const [s1, s2] = item.sets
    await updateSet(s1.id, { kg: 80, reps: 3, rir: 4 })
    await confirmSet(s1.id, now + 1)
    const next = (await db.sets.get(s2.id))!
    expect(next.targetKg).toBeGreaterThan(80) // 80 × 3 with 4+ left → heavier next set
    expect(next.ruleIds).toContain('R15')
    expect(next.kg).toBeUndefined() // the user's own input is never overwritten
  })

  it('history for the engine: finished sessions only, with runs; next-time changes after a top-of-range session', async () => {
    const day = 86_400_000
    const t0 = 1_000_000_000
    await saveRun({ date: t0, distanceKm: 8, durationSec: 2700, runType: 'easy', notes: '' })
    for (const [i, reps] of [5, 6].entries()) {
      const at = t0 + i * 3 * day
      const sid = await startSession(['bench-press'], at)
      for (const s of (await loadSessionView(sid))!.items[0].sets) {
        await updateSet(s.id, { kg: 80, reps, rir: 2 })
        await confirmSet(s.id, at + 1)
      }
      await finishSession(sid, at + 2)
    }
    // An unfinished session is not history.
    await startSession(['deadlift'], t0 + 5 * day)

    const h = await loadEngineHistory()
    expect(h.runs).toHaveLength(1)
    expect(h.sessions).toHaveLength(2)
    expect(h.exposures.map((e) => e.exerciseId)).toEqual(['bench-press', 'bench-press'])
    const changes = nextTimeChanges({
      exerciseIds: ['bench-press'],
      exercises: await db.exercises.toArray(),
      progressions: await db.progressions.toArray(),
      history: h,
      now: t0 + 4 * day,
    })
    expect(changes).toEqual([expect.objectContaining({ event: 'progressed', change: '+2.5 kg' })])
  })

  it('pace', () => {
    expect(paceText(10, 3000)).toBe('5:00')
    expect(paceText(0, 100)).toBe('–')
  })
})
