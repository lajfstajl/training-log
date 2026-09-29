import { describe, expect, it } from 'vitest'
import { liftingShare, recommendFocus } from '../../src/engine/focus'
import { planToday } from '../../src/engine/plan'
import { nextSetLoad, nextTarget } from '../../src/engine/progression'
import { suggestRun } from '../../src/engine/run'
import { BY_ID, EXERCISES, GYM, HOME, NOW, PROGRESSIONS, ex, exposure, history, profile, run, same } from './helpers'

// Scenario fixtures with expected engine outputs. Numbers here are the contract of the coaching rules:
// a rule change must update docs/coaching-methods.md, config.ts and these fixtures together.

const plan = (over: Partial<Parameters<typeof planToday>[0]> = {}) =>
  planToday({
    now: NOW,
    history: history(),
    profile: profile(),
    exercises: EXERCISES,
    progressions: PROGRESSIONS,
    equipment: GYM,
    minutes: 60,
    energy: 3,
    pain: [],
    ...over,
  })

describe('brief scenarios', () => {
  it('1. new user in calibration week one: conservative, open loads, 3+ left', () => {
    const p = plan()
    expect(p.focus).toBe('strength')
    expect(p.recommendation.ruleIds).toContain('R15')
    const mains = p.session.filter((c) => c.role === 'main')
    expect(mains).toHaveLength(2)
    for (const m of mains) {
      expect(m.target.calibrating).toBe(true)
      expect(m.target.sets[0].targetKg).toBeUndefined()
      expect(m.target.sets[0].targetRir).toBeGreaterThanOrEqual(3)
      expect(m.target.why).toMatch(/First time/)
    }
  })

  it('1b. a setup baseline gives a rounded, conservative first load (100 kg × 5 → 95 kg × 3 @ 3 left)', () => {
    const t = nextTarget(ex('back-squat'), [], { now: NOW, baseline: { kg: 100, reps: 5 } })
    expect(t.sets[0]).toMatchObject({ targetKg: 95, targetReps: 3, targetRir: 3 })
    expect(t.ruleIds).toEqual(expect.arrayContaining(['R15', 'R6']))
  })

  it('2. all sets at the top of the range at target effort → load increases', () => {
    const t = nextTarget(ex('bench-press'), [exposure('bench-press', 5, same(3, 80, 5, 2)), exposure('bench-press', 2, same(3, 80, 6, 2))], {
      now: NOW,
    })
    expect(t.sets[0]).toMatchObject({ targetKg: 82.5, targetReps: 3 })
    expect(t.event).toBe('progressed')
    expect(t.ruleIds).toContain('R2')
    expect(t.why).toMatch(/^\+2\.5 kg/)
  })

  it('3. two stalled exposures → reset about 10%', () => {
    const t = nextTarget(ex('back-squat'), [exposure('back-squat', 6, same(3, 100, 2, 0)), exposure('back-squat', 3, same(3, 100, 2, 0))], {
      now: NOW,
    })
    expect(t.sets[0]).toMatchObject({ targetKg: 90, targetReps: 3 })
    expect(t.event).toBe('reset')
    expect(t.why).toMatch(/Reset/)
  })

  it('4. back from 14 days off → about 10% lighter', () => {
    const exps = [exposure('bench-press', 18, same(3, 80, 4, 2)), exposure('bench-press', 14, same(3, 80, 4, 2))]
    const t = nextTarget(ex('bench-press'), exps, { now: NOW })
    expect(t.sets[0].targetKg).toBe(70) // 80 × 0.9 = 72 → rounded down to the 2.5 kg step
    expect(t.ruleIds).toContain('R12')
    expect(t.event).toBe('return_reduction')
    expect(recommendFocus({ now: NOW, history: history(exps), profile: profile(), exercises: BY_ID, equipment: GYM }).reasons[0]).toMatch(
      /14 days/,
    )
  })

  it('5. low energy → fewer sets and at least 2 left', () => {
    const normal = plan()
    const low = plan({ energy: 2 })
    const n = normal.candidates.find((c) => c.role === 'main')!
    const l = low.candidates.find((c) => c.id === n.id)!
    expect(l.target.sets.length).toBe(2)
    expect(n.target.sets.length).toBe(3)
    expect(l.target.sets.every((s) => s.targetRir >= 2)).toBe(true)
    expect(l.target.ruleIds).toContain('R13')
  })

  it('6. shoulder 6/10 → pressing lighter, one set fewer, marked; 5/10 changes nothing', () => {
    const h = history([exposure('bench-press', 6, same(3, 80, 5, 2)), exposure('bench-press', 3, same(3, 80, 5, 2))])
    const base = plan({ history: h }).candidates
    const sore = plan({ history: h, pain: [{ area: 'shoulder', score: 6 }] }).candidates
    const five = plan({ history: h, pain: [{ area: 'shoulder', score: 5 }] }).candidates
    const pressing = sore.filter((c) => ['horizontal_push', 'vertical_push'].includes(c.exercise.pattern))
    expect(pressing.length).toBeGreaterThan(0)
    for (const c of pressing) {
      expect(c.marks[0]).toMatch(/Shoulder 6\/10/)
      expect(c.target.ruleIds).toContain('R14')
      const before = base.find((b) => b.id === c.id)!
      expect(c.target.sets.length).toBe(Math.max(1, before.target.sets.length - 1))
    }
    const bench = sore.find((c) => c.id === 'bench-press')
    if (bench) expect(bench.target.sets[0].targetKg).toBe(62.5) // 80 aim → ×0.8 = 64 → 62.5
    expect(five.every((c) => c.marks.length === 0)).toBe(true)
  })

  it('7. longest run in 30 days is 10 km → no suggested run above 11 km (older runs ignored)', () => {
    const h = history([], [run(40, 15), run(12, 10), run(4, 6)])
    for (const type of ['easy', 'hard', 'long'] as const) {
      const r = suggestRun({ now: NOW, history: h, profile: profile({ running: { runs: true, longestKm: 20, perWeek: 2 } }), exercises: BY_ID, type, minutes: 60 })
      expect(r.maxKm).toBe(11)
      expect(r.ruleIds).toContain('R9')
    }
  })

  it('8. heavy squat yesterday → no hard run today', () => {
    const h = history([exposure('back-squat', 1, same(3, 100, 5, 2))], [run(5, 6)])
    const r = suggestRun({ now: NOW, history: h, profile: profile({ running: { runs: true, longestKm: 8, perWeek: 2 } }), exercises: BY_ID, type: 'hard', minutes: 45 })
    expect(r.type).toBe('easy')
    expect(r.ruleIds).toContain('R11')
  })

  it('9. chest at 3 fractional sets, back at 14 → chest work prioritised', () => {
    const h = history([
      exposure('barbell-row', 2, same(7, 60, 8, 2)),
      exposure('lat-pulldown', 2, same(7, 50, 10, 2)),
      exposure('bench-press', 2, same(3, 80, 5, 2)),
    ])
    const p = plan({ history: h })
    const accessories = p.session.filter((c) => c.role === 'accessory')
    // Legs (0 sets) may come first; the scenario is chest (3) versus back (14).
    expect(accessories.some((c) => c.exercise.primaryMuscles.includes('chest'))).toBe(true)
    expect(accessories.every((c) => !c.exercise.primaryMuscles.includes('back'))).toBe(true)
    const rank = (m: string) => p.candidates.findIndex((c) => c.role === 'accessory' && c.exercise.primaryMuscles.includes(m as never))
    expect(rank('chest')).toBeLessThan(rank('back'))
  })
})

describe('coach scenarios (R16 and friends)', () => {
  const runner = profile({ running: { runs: true, longestKm: 8, perWeek: 2 } })

  it('a run is recommended when due and strength was done yesterday', () => {
    const h = history([exposure('back-squat', 2, same(3, 100, 5, 2)), exposure('bench-press', 1, same(3, 80, 5, 2))], [run(5, 6)])
    const r = recommendFocus({ now: NOW, history: h, profile: runner, exercises: BY_ID, equipment: GYM })
    expect(r.focus.startsWith('run')).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/Last run 5 days ago/)
  })

  it('strength first: lifting keeps at least half the weekly aim, runs fill the rest', () => {
    expect(liftingShare(profile({ weeklyAim: 3, running: { runs: true, longestKm: 8, perWeek: 2 } }))).toBe(2)
    expect(liftingShare(profile({ weeklyAim: 4, running: { runs: true, longestKm: 8, perWeek: 1 } }))).toBe(3)
    expect(liftingShare(profile({ weeklyAim: 2, running: { runs: true, longestKm: 8, perWeek: 3 } }))).toBe(1)
    // One lift 3 days ago, run due: with aim 3 / 2 runs, strength (share 2) is not yet met → lift today.
    const h = history([exposure('bench-press', 3, same(3, 80, 5, 2))], [run(6, 6)])
    expect(recommendFocus({ now: NOW, history: h, profile: runner, exercises: BY_ID, equipment: GYM }).focus).toBe('strength')
  })

  it('the user can deviate: choosing strength on a run day still builds a full session', () => {
    const h = history([exposure('bench-press', 1, same(3, 80, 5, 2))], [run(5, 6)])
    const p = plan({ history: h, profile: runner, focus: 'strength' })
    expect(p.focus).toBe('strength')
    expect(p.session.filter((c) => c.role === 'main').length).toBe(2)
    const r = plan({ history: h, profile: runner, focus: 'run' })
    expect(r.run).toBeDefined()
  })

  it('9 days off → welcome back, full-body strength', () => {
    const r = recommendFocus({ now: NOW, history: history([exposure('deadlift', 9, same(3, 140, 5, 2))]), profile: profile(), exercises: BY_ID, equipment: GYM })
    expect(r.focus).toBe('strength')
    expect(r.reasons[0]).toMatch(/9 days/)
    expect(r.ruleIds).toContain('R12')
  })

  it('home location → calisthenics with the current ladder steps', () => {
    const p = plan({ equipment: HOME, profile: profile({ pullUps: 3 }) })
    expect(p.focus).toBe('calisthenics')
    expect(p.session.every((c) => c.exercise.trackingType !== 'weight_reps')).toBe(true)
    const ids = p.candidates.map((c) => c.id)
    expect(ids).toContain('pull-up-band') // 3 pull-ups → band-assisted step
    expect(ids).not.toContain('pull-up')
  })

  it('busy-life cap: even with 75 minutes, at most 2 heavy + 3 accessories + 1 core', () => {
    const p = plan({ minutes: 75 })
    expect(p.session.filter((c) => c.role === 'main').length).toBeLessThanOrEqual(2)
    expect(p.session.filter((c) => c.role === 'accessory').length).toBeLessThanOrEqual(3)
    expect(p.session.filter((c) => c.role === 'core').length).toBeLessThanOrEqual(1)
    expect(p.session.find((c) => c.role === 'core')?.exercise.pattern).toBe('core')
  })

  it('20 minutes → one heavy lift and the session fits the budget', () => {
    const p = plan({ minutes: 20 })
    expect(p.session.filter((c) => c.role === 'main')).toHaveLength(1)
    expect(p.session.reduce((s, c) => s + c.estMinutes, 5)).toBeLessThanOrEqual(20)
  })

  it('heavy patterns rotate: yesterday’s squat and bench are not heavy again today', () => {
    const h = history([exposure('back-squat', 1, same(3, 100, 5, 2)), exposure('bench-press', 1, same(3, 80, 5, 2))])
    const p = plan({ history: h })
    const mains = p.session.filter((c) => c.role === 'main').map((c) => c.exercise.pattern)
    expect(mains).not.toContain('squat')
    expect(mains).not.toContain('horizontal_push')
    expect(mains).toContain('hinge')
  })

  it('a hard run yesterday → no heavy legs today (R11)', () => {
    const h = history([exposure('bench-press', 3, same(3, 80, 5, 2))], [run(1, 8, 'hard')])
    const p = plan({ history: h, profile: runner, focus: 'strength' })
    const patterns = p.session.filter((c) => c.role === 'main').map((c) => c.exercise.pattern)
    expect(patterns).not.toContain('squat')
    expect(patterns).not.toContain('hinge')
  })

  it('ladder: all sets at the top of the range → next step (R8)', () => {
    const t = nextTarget(ex('pull-up-band'), [exposure('pull-up-band', 4, same(3, 0, 12, 1)), exposure('pull-up-band', 1, same(3, 0, 12, 1))], {
      now: NOW,
      ladder: { prev: ex('pull-up-negative'), next: ex('pull-up') },
    })
    expect(t.exerciseId).toBe('pull-up')
    expect(t.event).toBe('ladder_up')
    expect(t.sets[0].targetReps).toBe(5)
  })

  it('in-session calibration: the next set’s load follows from reps and reps left', () => {
    // 80 kg × 3 with 4+ left → estimated max 98.7 → 3 reps with 3 left ≈ 82.2 → 82.5 kg
    expect(nextSetLoad(ex('back-squat'), { kg: 80, reps: 3, rir: 4 }, 3, 3)).toBe(82.5)
  })

  it('same weight until the top of the range: aim for one more rep', () => {
    const t = nextTarget(ex('bench-press'), [exposure('bench-press', 6, same(3, 80, 4, 2)), exposure('bench-press', 3, [[80, 5, 2], [80, 4, 2], [80, 4, 1]])], {
      now: NOW,
    })
    expect(t.sets[0]).toMatchObject({ targetKg: 80, targetReps: 5 })
    expect(t.event).toBeUndefined()
  })
})
