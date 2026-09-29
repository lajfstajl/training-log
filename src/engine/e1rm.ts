import { config } from './config'

/**
 * R6. Estimated 1RM with the Epley formula: kg × (1 + reps / 30).
 * Only defined for 1..maxReps reps; returns undefined otherwise.
 * Used for trends and PRs, never shown as a test result.
 */
/**
 * R6 + R1: estimated max from a set, counting the reps left in reserve as reps the lifter could
 * have done (reps + RIR). Only from sets of ≤ maxReps actual reps. RIR "4+" counts as 4.
 */
export function estimateMax(kg: number, reps: number, rir = 0, maxReps: number = config.r6.maxRepsForE1rm): number | undefined {
  if (!(kg > 0) || !Number.isInteger(reps) || reps < 1 || reps > maxReps) return undefined
  return kg * (1 + (reps + Math.min(rir, 4)) / 30)
}

/** Inverse of estimateMax: the load that allows `reps` with `rir` left, for an estimated max. */
export function loadFor(e1rm: number, reps: number, rir: number): number {
  return e1rm / (1 + (reps + rir) / 30)
}

export function epley(kg: number, reps: number, maxReps: number = config.r6.maxRepsForE1rm): number | undefined {
  if (!(kg > 0) || !Number.isInteger(reps) || reps < 1 || reps > maxReps) return undefined
  if (reps === 1) return kg
  return kg * (1 + reps / 30)
}
