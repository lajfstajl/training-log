import { SEED_EXERCISES, SEED_LOCATIONS, SEED_PROGRESSIONS } from '../../src/db/seed'
import type { CoachProfile, Equipment, Exposure, Rir, RunRecord, RunType, TrainingHistory } from '../../src/engine/types'

// Fixture builders: a fixed "now" and compact ways to describe past training.

export const NOW = new Date(2026, 9, 1, 12, 0, 0).getTime() // Thu 1 Oct 2026, noon
export const DAY = 86_400_000
export const ago = (days: number) => NOW - days * DAY

export const EXERCISES = SEED_EXERCISES
export const PROGRESSIONS = SEED_PROGRESSIONS
export const BY_ID = new Map(EXERCISES.map((e) => [e.id, e]))
export const ex = (id: string) => BY_ID.get(id)!
export const GYM = SEED_LOCATIONS[0].equipment as Equipment[]
export const HOME = SEED_LOCATIONS[1].equipment as Equipment[]

export function profile(over: Partial<CoachProfile> = {}): CoachProfile {
  return {
    goal: 'strength',
    weeklyAim: 3,
    typicalMinutes: 60,
    baselines: {},
    pullUps: null,
    avoidAreas: [],
    avoidNote: '',
    running: { runs: false, longestKm: 0, perWeek: 0 },
    note: '',
    ...over,
  }
}

/** sets as [kg, reps, rir] or [kg, seconds, rir] for holds. */
export function exposure(exerciseId: string, daysAgo: number, sets: [number, number, number][]): Exposure {
  const hold = ex(exerciseId).trackingType === 'timed_hold'
  const date = ago(daysAgo)
  return {
    exerciseId,
    sessionId: `s-${daysAgo}`,
    date,
    sets: sets.map(([kg, v, rir]) => ({
      exerciseId,
      isWarmup: false,
      kg,
      reps: hold ? undefined : v,
      seconds: hold ? v : undefined,
      rir: rir as Rir,
      completedAt: date,
    })),
  }
}

export const run = (daysAgo: number, km: number, runType: RunType = 'easy'): RunRecord => ({
  date: ago(daysAgo),
  distanceKm: km,
  durationSec: km * 360,
  runType,
})

/** Sessions are derived from the exposures' dates. */
export function history(exposures: Exposure[] = [], runs: RunRecord[] = []): TrainingHistory {
  const dates = [...new Set(exposures.map((e) => e.date))]
  return { exposures, runs, sessions: dates.map((date) => ({ date, kind: 'strength' as const })) }
}

export const same = (n: number, kg: number, reps: number, rir: number): [number, number, number][] =>
  Array.from({ length: n }, () => [kg, reps, rir])
