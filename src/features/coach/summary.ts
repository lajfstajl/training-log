import { config } from '../../engine/config'
import { liftingShare } from '../../engine/focus'
import type { StoredProfile } from '../../db/profile'

/** "How I'll coach you": the loose plan, in plain words, from the setup answers. */
export function coachingSummary(p: StoredProfile, locationNames: string[]): string[] {
  const aim = p.weeklyAim ?? config.r16.defaultWeeklyAim
  const runs = p.running.runs ? p.running.perWeek : 0
  const lifts = liftingShare(p)
  const out = [
    `About ${aim} sessions a week${p.weeklyAim === null ? ' (you said it varies, so I start there)' : ''}. No fixed days: train when it suits you.`,
    `Strength comes first. Each strength session is full body with two heavy lifts, one for the legs and one for the upper body, rotating so each gets a heavy day about twice a week.`,
  ]
  if (runs > 0) {
    out.push(
      `Runs fill the gaps, up to ${runs} a week, while strength keeps at least ${lifts}. Runs are mostly easy, at most one harder run a week, and never more than 10% longer than your longest run in the last month.`,
    )
  }
  out.push(
    'Every time you start, I look at what you have actually done and how long ago, and suggest the most useful session for today. Missed days are fine: I adapt. You can always choose something else.',
  )
  out.push(
    Object.keys(p.baselines).length
      ? 'The first two weeks I start a bit under your numbers and adjust after every set.'
      : 'The first two weeks I help you find your working weights, set by set.',
  )
  if (p.avoidAreas.length) out.push(`I leave out exercises that load your ${p.avoidAreas.map((a) => a.replace('_', ' ')).join(', ')}.`)
  if (locationNames.length > 1) out.push(`At ${locationNames.join(' or ')}, I use only the equipment that is there.`)
  return out
}
