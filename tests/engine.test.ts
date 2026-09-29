import { describe, expect, it } from 'vitest'
import { epley } from '../src/engine/e1rm'
import { fractionalVolume } from '../src/engine/volume'
import type { LoggedSet } from '../src/engine/types'

describe('R6 epley', () => {
  it('computes kg × (1 + reps/30)', () => {
    expect(epley(100, 5)).toBeCloseTo(116.667, 2)
    expect(epley(100, 10)).toBeCloseTo(133.333, 2)
  })
  it('returns the load itself for a single', () => {
    expect(epley(140, 1)).toBe(140)
  })
  it('is undefined above 10 reps, for zero reps and for no load', () => {
    expect(epley(60, 11)).toBeUndefined()
    expect(epley(60, 0)).toBeUndefined()
    expect(epley(0, 5)).toBeUndefined()
    expect(epley(60, 5.5)).toBeUndefined()
  })
})

describe('R4 fractional volume', () => {
  const DAY = 86400000
  const now = 100 * DAY
  const exercises = new Map([
    ['bench', { primaryMuscles: ['chest' as const], secondaryMuscles: ['triceps' as const, 'shoulders' as const] }],
    ['row', { primaryMuscles: ['back' as const], secondaryMuscles: ['biceps' as const] }],
  ])
  const set = (exerciseId: string, over: Partial<LoggedSet> = {}): LoggedSet => ({
    exerciseId,
    isWarmup: false,
    kg: 60,
    reps: 8,
    rir: 2,
    completedAt: now - DAY,
    ...over,
  })

  it('counts direct sets as 1 and indirect as 0.5', () => {
    const v = fractionalVolume([set('bench'), set('bench'), set('row')], exercises, now)
    expect(v.chest).toBe(2)
    expect(v.triceps).toBe(1)
    expect(v.shoulders).toBe(1)
    expect(v.back).toBe(1)
    expect(v.biceps).toBe(0.5)
    expect(v.quads).toBe(0)
  })

  it('ignores warm-ups, unconfirmed sets, easy sets and sets outside 7 days', () => {
    const v = fractionalVolume(
      [
        set('bench', { isWarmup: true }),
        set('bench', { completedAt: undefined }),
        set('bench', { rir: 5 as never }),
        set('bench', { completedAt: now - 8 * DAY }),
        set('bench', { rir: 4 }),
      ],
      exercises,
      now,
    )
    expect(v.chest).toBe(1) // only the RIR 4 set counts
  })
})
