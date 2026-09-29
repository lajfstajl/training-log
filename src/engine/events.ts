import { config } from './config'
import { exposuresOf } from './history'
import { nextTarget } from './progression'
import type { EngineEventType, Exercise, Progression, TrainingHistory } from './types'

// After a session: what the engine will do next time for each exercise (progressions, resets,
// ladder moves). Shown on the finish summary and stored in the events log.

export interface NextTimeChange {
  exerciseId: string
  name: string
  event: EngineEventType
  change: string
  ruleIds: string[]
}

export function nextTimeChanges(input: {
  exerciseIds: string[]
  exercises: Exercise[]
  progressions: Progression[]
  history: TrainingHistory
  now: number
  cfg?: typeof config
}): NextTimeChange[] {
  const byId = new Map(input.exercises.map((e) => [e.id, e]))
  const out: NextTimeChange[] = []
  for (const id of [...new Set(input.exerciseIds)]) {
    const ex = byId.get(id)
    if (!ex) continue
    const p = input.progressions.find((x) => x.steps.some((s) => s.exerciseId === id))
    const i = p ? p.steps.findIndex((s) => s.exerciseId === id) : -1
    const ladder = p
      ? {
          prev: i > 0 ? byId.get(p.steps[i - 1].exerciseId) : undefined,
          next: i < p.steps.length - 1 ? byId.get(p.steps[i + 1].exerciseId) : undefined,
          prevExposures: i > 0 ? exposuresOf(input.history, p.steps[i - 1].exerciseId) : [],
        }
      : undefined
    const t = nextTarget(ex, exposuresOf(input.history, id), { now: input.now, ladder, cfg: input.cfg })
    // Only changes earned in this session; a break-related reduction is decided at the next check-in.
    if (t.event && t.change && t.event !== 'return_reduction') {
      out.push({ exerciseId: id, name: ex.name, event: t.event, change: t.change, ruleIds: t.ruleIds })
    }
  }
  return out
}
