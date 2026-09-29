import { config } from './config'
import {
  DAY,
  daysBetween,
  hardRunWithin,
  heavyLowerWithin,
  hoursBetween,
  lastActivityDate,
  lastPatternDates,
  lastStrengthDate,
  runsWithin,
} from './history'
import type { CoachProfile, Equipment, Exercise, Focus, Pattern, RunType, TrainingHistory } from './types'

// R16 (with R5, R11, R12): what is most useful today. Loose by design: it reads what was actually
// done and when, never a calendar. The user can always pick something else at the check-in.

export interface FocusInput {
  now: number
  history: TrainingHistory
  profile: CoachProfile
  exercises: Map<string, Exercise>
  equipment: Equipment[]
  cfg?: typeof config
}

export interface FocusResult {
  focus: Focus
  reasons: string[]
  ruleIds: string[]
  /** For strength and calisthenics: which patterns get the heavy slots. */
  mainPatterns: Pattern[]
}

const LIFTING_EQUIPMENT: Equipment[] = ['barbell', 'dumbbells', 'machine', 'cable', 'kettlebell']

/** A location without lifting equipment means a calisthenics session. */
export function strengthKind(equipment: Equipment[]): 'strength' | 'calisthenics' {
  return equipment.some((e) => LIFTING_EQUIPMENT.includes(e)) ? 'strength' : 'calisthenics'
}

/**
 * R5: pick the heavy patterns for a full-body session. Most overdue first; nothing trained heavy in
 * the last 48 h if avoidable. Two slots = one lower + one upper (unless lower is blocked by R11).
 */
export function chooseMainPatterns(input: FocusInput, count: 1 | 2, allowLower: boolean): Pattern[] {
  const cfg = input.cfg ?? config
  const last = lastPatternDates(input.history, input.exercises, true)
  const age = (p: string) => input.now - (last.get(p as Pattern) ?? -Infinity)
  const recovered = (p: string) => hoursBetween(last.get(p as Pattern) ?? -Infinity, input.now) >= cfg.r5.minHoursBetweenHeavyPattern
  const byDue = (ps: string[]) => [...ps].sort((a, b) => Number(recovered(b)) - Number(recovered(a)) || age(b) - age(a))

  const lower = allowLower ? byDue(cfg.r16.lowerMainPatterns) : []
  const upper = byDue(cfg.r16.upperMainPatterns)
  if (count === 1) return [byDue([...lower, ...upper])[0] as Pattern]
  if (lower.length && recovered(lower[0])) return [lower[0], upper[0]] as Pattern[]
  // Lower blocked or not recovered: two upper patterns, one push and one pull.
  const push = upper.find((p) => p.includes('push'))!
  const pull = upper.find((p) => p.includes('pull'))!
  return (age(push) >= age(pull) ? [push, pull] : [pull, push]) as Pattern[]
}

const PATTERN_WORD: Record<string, string> = {
  squat: 'squats',
  hinge: 'hinges (deadlift)',
  horizontal_push: 'horizontal pressing',
  vertical_push: 'overhead pressing',
  vertical_pull: 'pull-ups / pulldowns',
  horizontal_pull: 'rows',
}

export function recommendFocus(input: FocusInput): FocusResult {
  const cfg = input.cfg ?? config
  const { now, history, profile } = input
  const kind = strengthKind(input.equipment)
  const reasons: string[] = []
  const ruleIds = ['R16']

  const lastAny = lastActivityDate(history)
  const running = profile.running.runs && profile.running.perWeek > 0
  const blockLower = hardRunWithin(history.runs, now, cfg.r11.hoursAfterHardRunBeforeHeavyLower)
  const strength = (count: 1 | 2 = 2): FocusResult => {
    const mainPatterns = chooseMainPatterns(input, count, !blockLower)
    const last = lastPatternDates(history, input.exercises, true)
    for (const p of mainPatterns) {
      const d = last.get(p)
      reasons.push(d === undefined ? `No heavy ${PATTERN_WORD[p]} logged yet.` : `Heavy ${PATTERN_WORD[p]} last done ${daysBetween(d, now)} days ago.`)
    }
    if (blockLower) {
      reasons.push('Hard or long run in the last day, so no heavy legs today.')
      ruleIds.push('R11')
    }
    return { focus: kind, reasons, ruleIds: [...ruleIds, 'R5'], mainPatterns }
  }

  // First session ever.
  if (lastAny === undefined) {
    reasons.push('First session: I will help you find your working weights.')
    ruleIds.push('R15')
    return strength()
  }

  // Back after a break.
  const daysOff = daysBetween(lastAny, now)
  if (daysOff > cfg.r16.welcomeBackDays) {
    reasons.push(`${daysOff} days since your last session. Welcome back: weights are eased where needed.`)
    ruleIds.push('R12')
    return strength()
  }

  // Is a run due, and does strength have room to wait?
  if (running) {
    const lastRun = history.runs.length ? Math.max(...history.runs.map((r) => r.date)) : undefined
    const daysSinceRun = lastRun === undefined ? Infinity : (now - lastRun) / DAY
    const runDue = daysSinceRun >= 7 / profile.running.perWeek
    const lastLift = lastStrengthDate(history)
    const liftedRecently = lastLift !== undefined && hoursBetween(lastLift, now) < cfg.r16.strengthRecentHours
    const liftAim = liftingShare(profile, cfg)
    const liftsThisWeek = history.sessions.filter((s) => now - s.date < 7 * DAY).length
    if (runDue && (liftedRecently || liftsThisWeek >= liftAim)) {
      reasons.push(
        lastRun === undefined ? 'No run logged yet.' : `Last run ${Math.floor(daysSinceRun)} days ago (aim: ${profile.running.perWeek} a week).`,
      )
      reasons.push(liftedRecently ? 'You lifted in the last day, so a run fits well today.' : `Strength is on track this week (${liftsThisWeek} sessions).`)
      return { focus: pickRunType(input, reasons, ruleIds), reasons, ruleIds, mainPatterns: [] }
    }
  }

  return strength()
}

/**
 * Strength first: lifting keeps at least half the weekly aim (rounded up); runs fill the rest.
 * Example: aim 3 with 2 runs wanted → 2 lifting sessions, runs fill the gaps.
 */
export function liftingShare(profile: CoachProfile, cfg = config): number {
  const aim = profile.weeklyAim ?? cfg.r16.defaultWeeklyAim
  const runs = profile.running.runs ? profile.running.perWeek : 0
  return Math.max(1, Math.ceil(aim / 2), aim - runs)
}

/** R10 + R11: easy by default; one harder run a week when legs are fresh; an occasional long run. */
export function pickRunType(input: FocusInput, reasons: string[] = [], ruleIds: string[] = []): Focus {
  const cfg = input.cfg ?? config
  const { now, history } = input
  const recent = runsWithin(history.runs, now, cfg.r16.hardRunMinDaysApart)
  const hardThisWeek = recent.some((r) => r.runType === 'hard')
  const legsTired = heavyLowerWithin(history, input.exercises, now, cfg.r11.hoursAfterHeavyLowerBeforeHardRun, cfg.r16.lowerMainPatterns)
  ruleIds.push('R10')
  if (legsTired) {
    reasons.push('Heavy legs in the last day, so keep it easy.')
    ruleIds.push('R11')
    return 'run_easy'
  }
  if (!hardThisWeek && recent.length >= 1 && input.profile.running.perWeek >= 2) {
    reasons.push('No harder run this week yet, and your legs are fresh.')
    return 'run_hard'
  }
  const longRecent = runsWithin(history.runs, now, cfg.r16.longRunMinDaysApart).some((r) => r.runType === 'long')
  if (!longRecent && input.profile.running.perWeek >= 2 && recent.length >= 2) {
    reasons.push('No long run in two weeks.')
    return 'run_long'
  }
  return 'run_easy'
}

export const runTypeOf = (f: Focus): RunType | undefined =>
  f === 'run_easy' ? 'easy' : f === 'run_hard' ? 'hard' : f === 'run_long' ? 'long' : undefined
