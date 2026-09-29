import type { Candidate } from './candidates'
import { deficitScore } from './candidates'
import { config } from './config'
import type { Muscle } from './types'
import type { MuscleVolume } from './volume'

// Deterministic session builder: used when the AI is unavailable, and as the reference the AI's
// choice is checked against (time budget). Greedy: heavy mains, then accessories that close the
// biggest R4 gaps (recomputed as the session fills), then core, within the time budget.

export function sessionMinutes(items: Candidate[], cfg = config): number {
  return cfg.time.generalWarmupMin + items.reduce((s, c) => s + c.estMinutes, 0)
}

export function selectSession(cands: Candidate[], minutes: number, weekVol: MuscleVolume, cfg = config): Candidate[] {
  const budget = minutes - cfg.time.generalWarmupMin
  let used = 0
  const chosen: Candidate[] = []
  const fits = (c: Candidate) => used + c.estMinutes <= budget
  const take = (c: Candidate) => {
    chosen.push(c)
    used += c.estMinutes
  }

  const mainCount = minutes <= cfg.r16.oneMainAtMinutes ? 1 : 2
  for (const c of cands.filter((x) => x.role === 'main')) {
    if (chosen.length >= mainCount) break
    if (chosen.some((x) => x.exercise.pattern === c.exercise.pattern)) continue
    if (chosen.length === 0 || fits(c)) take(c) // always at least one main
  }

  // Projected volume after the chosen sets, so accessories spread across muscles.
  const projected: MuscleVolume = { ...weekVol }
  const addVolume = (c: Candidate) => {
    const n = c.target.sets.length
    for (const m of c.exercise.primaryMuscles) projected[m as Muscle] += n
    for (const m of c.exercise.secondaryMuscles) projected[m as Muscle] += n * cfg.r4.indirectWeight
  }
  chosen.forEach(addVolume)

  // R4 upper bound: no accessory that would push a muscle past the weekly maximum.
  const overMax = (c: Candidate) => c.exercise.primaryMuscles.some((m) => projected[m as Muscle] + c.target.sets.length > cfg.r4.targetMax)
  const accessories = cands.filter((x) => x.role === 'accessory')
  for (let i = 0; i < cfg.r16.maxAccessories; i++) {
    const usedPatterns = chosen.map((c) => c.exercise.pattern)
    const scored = accessories
      .filter((c) => !chosen.includes(c) && fits(c) && !overMax(c))
      .map((c) => ({ c, s: c.baseScore + deficitScore(c.exercise, projected, cfg) * 3 - (usedPatterns.includes(c.exercise.pattern) ? 15 : 0) }))
      .sort((a, b) => b.s - a.s)
    if (!scored.length) break
    take(scored[0].c)
    addVolume(scored[0].c)
  }

  const core = cands.filter((x) => x.role === 'core' && fits(x)).sort((a, b) => b.baseScore - a.baseScore)[0]
  if (core) take(core)

  if (chosen.length === 0 && cands.length) chosen.push(cands[0])
  const order = { main: 0, accessory: 1, core: 2 }
  return chosen.sort((a, b) => order[a.role] - order[b.role])
}

/** Regenerate reasons the engine can act on without the AI. */
export type RegenReason = 'shorter' | 'no_barbell' | 'more_pull' | 'less_legs' | 'different'

/**
 * Re-selects from the same candidate list under a reason. Numbers are unchanged: the candidates keep
 * their engine targets; only which ones are chosen changes.
 */
export function reselect(
  cands: Candidate[],
  current: Candidate[],
  minutes: number,
  weekVol: MuscleVolume,
  reason: RegenReason,
  cfg = config,
): { items: Candidate[]; minutes: number } {
  let pool = cands
  let mins = minutes
  switch (reason) {
    case 'shorter':
      mins = Math.max(15, minutes - 15)
      break
    case 'no_barbell':
      pool = cands.filter((c) => !c.exercise.equipment.includes('barbell'))
      break
    case 'more_pull':
      pool = cands.map((c) => (c.exercise.pattern.includes('pull') ? { ...c, baseScore: c.baseScore + 25 } : c))
      break
    case 'less_legs':
      pool = cands.filter(
        (c) => !['squat', 'hinge'].includes(c.exercise.pattern) && !c.exercise.primaryMuscles.some((m) => ['quads', 'hamstrings', 'glutes'].includes(m)),
      )
      break
    case 'different': {
      const keep = new Set(current.filter((c) => c.role === 'main').map((c) => c.id))
      pool = cands.filter((c) => keep.has(c.id) || !current.some((x) => x.id === c.id))
      break
    }
  }
  return { items: selectSession(pool, mins, weekVol, cfg), minutes: mins }
}

/** Swap options: up to `n` other candidates with the same pattern, best first. */
export function alternativesFor(c: Candidate, all: Candidate[], exclude: string[], n = 2): Candidate[] {
  return all.filter((x) => x.id !== c.id && !exclude.includes(x.id) && x.exercise.pattern === c.exercise.pattern).slice(0, n)
}
