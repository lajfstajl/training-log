import { config } from './config'
import { estimateMax, loadFor } from './e1rm'
import type { Exercise, Exposure, LoggedSet, Rir, Target, TargetSet } from './types'

// R1, R2, R3, R6, R7, R8, R12, R15: the next target for one exercise, from its own history.
// Pure: every number the app suggests for an exercise comes from here, with the rule ids that produced it.

const DAY = 86_400_000

export interface ProgressionContext {
  now: number
  /** "Recent working set" from setup, used only when there is no history (R15). */
  baseline?: { kg: number; reps: number }
  /** Neighbouring steps when the exercise is on a progression ladder (R8). */
  ladder?: { prev?: Exercise; next?: Exercise; prevExposures?: Exposure[] }
  cfg?: typeof config
}

export function roundLoad(kg: number, increment: number, mode: 'down' | 'nearest' = 'nearest'): number {
  if (!(increment > 0)) return Math.round(kg * 100) / 100
  const steps = mode === 'down' ? Math.floor(kg / increment + 1e-9) : Math.round(kg / increment)
  return Math.round(steps * increment * 100) / 100
}

export function workingSets(e: Exposure): LoggedSet[] {
  return e.sets.filter((s) => !s.isWarmup && s.completedAt !== undefined)
}

/** R1: never program failure on heavy main lifts. */
export function targetRirFor(ex: Exercise, cfg = config): Rir {
  if (!ex.isMainLift) return ex.targetRir
  return Math.min(cfg.r1.main.rirMax, Math.max(cfg.r1.main.rirMin, ex.targetRir)) as Rir
}

function bestMax(sets: LoggedSet[]): number | undefined {
  let best: number | undefined
  for (const s of sets) {
    const e = estimateMax(s.kg ?? 0, s.reps ?? 0, s.rir ?? 0)
    if (e !== undefined && (best === undefined || e > best)) best = e
  }
  return best
}

const kgText = (kg: number) => `${Math.round(kg * 100) / 100} kg`

export function nextTarget(ex: Exercise, exposures: Exposure[], ctx: ProgressionContext): Target {
  const cfg = ctx.cfg ?? config
  const isHold = ex.trackingType === 'timed_hold'
  const hasLoad = ex.trackingType === 'weight_reps'
  const unit = isHold ? ' s' : ' reps'
  const val = (s: LoggedSet) => (isHold ? s.seconds : s.reps) ?? 0
  const rir = targetRirFor(ex, cfg)
  const n = ex.defaultWorkingSets
  const exps = exposures
    .filter((e) => e.exerciseId === ex.id && workingSets(e).length > 0)
    .sort((a, b) => a.date - b.date)

  const make = (value: number, kg: number | undefined, r: Rir = rir, count = n, target: Exercise = ex): TargetSet[] =>
    Array.from({ length: count }, () => ({
      targetKg: kg,
      targetReps: target.trackingType === 'timed_hold' ? undefined : value,
      targetSec: target.trackingType === 'timed_hold' ? value : undefined,
      targetRir: r,
    }))

  const last = exps.at(-1)

  // ---- No history: R15 calibration start ----
  if (!last) {
    const calRir = Math.max(rir, cfg.r15.rirMin) as Rir
    if (hasLoad && ctx.baseline) {
      const e1 = estimateMax(ctx.baseline.kg, Math.min(ctx.baseline.reps, cfg.r6.maxRepsForE1rm))
      if (e1 !== undefined) {
        const load = roundLoad(loadFor(e1, ex.rangeMin, calRir), ex.increment, 'down')
        return {
          exerciseId: ex.id,
          sets: make(ex.rangeMin, load, calRir),
          ruleIds: ['R15', 'R6', 'R1'],
          why: `First time here: from your ${kgText(ctx.baseline.kg)} × ${ctx.baseline.reps}, start at ${kgText(load)} × ${ex.rangeMin} with ${calRir} left.`,
          calibrating: true,
        }
      }
    }
    const why = hasLoad
      ? `First time: pick a weight you could lift about ${ex.rangeMin + calRir} times, and do ${ex.rangeMin}.`
      : isHold
        ? `First time: hold ${ex.rangeMin} s and stop while you could still hold a bit longer.`
        : `First time: do ${ex.rangeMin} reps and stop with about ${calRir} left in the tank.`
    return {
      exerciseId: ex.id,
      sets: make(ex.rangeMin, hasLoad ? undefined : 0, calRir),
      ruleIds: ['R15', 'R1'],
      why,
      calibrating: true,
    }
  }

  const lastSets = workingSets(last)
  const lastKg = Math.max(0, ...lastSets.map((s) => s.kg ?? 0))
  const days = Math.floor((ctx.now - last.date) / DAY)

  // ---- R12: long break → recalibrate ----
  if (days > cfg.r12.recalibrateAfterDays) {
    const e1 = hasLoad ? bestMax(lastSets) : undefined
    const calRir = Math.max(rir, cfg.r15.rirMin) as Rir
    if (e1 !== undefined) {
      const load = roundLoad(loadFor(e1 * (1 - cfg.r12.reduceFraction), ex.rangeMin, calRir), ex.increment, 'down')
      return {
        exerciseId: ex.id,
        sets: make(ex.rangeMin, load, calRir),
        ruleIds: ['R12', 'R15', 'R6'],
        why: `Back after ${days} days: easing in at ${kgText(load)} × ${ex.rangeMin} with ${calRir} left.`,
        calibrating: true,
        event: 'return_reduction',
        change: `recalibrating at ${kgText(load)}`,
      }
    }
    return {
      exerciseId: ex.id,
      sets: make(ex.rangeMin, lastKg, calRir),
      ruleIds: ['R12', 'R15'],
      why: `Back after ${days} days: start again at ${ex.rangeMin}${unit}.`,
      calibrating: true,
      event: 'return_reduction',
      change: 'easing back in',
    }
  }

  // ---- R8: first try on a new ladder step fell short → back one step ----
  const prevStep = ctx.ladder?.prev
  if (prevStep && exps.length === 1 && (ctx.ladder?.prevExposures?.length ?? 0) > 0 && lastSets.some((s) => val(s) < ex.rangeMin)) {
    return {
      exerciseId: prevStep.id,
      sets: make(prevStep.rangeMax, 0, targetRirFor(prevStep, cfg), prevStep.defaultWorkingSets, prevStep),
      ruleIds: ['R8'],
      why: `Back to ${prevStep.name} for now: ${ex.name} needs ${ex.rangeMin}${unit} and you got ${Math.min(...lastSets.map(val))}. Flagged.`,
      calibrating: false,
      event: 'ladder_down',
      change: `back to ${prevStep.name}`,
    }
  }

  // ---- R15: still calibrating (fewer than 2 exposures) ----
  if (hasLoad && exps.length < cfg.r15.exposuresToGraduate) {
    const e1 = bestMax(lastSets)
    const load = e1 !== undefined ? roundLoad(loadFor(e1, ex.rangeMin, rir), ex.increment, 'down') : lastKg
    return withGap(
      {
        exerciseId: ex.id,
        sets: make(ex.rangeMin, load),
        ruleIds: ['R15', 'R6'],
        why: `Still finding your level: from last time, ${kgText(load)} × ${ex.rangeMin} should leave about ${rir} in the tank.`,
        calibrating: true,
      },
      days,
    )
  }

  // ---- R3: two stalled exposures in a row → reset ----
  const stalled = (e: Exposure) => workingSets(e).some((s) => val(s) < ex.rangeMin || (s.rir !== undefined && s.rir < rir))
  const prev = exps.at(-2)
  if (prev && stalled(last) && stalled(prev) && lastKg > 0) {
    const load = roundLoad(lastKg * (1 - cfg.r3.resetFraction), ex.increment, 'down')
    return {
      exerciseId: ex.id,
      sets: make(ex.rangeMin, load),
      ruleIds: ['R3'],
      why: `Reset: the last two sessions fell short of the target, so rebuild from ${kgText(load)} × ${ex.rangeMin}. This is normal, not failure.`,
      calibrating: false,
      event: 'reset',
      change: `reset to ${kgText(load)}`,
    }
  }

  // ---- R2 / R7: double progression ----
  const tol = cfg.r2.rirTolerance
  const top = lastSets.every((s) => val(s) >= ex.rangeMax && (s.rir === undefined || s.rir <= rir + tol))
  const easy = lastSets.every((s) => s.rir !== undefined && s.rir >= rir + cfg.r2.earlyProgressRirMargin)
  const rule = hasLoad ? 'R2' : 'R7'

  if (top && ex.progressionMode === 'ladder' && ctx.ladder?.next) {
    const next = ctx.ladder.next
    return {
      exerciseId: next.id,
      sets: make(next.rangeMin, 0, targetRirFor(next, cfg), next.defaultWorkingSets, next),
      ruleIds: ['R8', 'R7'],
      why: `Next step: ${next.name}. You hit ${ex.rangeMax}${unit} on every set of ${ex.name}. Start at ${next.rangeMin}${unit}.`,
      calibrating: false,
      event: 'ladder_up',
      change: `→ ${next.name}`,
    }
  }

  if (top || (easy && lastKg > 0)) {
    const load = roundLoad(lastKg + ex.increment, ex.increment)
    const reason = top
      ? `all sets hit ${ex.rangeMax}${unit} with ${rir + tol} or fewer left last time`
      : `last time felt easy (every set ${rir + cfg.r2.earlyProgressRirMargin}+ left)`
    return withGap(
      {
        exerciseId: ex.id,
        sets: make(ex.rangeMin, load),
        ruleIds: [rule],
        why: `+${ex.increment} kg: ${reason}. Back to ${ex.rangeMin}${unit}.`,
        calibrating: false,
        event: 'progressed',
        change: `+${ex.increment} kg`,
      },
      days,
    )
  }

  const step = isHold ? 5 : 1
  const minVal = Math.min(...lastSets.map(val))
  const aim = Math.min(ex.rangeMax, Math.max(ex.rangeMin, minVal + step))
  const same = hasLoad ? `Same weight (${kgText(lastKg)})` : lastKg > 0 ? `Same added load (${kgText(lastKg)})` : 'Same level'
  return withGap(
    {
      exerciseId: ex.id,
      sets: make(aim, lastKg),
      ruleIds: [rule],
      why: `${same}: aim for ${aim}${unit} on every set (last time ${lastSets.map(val).join(', ')}).`,
      calibrating: false,
    },
    days,
  )

  /** R12: 10–20 days since this exercise → about 10% lighter (or back to the bottom of the range). */
  function withGap(t: Target, d: number): Target {
    if (d < cfg.r12.reduceAfterDays) return t
    const sets = t.sets.map((s) =>
      s.targetKg !== undefined && s.targetKg > 0
        ? { ...s, targetKg: roundLoad(s.targetKg * (1 - cfg.r12.reduceFraction), ex.increment, 'down') }
        : { ...s, targetReps: s.targetReps !== undefined ? ex.rangeMin : undefined, targetSec: s.targetSec !== undefined ? ex.rangeMin : undefined },
    )
    const kg = sets[0]?.targetKg
    return {
      ...t,
      sets,
      ruleIds: [...t.ruleIds, 'R12'],
      why: `Back after ${d} days: about 10% easier. ${t.why}`,
      event: 'return_reduction',
      change: kg ? `eased to ${kgText(kg)} after ${d} days off` : `eased back after ${d} days off`,
    }
  }
}

/**
 * R15 in-session: after a confirmed calibration set, the load for the next set that should leave
 * `targetRir` in the tank at `targetReps`. Undefined when it cannot be estimated.
 */
export function nextSetLoad(ex: Exercise, done: { kg?: number; reps?: number; rir?: number }, targetReps: number, targetRir: number): number | undefined {
  if (ex.trackingType !== 'weight_reps') return undefined
  const e1 = estimateMax(done.kg ?? 0, done.reps ?? 0, done.rir ?? 0)
  if (e1 === undefined) return undefined
  return roundLoad(loadFor(e1, targetReps, targetRir), ex.increment, 'nearest')
}
