import { z } from 'zod'
import type { Candidate } from '../engine/candidates'
import { sessionMinutes } from '../engine/select'

// The AI's answer shape. It contains no numbers at all: only which candidates, in what order,
// and a short explanation. Targets are copied from the engine by id.

export const aiSelectionSchema = z.object({
  exercise_ids: z.array(z.string()).min(1).max(10),
  rationale: z.string().min(10).max(700),
})
export type AiSelection = z.infer<typeof aiSelectionSchema>

export interface Validation {
  ok: boolean
  errors: string[]
}

/** Checks an AI selection against the engine's candidates and the time budget. */
export function validateSelection(sel: unknown, candidates: Candidate[], minutes: number, kind: 'strength' | 'calisthenics'): Validation {
  const parsed = aiSelectionSchema.safeParse(sel)
  if (!parsed.success) return { ok: false, errors: [`shape: ${parsed.error.issues[0]?.message ?? 'invalid'}`] }
  const { exercise_ids: ids, rationale } = parsed.data
  const byId = new Map(candidates.map((c) => [c.id, c]))
  const errors: string[] = []

  const unknown = ids.filter((id) => !byId.has(id))
  if (unknown.length) errors.push(`not in the candidate list: ${unknown.join(', ')}`)
  if (new Set(ids).size !== ids.length) errors.push('duplicate exercises')
  const chosen = ids.map((id) => byId.get(id)).filter((c): c is Candidate => !!c)
  if (kind === 'strength' && !chosen.some((c) => c.role === 'main')) errors.push('no heavy lift chosen')
  const total = sessionMinutes(chosen)
  if (total > minutes * 1.1 + 1) errors.push(`too long: about ${Math.round(total)} min for ${minutes}`)
  // The rationale must not state loads: numbers are the engine's and shown next to each exercise.
  if (/\d\s*kg\b/i.test(rationale)) errors.push('rationale states a load')
  return { ok: errors.length === 0, errors }
}
