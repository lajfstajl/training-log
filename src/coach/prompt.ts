import type { Candidate } from '../engine/candidates'
import type { CoachProfile, Exercise, PainReport, TrainingHistory } from '../engine/types'
import type { MuscleVolume } from '../engine/volume'
import { fmtSet } from '../lib/format'

// Stable system prompt (cacheable) + a compact JSON context per request.

export const SYSTEM_PROMPT = `You are a strength coach inside a personal training app. The app's rules engine has already computed a list of candidate exercises for today, each with exact targets (sets, load, reps or seconds, and reps left in reserve) and the reason behind them. Your job is to choose and order today's session from that list, and explain it briefly.

How to choose:
- Pick only candidates from the list, by their "id". Never invent exercises.
- For a strength or calisthenics session, include at least one candidate with role "main" and put mains first, while the athlete is fresh.
- Stay within the time budget: 5 minutes of general warm-up plus the sum of est_min of your picks must not exceed time_budget_min.
- Prefer candidates that close the gaps in week_volume (muscles below the target range), avoid piling onto muscles already near the top of the range, and keep the session varied across movement patterns.
- Respect the athlete's notes and today's check-in (time, energy, pain). Candidates marked for pain are already made lighter; include them only if it makes sense and say they can decide.
- The engine's default pick is a good baseline. Change it only when the notes, preferences or context give a reason.

How to explain (the "rationale"):
- Two or three short sentences, in plain English, speaking to the athlete as "you".
- Say why this session today: what was trained recently, what is due, what is low this week. Be concrete but brief.
- Do not state loads, weights or rep numbers. They are shown next to each exercise and come from the engine.
- No medical advice or diagnosis. No hype, no emojis.`

export interface CoachContext {
  now: number
  choice: string
  focus: string
  minutes: number
  energy: number
  pain: PainReport[]
  profile: CoachProfile
  history: TrainingHistory
  exercises: Map<string, Exercise>
  weekVolume: MuscleVolume
  reasons: string[]
  candidates: Candidate[]
  engineIds: string[]
  /** Free-text request when regenerating ("more dumbbells", "knee is sore"). */
  request?: string
  previousIds?: string[]
}

const DAY = 86_400_000
const dayLabel = (ts: number) => new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

/** Last 14 days as short lines, newest first. */
function recentLines(ctx: CoachContext): string[] {
  const from = ctx.now - 14 * DAY
  const bySession = new Map<string, { date: number; parts: string[] }>()
  for (const e of ctx.history.exposures.filter((x) => x.date >= from)) {
    const ex = ctx.exercises.get(e.exerciseId)
    if (!ex) continue
    const s = bySession.get(e.sessionId) ?? { date: e.date, parts: [] }
    const top = e.sets[0]
    s.parts.push(`${ex.name} ${e.sets.length}× ${top ? fmtSet(ex.trackingType, top) : ''}`)
    bySession.set(e.sessionId, s)
  }
  const lines = [...bySession.values()].map((s) => ({ date: s.date, text: `${dayLabel(s.date)}: ${s.parts.join('; ')}` }))
  for (const r of ctx.history.runs.filter((x) => x.date >= from)) {
    lines.push({ date: r.date, text: `${dayLabel(r.date)}: ${r.runType} run ${r.distanceKm} km` })
  }
  return lines.sort((a, b) => b.date - a.date).map((l) => l.text)
}

export function buildUserMessage(ctx: CoachContext, feedback?: string): string {
  const input = {
    today: dayLabel(ctx.now),
    checkin: { chosen: ctx.choice, focus: ctx.focus, time_budget_min: ctx.minutes, energy_1_to_5: ctx.energy, pain_0_to_10: ctx.pain },
    athlete: {
      goal: ctx.profile.goal,
      sessions_per_week_aim: ctx.profile.weeklyAim ?? 'varies',
      avoid_areas: ctx.profile.avoidAreas,
      notes: [ctx.profile.note, ctx.profile.avoidNote].filter(Boolean).join(' | ') || undefined,
    },
    why_this_focus: ctx.reasons,
    recent_training: recentLines(ctx),
    week_volume: { sets_per_muscle: ctx.weekVolume, target_range: '8-16' },
    candidates: ctx.candidates.map((c) => {
      const s = c.target.sets[0]
      return {
        id: c.id,
        name: c.exercise.name,
        role: c.role,
        pattern: c.exercise.pattern,
        muscles: { direct: c.exercise.primaryMuscles, indirect: c.exercise.secondaryMuscles },
        target: `${c.target.sets.length} × ${fmtSet(c.exercise.trackingType, { kg: s?.targetKg, reps: s?.targetReps, seconds: s?.targetSec, rir: s?.targetRir })}`,
        est_min: c.estMinutes,
        why: c.target.why,
        marks: c.marks.length ? c.marks : undefined,
        equipment: c.exercise.equipment,
      }
    }),
    engine_default_pick: ctx.engineIds,
    previous_pick: ctx.previousIds,
    athlete_request: ctx.request,
  }
  const ask = ctx.request
    ? 'The athlete asked for a change (athlete_request). Re-choose from the candidates to meet it where the list allows, and say briefly what changed.'
    : 'Choose and order today’s session from the candidates.'
  return `${ask}\n\n${JSON.stringify(input)}${feedback ? `\n\n${feedback}` : ''}`
}
