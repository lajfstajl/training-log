import type { Exercise, Exposure, Pattern, RunRecord, TrainingHistory } from './types'

// Small pure queries over training history. Times are epoch ms.

export const DAY = 86_400_000
export const HOUR = 3_600_000

export const daysBetween = (from: number, to: number) => Math.floor((to - from) / DAY)
export const hoursBetween = (from: number, to: number) => (to - from) / HOUR

/** Exercises that count as a "heavy" slot for their pattern: main lifts and ladder skills. */
export const isHeavy = (ex: Exercise) => ex.isMainLift || ex.progressionMode === 'ladder'

export function exposuresOf(history: TrainingHistory, exerciseId: string): Exposure[] {
  return history.exposures.filter((e) => e.exerciseId === exerciseId).sort((a, b) => a.date - b.date)
}

/** Most recent date each pattern was trained (heavy only, or any exposure). */
export function lastPatternDates(history: TrainingHistory, exercises: Map<string, Exercise>, heavyOnly: boolean): Map<Pattern, number> {
  const out = new Map<Pattern, number>()
  for (const e of history.exposures) {
    const ex = exercises.get(e.exerciseId)
    if (!ex || (heavyOnly && !isHeavy(ex))) continue
    if ((out.get(ex.pattern) ?? -Infinity) < e.date) out.set(ex.pattern, e.date)
  }
  return out
}

export function lastActivityDate(history: TrainingHistory): number | undefined {
  const dates = [...history.sessions.map((s) => s.date), ...history.runs.map((r) => r.date)]
  return dates.length ? Math.max(...dates) : undefined
}

/** Most recent lifting or calisthenics session (free sessions count too). */
export function lastStrengthDate(history: TrainingHistory): number | undefined {
  const d = history.sessions.map((s) => s.date)
  return d.length ? Math.max(...d) : undefined
}

export function runsWithin(runs: RunRecord[], now: number, days: number): RunRecord[] {
  return runs.filter((r) => r.date <= now && now - r.date <= days * DAY)
}

/** R9: longest single run in the lookback window, or undefined if none. */
export function longestRunKm(runs: RunRecord[], now: number, days: number): number | undefined {
  const within = runsWithin(runs, now, days)
  return within.length ? Math.max(...within.map((r) => r.distanceKm)) : undefined
}

/** R11: was a heavy lower-body main lift trained within `hours` before `now`? */
export function heavyLowerWithin(history: TrainingHistory, exercises: Map<string, Exercise>, now: number, hours: number, lowerPatterns: string[]): boolean {
  return history.exposures.some((e) => {
    const ex = exercises.get(e.exerciseId)
    return !!ex && ex.isMainLift && lowerPatterns.includes(ex.pattern) && e.date <= now && hoursBetween(e.date, now) <= hours
  })
}

/** R11: was there a hard or long run within `hours` (inclusive) before `now`? */
export function hardRunWithin(runs: RunRecord[], now: number, hours: number): boolean {
  return runs.some((r) => r.runType !== 'easy' && r.date <= now && hoursBetween(r.date, now) <= hours)
}
