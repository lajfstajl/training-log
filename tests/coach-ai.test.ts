import { describe, expect, it } from 'vitest'
import { chooseWithAi } from '../src/coach/orchestrate'
import { buildUserMessage } from '../src/coach/prompt'
import { validateSelection } from '../src/coach/validate'
import { planToday } from '../src/engine/plan'
import { BY_ID, EXERCISES, GYM, NOW, PROGRESSIONS, history, profile } from './fixtures/helpers'

// The AI never supplies numbers: these tests feed fixed candidates and mocked AI answers and check
// that only valid selections get through, with the engine's plan as the fallback.

const plan = planToday({ now: NOW, history: history(), profile: profile(), exercises: EXERCISES, progressions: PROGRESSIONS, equipment: GYM, minutes: 60, energy: 3, pain: [] })
const cands = plan.candidates
const engineIds = plan.session.map((c) => c.id)
const main = cands.find((c) => c.role === 'main')!.id
const acc = cands.filter((c) => c.role === 'accessory').map((c) => c.id)
const good = { exercise_ids: [main, acc[0], acc[1]], rationale: 'Legs first while you are fresh, then upper back that is low this week.' }

const mock = (...answers: unknown[]) => {
  let i = 0
  const calls: (string | undefined)[] = []
  const call = async (feedback?: string) => {
    calls.push(feedback)
    const a = answers[Math.min(i++, answers.length - 1)]
    if (a instanceof Error) throw a
    return a
  }
  return { call, calls }
}

describe('validateSelection', () => {
  it('accepts a selection from the candidates that fits the time', () => {
    expect(validateSelection(good, cands, 60, 'strength')).toEqual({ ok: true, errors: [] })
  })
  it('rejects invented exercises, duplicates, no heavy lift, over time, loads in the text, bad shape', () => {
    expect(validateSelection({ ...good, exercise_ids: [main, 'magic-press'] }, cands, 60, 'strength').errors[0]).toMatch(/not in the candidate list/)
    expect(validateSelection({ ...good, exercise_ids: [main, main] }, cands, 60, 'strength').errors).toContain('duplicate exercises')
    expect(validateSelection({ ...good, exercise_ids: [acc[0]] }, cands, 60, 'strength').errors).toContain('no heavy lift chosen')
    expect(validateSelection({ ...good, exercise_ids: cands.slice(0, 8).map((c) => c.id) }, cands, 20, 'strength').errors.join()).toMatch(/too long/)
    expect(validateSelection({ ...good, rationale: 'Squat 100 kg today, you have got this.' }, cands, 60, 'strength').errors).toContain('rationale states a load')
    expect(validateSelection({ ids: [main] }, cands, 60, 'strength').ok).toBe(false)
    expect(validateSelection(null, cands, 60, 'strength').ok).toBe(false)
  })
})

describe('chooseWithAi', () => {
  const run = (call: (f?: string) => Promise<unknown>) => chooseWithAi({ call, candidates: cands, engineIds, minutes: 60, kind: 'strength' })

  it('uses a valid AI answer as is', async () => {
    const { call } = mock(good)
    const r = await run(call)
    expect(r).toMatchObject({ ids: good.exercise_ids, rationale: good.rationale, valid: true, usedFallback: false })
  })

  it('retries once with the errors as feedback, then succeeds', async () => {
    const { call, calls } = mock({ ...good, exercise_ids: ['made-up'] }, good)
    const r = await run(call)
    expect(r.valid).toBe(true)
    expect(calls[1]).toMatch(/rejected: not in the candidate list/)
  })

  it('falls back to the engine after two invalid answers', async () => {
    const { call } = mock({ nonsense: true }, { ...good, exercise_ids: [main, main] })
    const r = await run(call)
    expect(r).toMatchObject({ ids: engineIds, valid: false, usedFallback: true })
    expect(r.errors).toHaveLength(2)
  })

  it('falls back immediately on a network or API error', async () => {
    const { call, calls } = mock(new Error('offline'))
    const r = await run(call)
    expect(r.usedFallback).toBe(true)
    expect(calls).toHaveLength(1)
  })

  it('whatever the AI answers, targets come from the engine by id', async () => {
    const { call } = mock({ ...good, exercise_ids: [main] })
    const r = await run(call)
    const picked = r.ids.map((id) => cands.find((c) => c.id === id)!)
    expect(picked[0].target).toBe(cands.find((c) => c.id === main)!.target)
  })
})

describe('prompt', () => {
  it('contains the candidates with ids and targets, and the time budget', () => {
    const msg = buildUserMessage({
      now: NOW,
      choice: 'recommended',
      focus: 'strength',
      minutes: 60,
      energy: 3,
      pain: [],
      profile: profile({ note: 'prefer dumbbells' }),
      history: history(),
      exercises: BY_ID,
      weekVolume: { chest: 0, back: 0, shoulders: 0, biceps: 0, triceps: 0, quads: 0, hamstrings: 0, glutes: 0, calves: 0, core: 0 },
      reasons: ['First session'],
      candidates: cands,
      engineIds,
    })
    const json = JSON.parse(msg.slice(msg.indexOf('{')))
    expect(json.checkin.time_budget_min).toBe(60)
    expect(json.candidates[0]).toMatchObject({ id: cands[0].id, role: cands[0].role })
    expect(json.athlete.notes).toBe('prefer dumbbells')
    expect(json.engine_default_pick).toEqual(engineIds)
  })
})
