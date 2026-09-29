import type { Exercise, LoggedSet, PlannedFrom, Rir, SetRecord, TrackingType } from '../engine/types'

export interface PlannedSet {
  targetKg?: number
  targetReps?: number
  targetSec?: number
  targetRir: Rir
  plannedFrom: PlannedFrom
}

export interface Plan {
  sets: PlannedSet[]
  why: string
}

/**
 * Phase 1 planning: repeat last time's working sets, or start at the bottom of the range.
 * Phase 2 replaces this with engine targets; the shape stays the same.
 */
export function planFromHistory(ex: Exercise, lastWorking: LoggedSet[] | undefined, lastDate?: number): Plan {
  const isHold = ex.trackingType === 'timed_hold'
  const done = (lastWorking ?? []).filter((s) => !s.isWarmup && s.completedAt !== undefined)

  if (done.length > 0) {
    return {
      sets: done.map((s) => ({
        targetKg: s.kg,
        targetReps: isHold ? undefined : s.reps,
        targetSec: isHold ? s.seconds : undefined,
        targetRir: ex.targetRir,
        plannedFrom: 'history',
      })),
      why: `Same as last time${lastDate ? ` (${shortDate(lastDate)})` : ''}.`,
    }
  }

  return {
    sets: Array.from({ length: ex.defaultWorkingSets }, () => ({
      targetReps: isHold ? undefined : ex.rangeMin,
      targetSec: isHold ? ex.rangeMin : undefined,
      targetRir: ex.targetRir,
      plannedFrom: 'default' as const,
    })),
    why: firstTimeWhy(ex),
  }
}

/** Plain-language instruction for an exercise with no history (R15 calibration, simplified). */
function firstTimeWhy(ex: Exercise): string {
  const left = ex.targetRir
  if (ex.trackingType === 'timed_hold') {
    return `First time: hold for ${ex.rangeMin} s and stop while you could still hold a bit longer.`
  }
  const leftText = left === 0 ? 'until you can’t do another' : `stopping with ${left === 4 ? '4 or more' : left} rep${left === 1 ? '' : 's'} left in the tank`
  if (ex.trackingType === 'weight_reps') {
    return `First time: pick a weight you could lift about ${ex.rangeMin + left} times, and do ${ex.rangeMin}.`
  }
  return `First time: do ${ex.rangeMin} reps, ${leftText}.`
}

/**
 * The values a set shows and confirms with: what the user entered, else the target.
 * When there is no target load (first exposure), the load carries forward from the
 * previous confirmed set of the same exercise. Bodyweight and holds default to no added load.
 */
export function effectiveValues(
  type: TrackingType,
  set: Pick<SetRecord, 'kg' | 'reps' | 'seconds' | 'rir' | 'targetKg' | 'targetReps' | 'targetSec' | 'targetRir' | 'isWarmup'>,
  prev?: Pick<SetRecord, 'kg'>,
): { kg?: number; reps?: number; seconds?: number; rir?: Rir } {
  const isHold = type === 'timed_hold'
  const kg = set.kg ?? set.targetKg ?? (set.isWarmup ? undefined : prev?.kg) ?? (type === 'weight_reps' ? undefined : 0)
  return {
    kg,
    reps: isHold ? undefined : (set.reps ?? set.targetReps),
    seconds: isHold ? (set.seconds ?? set.targetSec) : undefined,
    rir: set.isWarmup ? undefined : (set.rir ?? set.targetRir),
  }
}

/** Why a set cannot be confirmed yet, or '' if it can. */
export function missingField(type: TrackingType, v: ReturnType<typeof effectiveValues>, isWarmup: boolean): string {
  if (type === 'weight_reps' && v.kg === undefined) return 'Enter load'
  if (type === 'timed_hold' && v.seconds === undefined) return 'Enter seconds'
  if (type !== 'timed_hold' && v.reps === undefined) return 'Enter reps'
  if (!isWarmup && v.rir === undefined) return 'Pick RIR'
  return ''
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
