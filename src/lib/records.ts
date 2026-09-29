import { epley } from '../engine/e1rm'
import type { LoggedSet, TrackingType } from '../engine/types'

export interface Pr {
  exerciseId: string
  kind: 'e1rm' | 'reps' | 'seconds'
  value: number
  kg?: number
}

function working<T extends LoggedSet>(sets: T[]): T[] {
  return sets.filter((s) => !s.isWarmup && s.completedAt !== undefined)
}

/**
 * PRs set in `today` compared with all earlier sets of the same exercise.
 * weight_reps: best Epley e1RM (R6, ≤10 reps).
 * bodyweight_reps / timed_hold: most reps or seconds at the same or heavier added load.
 * The first ever exposure is not a PR.
 */
export function findPrs(exerciseId: string, type: TrackingType, today: LoggedSet[], before: LoggedSet[]): Pr[] {
  const now = working(today)
  const prev = working(before)
  if (prev.length === 0 || now.length === 0) return []

  if (type === 'weight_reps') {
    const best = (xs: LoggedSet[]) => Math.max(0, ...xs.map((s) => epley(s.kg ?? 0, s.reps ?? 0) ?? 0))
    const b = best(now)
    return b > best(prev) ? [{ exerciseId, kind: 'e1rm', value: b }] : []
  }

  const kind = type === 'timed_hold' ? 'seconds' : 'reps'
  const val = (s: LoggedSet) => (kind === 'seconds' ? s.seconds : s.reps) ?? 0
  let top: LoggedSet | undefined
  for (const s of now) if (!top || val(s) > val(top) || (val(s) === val(top) && (s.kg ?? 0) > (top.kg ?? 0))) top = s
  if (!top) return []
  const kg = top.kg ?? 0
  const prevBest = Math.max(0, ...prev.filter((s) => (s.kg ?? 0) >= kg).map(val))
  return val(top) > prevBest ? [{ exerciseId, kind, value: val(top), kg: kg || undefined }] : []
}

/** Tonnage of confirmed working weight_reps sets (kg × reps). */
export function sessionVolumeKg(sets: (LoggedSet & { trackingType: TrackingType })[]): number {
  return working(sets)
    .filter((s) => s.trackingType === 'weight_reps')
    .reduce((sum, s) => sum + (s.kg ?? 0) * (s.reps ?? 0), 0)
}
