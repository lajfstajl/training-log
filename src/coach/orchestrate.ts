import type { Candidate } from '../engine/candidates'
import { validateSelection } from './validate'

// AI first, engine second: ask the AI to choose from the engine's candidates; validate; retry once
// with the errors; otherwise use the engine's own selection. Never throws.

export type AiCall = (feedback?: string) => Promise<unknown>

export interface ChoiceResult {
  ids: string[]
  rationale?: string
  valid: boolean
  usedFallback: boolean
  raw: string
  errors: string[]
}

export async function chooseWithAi(opts: {
  call: AiCall
  candidates: Candidate[]
  engineIds: string[]
  minutes: number
  kind: 'strength' | 'calisthenics'
}): Promise<ChoiceResult> {
  const errors: string[] = []
  const raws: unknown[] = []
  let feedback: string | undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    let answer: unknown
    try {
      answer = await opts.call(feedback)
    } catch (e) {
      errors.push(`attempt ${attempt + 1}: ${e instanceof Error ? e.message : String(e)}`)
      break // network/auth problems won't fix themselves on an immediate retry
    }
    raws.push(answer)
    const v = validateSelection(answer, opts.candidates, opts.minutes, opts.kind)
    if (v.ok) {
      const a = answer as { exercise_ids: string[]; rationale: string }
      return { ids: a.exercise_ids, rationale: a.rationale, valid: true, usedFallback: false, raw: JSON.stringify(raws), errors }
    }
    errors.push(`attempt ${attempt + 1}: ${v.errors.join('; ')}`)
    feedback = `Your previous answer was rejected: ${v.errors.join('; ')}. Choose only ids from the candidate list, keep within the time budget, and do not state loads.`
  }
  return { ids: opts.engineIds, valid: false, usedFallback: true, raw: JSON.stringify(raws), errors }
}
