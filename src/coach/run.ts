import type { Candidate } from '../engine/candidates'
import { getAiSettings, selectionCall } from './ai'
import { chooseWithAi, type ChoiceResult } from './orchestrate'
import type { CoachContext } from './prompt'

export interface CoachOutcome extends ChoiceResult {
  model: string
  /** True when no AI call was attempted (no key). */
  skipped: boolean
}

/**
 * The coach flow for a strength/calisthenics plan: the AI chooses and explains if a key is set,
 * otherwise (or on any failure) the engine's own selection is used.
 */
export async function coachChoose(ctx: CoachContext, kind: 'strength' | 'calisthenics', candidates: Candidate[]): Promise<CoachOutcome> {
  const s = await getAiSettings()
  if (!s.apiKey || !navigator.onLine) {
    return { ids: ctx.engineIds, valid: true, usedFallback: false, raw: '', errors: [], model: 'engine', skipped: true }
  }
  const r = await chooseWithAi({
    call: selectionCall({ apiKey: s.apiKey, model: s.model }, ctx),
    candidates,
    engineIds: ctx.engineIds,
    minutes: ctx.minutes,
    kind,
  })
  return { ...r, model: r.usedFallback ? 'engine' : s.model, skipped: false }
}
