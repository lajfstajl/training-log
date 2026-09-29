import { config } from './config'
import { heavyLowerWithin, longestRunKm } from './history'
import type { CoachProfile, Exercise, RunType, TrainingHistory } from './types'

// R9 (single-run cap), R10 (mostly easy), R11 (around heavy legs), R15 (no run history).

export interface RunSuggestion {
  type: RunType
  minutes: number
  /** Hard ceiling for this run's distance (R9). */
  maxKm: number
  how: string
  why: string[]
  ruleIds: string[]
}

export function suggestRun(input: {
  now: number
  history: TrainingHistory
  profile: CoachProfile
  exercises: Map<string, Exercise>
  type: RunType
  minutes: number
  cfg?: typeof config
}): RunSuggestion {
  const cfg = input.cfg ?? config
  const { now, history, profile } = input
  const why: string[] = []
  const ruleIds = ['R9', 'R10']

  let type = input.type
  if (type === 'hard' && heavyLowerWithin(history, input.exercises, now, cfg.r11.hoursAfterHeavyLowerBeforeHardRun, cfg.r16.lowerMainPatterns)) {
    type = 'easy'
    why.push('Heavy legs in the last day, so this one stays easy.')
    ruleIds.push('R11')
  }

  const logged = longestRunKm(history.runs, now, cfg.r9.lookbackDays)
  const base = logged ?? (profile.running.longestKm > 0 ? profile.running.longestKm : undefined)
  let maxKm: number
  if (base === undefined) {
    maxKm = cfg.r16.noRunHistoryCapKm
    type = 'easy'
    why.push(`No recent runs, so start short and easy: at most ${maxKm} km.`)
    ruleIds.push('R15')
  } else {
    maxKm = Math.floor(base * cfg.r9.maxFractionOfLongest * 10) / 10
    why.push(
      `At most ${maxKm} km: your longest run in the last 30 days was ${base} km${logged === undefined ? ' (from setup)' : ''}, and single runs more than 10% longer raise injury risk.`,
    )
  }

  const how =
    type === 'easy'
      ? 'Easy, conversational pace: you could talk in full sentences.'
      : type === 'hard'
        ? '10 min easy, then 4 × 4 min hard (breathing heavily, not all-out) with 3 min easy jogging between, then easy to finish.'
        : 'Long and easy: slower than you think, the distance does the work.'
  return { type, minutes: input.minutes, maxKm, how, why, ruleIds }
}
