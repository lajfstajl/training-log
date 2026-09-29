import { config } from './config'
import type { Exercise, LoggedSet, Muscle } from './types'
import { MUSCLES } from './types'

export type MuscleVolume = Record<Muscle, number>

/**
 * R4. Fractional hard sets per muscle group (Pelland et al. 2026).
 * Counts confirmed working sets with RIR <= hardSetMaxRir inside the window ending at `now`.
 * Direct (primary) muscles get 1, indirect (secondary) muscles 0.5.
 * A set with no logged RIR is counted as hard, since working sets are prompted with a target.
 */
export function fractionalVolume(
  sets: LoggedSet[],
  exercises: Map<string, Pick<Exercise, 'primaryMuscles' | 'secondaryMuscles'>>,
  now: number,
  params = config.r4,
): MuscleVolume {
  const from = now - params.windowDays * 24 * 3600 * 1000
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as MuscleVolume
  for (const s of sets) {
    if (s.isWarmup || s.completedAt === undefined) continue
    if (s.completedAt < from || s.completedAt > now) continue
    if (s.rir !== undefined && s.rir > params.hardSetMaxRir) continue
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    for (const m of ex.primaryMuscles) out[m] += params.directWeight
    for (const m of ex.secondaryMuscles) {
      if (!ex.primaryMuscles.includes(m)) out[m] += params.indirectWeight
    }
  }
  return out
}
