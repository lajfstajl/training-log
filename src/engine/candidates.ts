import { config } from './config'
import { DAY, exposuresOf, hoursBetween, lastPatternDates } from './history'
import { nextTarget, roundLoad } from './progression'
import type { BodyArea, CoachProfile, Equipment, Exercise, Muscle, PainReport, Pattern, Progression, Rir, Target, TrainingHistory } from './types'
import { fractionalVolume, type MuscleVolume } from './volume'

// Builds the ranked candidate list for today (R1–R8, R12–R15 via nextTarget; R4, R5, R13, R14 here).
// The AI may only choose and order from this list; every number in it comes from the engine.

export type Role = 'main' | 'accessory' | 'core'

export interface Candidate {
  /** Stable id for the AI to refer to. Equal to the exercise id. */
  id: string
  exercise: Exercise
  role: Role
  /** Score without the R4 deficit part; select.ts adds the deficit as the session fills up. */
  baseScore: number
  target: Target
  /** Plain notes such as "Shoulder 6/10: lighter". */
  marks: string[]
  estMinutes: number
}

export interface CheckinInput {
  kind: 'strength' | 'calisthenics'
  minutes: number
  energy: number
  pain: PainReport[]
  equipment: Equipment[]
}

export interface CandidateInput {
  now: number
  history: TrainingHistory
  profile: CoachProfile
  exercises: Exercise[]
  progressions: Progression[]
  checkin: CheckinInput
  mainPatterns: Pattern[]
  cfg?: typeof config
}

export function stressesArea(ex: Exercise, area: BodyArea, cfg = config): boolean {
  const a = cfg.r14.areas[area]
  return !!a && (a.patterns.includes(ex.pattern) || ex.primaryMuscles.some((m) => a.muscles.includes(m)))
}

/** R4: this week's fractional sets from confirmed working sets in history. */
export function weekVolume(history: TrainingHistory, exercises: Map<string, Exercise>, now: number): MuscleVolume {
  return fractionalVolume(
    history.exposures.flatMap((e) => e.sets.map((s) => ({ ...s, exerciseId: e.exerciseId }))),
    exercises,
    now,
  )
}

/** R4: how far below the weekly target this exercise's muscles are (direct 1, indirect 0.5). */
export function deficitScore(ex: Exercise, vol: MuscleVolume, cfg = config): number {
  const gap = (m: Muscle) => Math.max(0, cfg.r4.targetMin - vol[m])
  return ex.primaryMuscles.reduce((s, m) => s + gap(m), 0) + 0.5 * ex.secondaryMuscles.reduce((s, m) => s + gap(m), 0)
}

export function estimateMinutes(t: Target, ex: Exercise, role: Role, cfg = config): number {
  const work = t.sets.reduce((s, x) => s + (x.targetSec ?? (x.targetReps ?? ex.rangeMin) * cfg.time.secPerRep), 0)
  const rest = Math.max(0, t.sets.length - 1) * ex.defaultRestSec
  const warm = role === 'main' ? cfg.time.mainWarmupMin : 0
  return Math.round(((work + rest) / 60 + warm + cfg.time.transitionMin) * 10) / 10
}

/** Current step of each ladder: the step trained most recently, or a default from setup. */
function currentLadderSteps(input: CandidateInput): Map<string, number> {
  const cfg = input.cfg ?? config
  const out = new Map<string, number>()
  for (const p of input.progressions) {
    let best: { date: number; step: number } | undefined
    p.steps.forEach((s, i) => {
      const e = exposuresOf(input.history, s.exerciseId).at(-1)
      if (e && (!best || e.date > best.date)) best = { date: e.date, step: i }
    })
    let step = best?.step ?? cfg.r8.defaultStep[p.id] ?? 0
    if (!best && p.id === 'ladder-pull-up' && input.profile.pullUps !== null) {
      step = cfg.r8.pullUpSteps.filter((x) => input.profile.pullUps! >= x.minReps).at(-1)?.step ?? step
    }
    out.set(p.id, Math.min(step, p.steps.length - 1))
  }
  return out
}

export function buildCandidates(input: CandidateInput): Candidate[] {
  const cfg = input.cfg ?? config
  const { now, history, profile, checkin } = input
  const byId = new Map(input.exercises.map((e) => [e.id, e]))
  const steps = currentLadderSteps(input)
  const ladderOf = new Map<string, { p: Progression; i: number }>()
  for (const p of input.progressions) p.steps.forEach((s, i) => ladderOf.set(s.exerciseId, { p, i }))
  const atTop = (ladderId: string) => {
    const p = input.progressions.find((x) => x.id === ladderId)
    return !!p && steps.get(ladderId) === p.steps.length - 1 && exposuresOf(history, p.steps[p.steps.length - 1].exerciseId).length > 0
  }

  const available = (ex: Exercise) =>
    !ex.archived &&
    ex.trackingType !== 'run' &&
    ex.equipment.every((q) => checkin.equipment.includes(q)) &&
    !profile.avoidAreas.some((a) => stressesArea(ex, a, cfg)) &&
    (checkin.kind === 'strength' || ex.trackingType !== 'weight_reps')

  // Pool: available exercises, with only the current step of each ladder.
  const pool = input.exercises.filter((ex) => {
    if (!available(ex)) return false
    const l = ladderOf.get(ex.id)
    if (l && steps.get(l.p.id) !== l.i) return false
    const needs = cfg.r8.weightedAfterLadder[ex.id]
    if (needs && !atTop(needs)) return false
    return true
  })

  // Heavy slot per main pattern: a main lift (strength) or the current ladder step (calisthenics / fallback).
  const mainIds = new Set<string>()
  for (const pattern of input.mainPatterns) {
    const options = pool.filter(
      (ex) => ex.pattern === pattern && (checkin.kind === 'strength' ? ex.isMainLift : ladderOf.has(ex.id)),
    )
    const fallback = pool.filter((ex) => ex.pattern === pattern && ladderOf.has(ex.id))
    const pick = [...(options.length ? options : fallback)].sort(
      (a, b) => exposuresOf(history, b.id).length - exposuresOf(history, a.id).length,
    )[0]
    if (pick) mainIds.add(pick.id)
  }

  const vol = weekVolume(history, byId, now)
  const lastAny = lastPatternDates(history, byId, false)
  const lastHeavy = lastPatternDates(history, byId, true)
  const pain = checkin.pain.filter((p) => p.score > cfg.r14.threshold)
  const lowEnergy = checkin.energy <= cfg.r13.lowEnergyMax

  const out: Candidate[] = []
  for (const ex of pool) {
    // Other main lifts rest today in a strength session: two heavy slots keep full-body sessions short.
    if (ex.isMainLift && !mainIds.has(ex.id)) continue
    const role: Role = mainIds.has(ex.id) ? 'main' : ex.pattern === 'core' || ex.pattern === 'skill' ? 'core' : 'accessory'

    const l = ladderOf.get(ex.id)
    const ladder = l
      ? {
          prev: l.i > 0 ? byId.get(l.p.steps[l.i - 1].exerciseId) : undefined,
          next: l.i < l.p.steps.length - 1 ? byId.get(l.p.steps[l.i + 1].exerciseId) : undefined,
          prevExposures: l.i > 0 ? exposuresOf(history, l.p.steps[l.i - 1].exerciseId) : [],
        }
      : undefined
    let target = nextTarget(ex, exposuresOf(history, ex.id), { now, baseline: profile.baselines[ex.id], ladder, cfg })
    let exercise = ex
    if (target.exerciseId !== ex.id) {
      const switched = byId.get(target.exerciseId)
      if (switched && available(switched)) exercise = switched
      else target = nextTarget(ex, exposuresOf(history, ex.id), { now, baseline: profile.baselines[ex.id], cfg })
    }

    const marks: string[] = []
    const ruleIds = [...target.ruleIds]
    let sets = target.sets
    let why = target.why

    // R14: pain above the threshold in an area this exercise stresses → lighter, one set fewer, marked.
    const hurts = pain.filter((p) => stressesArea(exercise, p.area, cfg))
    if (hurts.length) {
      const worst = hurts.reduce((a, b) => (b.score > a.score ? b : a))
      const label = `${worst.area.replace('_', ' ')} ${worst.score}/10`
      sets = sets.slice(0, Math.max(1, sets.length - cfg.r14.setsRemoved)).map((s) => ({
        ...s,
        targetKg: s.targetKg && s.targetKg > 0 ? roundLoad(s.targetKg * cfg.r14.loadFactor, exercise.increment, 'down') : s.targetKg,
        targetRir: Math.min(4, s.targetRir + (s.targetKg && s.targetKg > 0 ? 0 : 1)) as Rir,
      }))
      marks.push(`${label[0].toUpperCase()}${label.slice(1)}: lighter`)
      why = `${label[0].toUpperCase()}${label.slice(1)}: about 20% lighter and one set fewer. You decide. ${why}`
      ruleIds.push('R14')
    }

    // R13: low energy → about a third fewer sets and at least 2 reps left. Never increases anything.
    if (lowEnergy) {
      const keep = Math.max(1, Math.round(sets.length * (1 - cfg.r13.volumeReduction)))
      sets = sets.slice(0, keep).map((s) => ({ ...s, targetRir: Math.max(s.targetRir, cfg.r13.minRirWhenLow) as Rir }))
      why = `Low energy: fewer sets, ${cfg.r13.minRirWhenLow}+ left. ${why}`
      ruleIds.push('R13')
    }

    const finalTarget: Target = { ...target, exerciseId: exercise.id, sets, why, ruleIds: [...new Set(ruleIds)] }

    // Scoring. Mains: always first, most overdue pattern first. Others: R5 recovery and familiarity;
    // the R4 deficit is added in select.ts as the session fills up.
    let baseScore: number
    if (role === 'main') {
      const d = lastHeavy.get(exercise.pattern)
      baseScore = 1000 + (d === undefined ? 30 : Math.min(30, (now - d) / DAY))
    } else {
      // Plain core work is preferred for the core slot; skill holds come in via calisthenics sessions.
      baseScore = role === 'core' ? (exercise.pattern === 'skill' ? 0 : 2) : 10
      const d = lastAny.get(exercise.pattern)
      if (d !== undefined && hoursBetween(d, now) < cfg.r5.minHoursBetweenPattern) baseScore -= 20
      if (input.mainPatterns.includes(exercise.pattern)) baseScore -= 8
      if (exercise.pattern === 'isolation') baseScore -= 3
      if (exposuresOf(history, exercise.id).length > 0) baseScore += 2
      if (hurts.length) baseScore -= 5
    }

    out.push({
      id: exercise.id,
      exercise,
      role,
      baseScore,
      target: finalTarget,
      marks,
      estMinutes: estimateMinutes(finalTarget, exercise, role, cfg),
    })
  }

  // A ladder switch can produce a duplicate id; keep the first.
  const seen = new Set<string>()
  return out
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
    .sort((a, b) => b.baseScore + deficitScore(b.exercise, vol, cfg) - (a.baseScore + deficitScore(a.exercise, vol, cfg)))
}
