import { availableHeavyPatterns, buildCandidates, weekVolume, type Candidate } from './candidates'
import { config } from './config'
import { chooseMainPatterns, recommendFocus, runTypeOf, strengthKind, type FocusResult } from './focus'
import { suggestRun, type RunSuggestion } from './run'
import { selectSession } from './select'
import type { CoachProfile, Equipment, Exercise, Focus, PainReport, Progression, TrainingHistory } from './types'

// One entry point for the UI: recommendation → candidates → a session (or a run).

export interface PlanInput {
  now: number
  history: TrainingHistory
  profile: CoachProfile
  exercises: Exercise[]
  progressions: Progression[]
  equipment: Equipment[]
  minutes: number
  energy: number
  pain: PainReport[]
  /** The user's choice at the check-in; undefined = take the recommendation. */
  focus?: Focus | 'strength' | 'calisthenics' | 'run'
  cfg?: typeof config
}

export interface Plan {
  recommendation: FocusResult
  focus: Focus
  candidates: Candidate[]
  session: Candidate[]
  run?: RunSuggestion
}

export function planToday(input: PlanInput): Plan {
  const cfg = input.cfg ?? config
  const byId = new Map(input.exercises.map((e) => [e.id, e]))
  const locationKind = strengthKind(input.equipment)
  const heavyFor = (k: 'strength' | 'calisthenics') => availableHeavyPatterns(input.exercises, input.progressions, input.equipment, k)
  const focusInput = {
    now: input.now,
    history: input.history,
    profile: input.profile,
    exercises: byId,
    equipment: input.equipment,
    heavyPatterns: heavyFor(locationKind),
    cfg,
  }
  const recommendation = recommendFocus(focusInput)

  let focus: Focus = recommendation.focus
  if (input.focus === 'run') focus = recommendation.focus.startsWith('run') ? recommendation.focus : 'run_easy'
  else if (input.focus) focus = input.focus

  const runType = runTypeOf(focus)
  if (runType) {
    const run = suggestRun({ now: input.now, history: input.history, profile: input.profile, exercises: byId, type: runType, minutes: input.minutes, cfg })
    return { recommendation, focus, candidates: [], session: [], run }
  }

  // Without lifting equipment, "strength" means calisthenics.
  const kind = focus === 'calisthenics' || locationKind === 'calisthenics' ? 'calisthenics' : 'strength'
  const count = input.minutes <= cfg.r16.oneMainAtMinutes ? 1 : 2
  const mainPatterns =
    recommendation.mainPatterns.length && !recommendation.focus.startsWith('run') && kind === locationKind
      ? recommendation.mainPatterns.slice(0, count)
      : chooseMainPatterns({ ...focusInput, heavyPatterns: heavyFor(kind) }, count, true)

  const candidates = buildCandidates({
    now: input.now,
    history: input.history,
    profile: input.profile,
    exercises: input.exercises,
    progressions: input.progressions,
    checkin: { kind, minutes: input.minutes, energy: input.energy, pain: input.pain, equipment: input.equipment },
    mainPatterns,
    cfg,
  })
  const session = selectSession(candidates, input.minutes, weekVolume(input.history, byId, input.now), cfg)
  return { recommendation, focus: kind, candidates, session }
}
