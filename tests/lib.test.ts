import { describe, expect, it } from 'vitest'
import { SEED_EXERCISES } from '../src/db/seed'
import type { LoggedSet } from '../src/engine/types'
import { fmtSet, isoWeek } from '../src/lib/format'
import { planFromHistory } from '../src/lib/prefill'
import { findPrs, sessionVolumeKg } from '../src/lib/records'
import { adjustRest, formatClock, remainingSec, startRest } from '../src/lib/timer'

const squat = SEED_EXERCISES.find((e) => e.id === 'back-squat')!
const plank = SEED_EXERCISES.find((e) => e.id === 'plank')!

describe('prefill', () => {
  it('repeats last working sets as targets with the exercise target RIR', () => {
    const last: LoggedSet[] = [
      { exerciseId: 'back-squat', isWarmup: true, kg: 60, reps: 5, completedAt: 1 },
      { exerciseId: 'back-squat', isWarmup: false, kg: 100, reps: 5, rir: 1, completedAt: 2 },
      { exerciseId: 'back-squat', isWarmup: false, kg: 100, reps: 4, rir: 1, completedAt: 3 },
      { exerciseId: 'back-squat', isWarmup: false, kg: 100, reps: 4, rir: 0 }, // never confirmed
    ]
    const plan = planFromHistory(squat, last)
    expect(plan.sets).toEqual([
      { targetKg: 100, targetReps: 5, targetSec: undefined, targetRir: 2, plannedFrom: 'history' },
      { targetKg: 100, targetReps: 4, targetSec: undefined, targetRir: 2, plannedFrom: 'history' },
    ])
    expect(plan.why).toMatch(/Same as last time/)
  })

  it('without history, plans the default number of sets at the bottom of the range', () => {
    const plan = planFromHistory(squat, undefined)
    expect(plan.sets).toHaveLength(3)
    expect(plan.sets[0]).toMatchObject({ targetReps: 3, targetRir: 2, plannedFrom: 'default' })
    expect(plan.sets[0].targetKg).toBeUndefined()
    expect(plan.why).toBe('First time: pick a weight you could lift about 5 times, and do 3.')
  })

  it('plans seconds for holds', () => {
    const plan = planFromHistory(plank, undefined)
    expect(plan.sets[0]).toMatchObject({ targetSec: 30, targetReps: undefined })
  })
})

describe('rest timer', () => {
  it('computes remaining seconds from timestamps', () => {
    const s = startRest(90, 1_000_000)
    expect(remainingSec(s, 1_000_000)).toBe(90)
    expect(remainingSec(s, 1_000_000 + 30_500)).toBe(60)
    expect(remainingSec(s, 1_000_000 + 200_000)).toBe(0)
    expect(remainingSec({}, 0)).toBeUndefined()
  })
  it('adjusts by ±15 s but never ends in the past', () => {
    const s = startRest(90, 0)
    expect(remainingSec(adjustRest(s, 15, 0), 0)).toBe(105)
    expect(remainingSec(adjustRest(s, -15, 0), 0)).toBe(75)
    expect(remainingSec(adjustRest(s, -15, 85_000), 85_000)).toBe(0)
  })
  it('formats as m:ss', () => {
    expect(formatClock(185)).toBe('3:05')
  })
})

describe('records', () => {
  const s = (kg: number, reps: number, over: Partial<LoggedSet> = {}): LoggedSet => ({
    exerciseId: 'x',
    isWarmup: false,
    kg,
    reps,
    completedAt: 1,
    ...over,
  })

  it('flags an e1RM PR for weight_reps', () => {
    expect(findPrs('x', 'weight_reps', [s(100, 6)], [s(100, 5)])).toHaveLength(1)
    expect(findPrs('x', 'weight_reps', [s(100, 5)], [s(100, 5)])).toHaveLength(0)
  })
  it('does not count sets above 10 reps toward e1RM', () => {
    expect(findPrs('x', 'weight_reps', [s(60, 15)], [s(100, 5)])).toHaveLength(0)
  })
  it('first exposure is not a PR', () => {
    expect(findPrs('x', 'weight_reps', [s(100, 5)], [])).toHaveLength(0)
  })
  it('bodyweight rep PR is compared at the same or heavier added load', () => {
    expect(findPrs('x', 'bodyweight_reps', [s(0, 10)], [s(0, 9), s(10, 6)])).toHaveLength(1)
    expect(findPrs('x', 'bodyweight_reps', [s(0, 10)], [s(0, 9), s(10, 12)])).toHaveLength(0)
    expect(findPrs('x', 'bodyweight_reps', [s(10, 12)], [s(0, 20), s(10, 12)])).toHaveLength(0)
  })
  it('volume counts only confirmed working weight_reps sets', () => {
    expect(
      sessionVolumeKg([
        { ...s(100, 5), trackingType: 'weight_reps' },
        { ...s(50, 5, { isWarmup: true }), trackingType: 'weight_reps' },
        { ...s(100, 5, { completedAt: undefined }), trackingType: 'weight_reps' },
        { ...s(10, 8), trackingType: 'bodyweight_reps' },
      ]),
    ).toBe(500)
  })
})

describe('format', () => {
  it('formats set types', () => {
    expect(fmtSet('weight_reps', { kg: 82.5, reps: 5, rir: 2 })).toBe('82.5 kg × 5 · 2 left')
    expect(fmtSet('weight_reps', { reps: 3 })).toBe('? kg × 3')
    expect(fmtSet('bodyweight_reps', { kg: -20, reps: 8, rir: 4 })).toBe('BW-20 × 8 · 4+ left')
    expect(fmtSet('timed_hold', { seconds: 30 })).toBe('30 s')
  })
  it('computes ISO weeks', () => {
    expect(isoWeek(new Date(2026, 8, 28).getTime()).key).toBe('2026-W40')
    expect(isoWeek(new Date(2027, 0, 1).getTime()).key).toBe('2026-W53')
  })
})
