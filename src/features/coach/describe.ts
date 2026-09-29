import type { Candidate } from '../../engine/candidates'
import type { Plan } from '../../engine/plan'
import type { Focus } from '../../engine/types'

// Plain-language text for plans, used by the check-in card and as the rationale when there is no AI.

export const CHOICE_LABEL: Record<string, string> = {
  strength: 'strength',
  calisthenics: 'calisthenics',
  run_easy: 'an easy run',
  run_hard: 'a harder run',
  run_long: 'a long run',
  run: 'a run',
}

export const RUN_WORD = { easy: 'Easy run', hard: 'Harder run', long: 'Long run' } as const

export function mainNames(session: Candidate[]): string {
  return session
    .filter((c) => c.role === 'main')
    .map((c) => c.exercise.name.toLowerCase())
    .join(' + ')
}

export function headline(plan: Plan): string {
  if (plan.run) return `${RUN_WORD[plan.run.type]} · up to ${plan.run.maxKm} km`
  const mains = mainNames(plan.session)
  return plan.focus === 'calisthenics' ? `Calisthenics${mains ? ` · ${mains}` : ''}` : `Full-body strength${mains ? ` · heavy ${mains}` : ''}`
}

/** Two or three sentences explaining the plan, built only from engine reasons. */
export function engineRationale(plan: Plan, choice: string): string {
  const rec: Focus = plan.recommendation.focus
  const parts: string[] = []
  const deviated = choice !== 'recommended' && !(choice === 'run' ? rec.startsWith('run') : choice === rec)
  if (deviated) {
    parts.push(
      `You chose ${CHOICE_LABEL[choice] ?? choice} instead of ${CHOICE_LABEL[rec] ?? rec}. That’s fine: I’ll suggest ${rec.startsWith('run') ? 'the run' : 'strength'} again next time.`,
    )
  } else {
    parts.push(...plan.recommendation.reasons.slice(0, 2))
  }
  // A run's details are on the run card; the rationale only explains the choice.
  if (!plan.run && plan.session.length) {
    const acc = plan.session.filter((c) => c.role === 'accessory').length
    const core = plan.session.some((c) => c.role === 'core')
    const rest = [acc ? `${acc} accessor${acc === 1 ? 'y' : 'ies'} for what’s lowest this week` : '', core ? 'core to finish' : '']
      .filter(Boolean)
      .join(', then ')
    parts.push(`Heavy lifts first while you’re fresh${rest ? `, then ${rest}` : ''}.`)
  }
  return parts.join(' ')
}
