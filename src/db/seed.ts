import { config } from '../engine/config'
import type {
  Equipment,
  Exercise,
  Muscle,
  Pattern,
  Progression,
  Rir,
  TrackingType,
} from '../engine/types'
import type { Location, TrainingDb } from './schema'

// Seed exercises have stable ids so seeding is idempotent and fixtures can refer to them.
// Dumbbell loads are logged per dumbbell.

type Kind = 'main' | 'accessory' | 'calisthenics' | 'hold'

interface SeedOpts {
  range?: [number, number]
  rir?: Rir
  increment?: number
  unilateral?: boolean
  ladder?: [string, number]
  rest?: number
  /** Alternative equipment that works instead, e.g. rings for a pull-up bar. */
  alt?: Equipment[]
}

function ex(
  id: string,
  name: string,
  kind: Kind,
  trackingType: TrackingType,
  pattern: Pattern,
  primaryMuscles: Muscle[],
  secondaryMuscles: Muscle[],
  equipment: Equipment[],
  opts: SeedOpts = {},
): Exercise {
  const { r1, r7, logging } = config
  const defaults = {
    main: { range: [r1.main.repMin, r1.main.repMax], rir: r1.main.defaultRir, rest: logging.restSec.main },
    accessory: { range: [r1.accessory.repMin, r1.accessory.repMax], rir: r1.accessory.defaultRir, rest: logging.restSec.accessory },
    calisthenics: { range: [r7.repMin, r7.repMax], rir: r1.accessory.defaultRir, rest: logging.restSec.accessory },
    hold: { range: [r7.holdMinSec, r7.holdMaxSec], rir: r1.accessory.defaultRir, rest: logging.restSec.hold },
  }[kind]
  const [rangeMin, rangeMax] = opts.range ?? defaults.range
  return {
    id,
    name,
    trackingType,
    pattern,
    primaryMuscles,
    secondaryMuscles,
    equipment,
    equipmentAlt: opts.alt,
    rangeMin,
    rangeMax,
    targetRir: opts.rir ?? (defaults.rir as Rir),
    increment: opts.increment ?? 2.5,
    progressionMode: opts.ladder ? 'ladder' : 'load',
    progressionId: opts.ladder?.[0],
    progressionStep: opts.ladder?.[1],
    isMainLift: kind === 'main',
    unilateral: opts.unilateral ?? false,
    defaultRestSec: opts.rest ?? defaults.rest,
    defaultWorkingSets: kind === 'main' ? logging.workingSets.main : logging.workingSets.accessory,
    archived: false,
    createdAt: 0,
    updatedAt: 0,
  }
}

const inc = config.r2.increments

export const SEED_EXERCISES: Exercise[] = [
  // Main lifts (R1: 3 to 6 reps at RIR 1 to 3)
  ex('back-squat', 'Back squat', 'main', 'weight_reps', 'squat', ['quads', 'glutes'], ['hamstrings', 'core'], ['barbell', 'rack'], { increment: inc.lowerBarbell }),
  ex('bench-press', 'Bench press', 'main', 'weight_reps', 'horizontal_push', ['chest'], ['triceps', 'shoulders'], ['barbell', 'rack', 'bench'], { increment: inc.upperBarbell }),
  ex('deadlift', 'Deadlift', 'main', 'weight_reps', 'hinge', ['glutes', 'hamstrings'], ['back', 'quads', 'core'], ['barbell'], { increment: inc.lowerBarbell }),
  ex('overhead-press', 'Overhead press', 'main', 'weight_reps', 'vertical_push', ['shoulders'], ['triceps', 'core'], ['barbell', 'rack'], { increment: inc.upperBarbellSmall }),
  ex('weighted-pull-up', 'Weighted pull-up', 'main', 'bodyweight_reps', 'vertical_pull', ['back'], ['biceps'], ['pullup_bar'], { increment: inc.upperBarbell }),
  ex('weighted-dip', 'Weighted dip', 'main', 'bodyweight_reps', 'horizontal_push', ['chest', 'triceps'], ['shoulders'], ['dip_bars'], { increment: inc.upperBarbell }),

  // Weight accessories (R1: 8 to 12 reps at RIR 0 to 2)
  ex('front-squat', 'Front squat', 'accessory', 'weight_reps', 'squat', ['quads'], ['glutes', 'core'], ['barbell', 'rack'], { range: [6, 10], rir: 2, increment: inc.lowerBarbell }),
  ex('romanian-deadlift', 'Romanian deadlift', 'accessory', 'weight_reps', 'hinge', ['hamstrings', 'glutes'], ['back'], ['barbell'], { range: [6, 10], rir: 2, increment: inc.lowerBarbell }),
  ex('barbell-row', 'Barbell row', 'accessory', 'weight_reps', 'horizontal_pull', ['back'], ['biceps', 'shoulders'], ['barbell'], { range: [6, 10], increment: inc.upperBarbell }),
  ex('incline-db-press', 'Incline dumbbell press', 'accessory', 'weight_reps', 'horizontal_push', ['chest'], ['shoulders', 'triceps'], ['dumbbells', 'bench'], { increment: inc.dumbbell }),
  ex('db-shoulder-press', 'Dumbbell shoulder press', 'accessory', 'weight_reps', 'vertical_push', ['shoulders'], ['triceps'], ['dumbbells', 'bench'], { increment: inc.dumbbell }),
  ex('db-row', 'One-arm dumbbell row', 'accessory', 'weight_reps', 'horizontal_pull', ['back'], ['biceps'], ['dumbbells', 'bench'], { increment: inc.dumbbell, unilateral: true }),
  ex('lat-pulldown', 'Lat pulldown', 'accessory', 'weight_reps', 'vertical_pull', ['back'], ['biceps'], ['cable'], { increment: inc.machine }),
  ex('seated-cable-row', 'Seated cable row', 'accessory', 'weight_reps', 'horizontal_pull', ['back'], ['biceps'], ['cable'], { increment: inc.machine }),
  ex('leg-press', 'Leg press', 'accessory', 'weight_reps', 'squat', ['quads', 'glutes'], [], ['machine'], { increment: inc.machine }),
  ex('bulgarian-split-squat', 'Bulgarian split squat', 'accessory', 'weight_reps', 'squat', ['quads', 'glutes'], ['hamstrings'], ['dumbbells', 'bench'], { increment: inc.dumbbell, unilateral: true }),
  ex('hip-thrust', 'Barbell hip thrust', 'accessory', 'weight_reps', 'hinge', ['glutes'], ['hamstrings'], ['barbell', 'bench'], { increment: inc.lowerBarbell }),
  ex('kb-swing', 'Kettlebell swing', 'accessory', 'weight_reps', 'hinge', ['glutes', 'hamstrings'], ['back', 'core'], ['kettlebell'], { range: [10, 15], increment: 4 }),
  ex('goblet-squat', 'Goblet squat', 'accessory', 'weight_reps', 'squat', ['quads', 'glutes'], ['core'], ['dumbbells'], { increment: inc.dumbbell }),
  ex('leg-curl', 'Leg curl', 'accessory', 'weight_reps', 'isolation', ['hamstrings'], [], ['machine'], { increment: inc.machine }),
  ex('leg-extension', 'Leg extension', 'accessory', 'weight_reps', 'isolation', ['quads'], [], ['machine'], { increment: inc.machine }),
  ex('calf-raise', 'Standing calf raise', 'accessory', 'weight_reps', 'isolation', ['calves'], [], ['machine'], { increment: inc.machine }),
  ex('db-curl', 'Dumbbell curl', 'accessory', 'weight_reps', 'isolation', ['biceps'], [], ['dumbbells'], { increment: inc.dumbbell }),
  ex('triceps-pushdown', 'Triceps pushdown', 'accessory', 'weight_reps', 'isolation', ['triceps'], [], ['cable'], { increment: inc.machine }),
  ex('lateral-raise', 'Lateral raise', 'accessory', 'weight_reps', 'isolation', ['shoulders'], [], ['dumbbells'], { range: [10, 15], increment: 1 }),
  ex('face-pull', 'Face pull', 'accessory', 'weight_reps', 'horizontal_pull', ['shoulders'], ['back'], ['cable'], { range: [10, 15], increment: inc.machine }),
  ex('cable-fly', 'Cable fly', 'accessory', 'weight_reps', 'isolation', ['chest'], ['shoulders'], ['cable'], { increment: inc.machine }),

  // Calisthenics rep work (R7: 5 to 12 reps). Ladder steps per R8.
  ex('pull-up-negative', 'Negative pull-up', 'calisthenics', 'bodyweight_reps', 'vertical_pull', ['back'], ['biceps'], ['pullup_bar'], { range: [3, 6], ladder: ['ladder-pull-up', 0], alt: ['rings'] }),
  ex('pull-up-band', 'Band-assisted pull-up', 'calisthenics', 'bodyweight_reps', 'vertical_pull', ['back'], ['biceps'], ['pullup_bar', 'bands'], { ladder: ['ladder-pull-up', 1] }),
  ex('pull-up', 'Pull-up', 'calisthenics', 'bodyweight_reps', 'vertical_pull', ['back'], ['biceps'], ['pullup_bar'], { ladder: ['ladder-pull-up', 2], alt: ['rings'] }),
  ex('chin-up', 'Chin-up', 'calisthenics', 'bodyweight_reps', 'vertical_pull', ['back', 'biceps'], [], ['pullup_bar'], { alt: ['rings'] }),
  ex('inverted-row', 'Inverted row', 'calisthenics', 'bodyweight_reps', 'horizontal_pull', ['back'], ['biceps'], ['rings'], { range: [8, 15], alt: ['barbell', 'rack'] }),
  ex('push-up-incline', 'Incline push-up', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest'], ['triceps', 'shoulders'], [], { range: [8, 15], ladder: ['ladder-push-up', 0] }),
  ex('push-up', 'Push-up', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest'], ['triceps', 'shoulders'], [], { range: [8, 15], ladder: ['ladder-push-up', 1] }),
  ex('push-up-decline', 'Decline push-up', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest'], ['triceps', 'shoulders'], ['bench'], { range: [8, 15], ladder: ['ladder-push-up', 2] }),
  ex('push-up-archer', 'Archer push-up', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest'], ['triceps', 'shoulders'], [], { ladder: ['ladder-push-up', 3], unilateral: true }),
  ex('dip-band', 'Band-assisted dip', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest', 'triceps'], ['shoulders'], ['dip_bars', 'bands'], { ladder: ['ladder-dip', 0] }),
  ex('dip', 'Dip', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest', 'triceps'], ['shoulders'], ['dip_bars'], { ladder: ['ladder-dip', 1] }),
  ex('ring-dip', 'Ring dip', 'calisthenics', 'bodyweight_reps', 'horizontal_push', ['chest', 'triceps'], ['shoulders'], ['rings'], { ladder: ['ladder-dip', 2] }),
  ex('pike-push-up', 'Pike push-up', 'calisthenics', 'bodyweight_reps', 'vertical_push', ['shoulders'], ['triceps'], []),
  ex('pistol-box', 'Box pistol squat (to a chair)', 'calisthenics', 'bodyweight_reps', 'squat', ['quads', 'glutes'], [], [], { unilateral: true, ladder: ['ladder-pistol', 0] }),
  ex('pistol-assisted', 'Assisted pistol squat (hold rings or a door frame)', 'calisthenics', 'bodyweight_reps', 'squat', ['quads', 'glutes'], [], [], { unilateral: true, ladder: ['ladder-pistol', 1] }),
  ex('pistol-squat', 'Pistol squat', 'calisthenics', 'bodyweight_reps', 'squat', ['quads', 'glutes'], ['core'], [], { range: [3, 8], unilateral: true, ladder: ['ladder-pistol', 2] }),
  ex('hanging-leg-raise', 'Hanging leg raise', 'calisthenics', 'bodyweight_reps', 'core', ['core'], [], ['pullup_bar'], { range: [6, 12], alt: ['rings'] }),

  // Timed holds (R7: build seconds within a range)
  ex('plank', 'Plank', 'hold', 'timed_hold', 'core', ['core'], [], [], { range: [30, 60] }),
  ex('hollow-hold', 'Hollow body hold', 'hold', 'timed_hold', 'core', ['core'], [], []),
  ex('dead-hang', 'Dead hang', 'hold', 'timed_hold', 'skill', [], ['back'], ['pullup_bar'], { range: [20, 60], alt: ['rings'] }),
  ex('l-sit-supported', 'Foot-supported L-sit', 'hold', 'timed_hold', 'skill', ['core'], ['triceps'], ['dip_bars'], { ladder: ['ladder-l-sit', 0], alt: ['rings'] }),
  ex('l-sit-tuck', 'Tuck L-sit', 'hold', 'timed_hold', 'skill', ['core'], ['triceps'], ['dip_bars'], { ladder: ['ladder-l-sit', 1], alt: ['rings'] }),
  ex('l-sit', 'L-sit', 'hold', 'timed_hold', 'skill', ['core'], ['triceps'], ['dip_bars'], { ladder: ['ladder-l-sit', 2], alt: ['rings'] }),
  ex('front-lever-tuck', 'Tuck front lever', 'hold', 'timed_hold', 'skill', ['back', 'core'], [], ['pullup_bar'], { range: [8, 20], ladder: ['ladder-front-lever', 0], alt: ['rings'] }),
  ex('front-lever-adv-tuck', 'Advanced tuck front lever', 'hold', 'timed_hold', 'skill', ['back', 'core'], [], ['pullup_bar'], { range: [8, 20], ladder: ['ladder-front-lever', 1], alt: ['rings'] }),
  ex('front-lever-one-leg', 'One-leg front lever', 'hold', 'timed_hold', 'skill', ['back', 'core'], [], ['pullup_bar'], { range: [5, 15], ladder: ['ladder-front-lever', 2], alt: ['rings'] }),
  ex('front-lever-straddle', 'Straddle front lever', 'hold', 'timed_hold', 'skill', ['back', 'core'], [], ['pullup_bar'], { range: [5, 15], ladder: ['ladder-front-lever', 3], alt: ['rings'] }),
]

function ladder(id: string, name: string, exerciseIds: string[]): Progression {
  const byId = new Map(SEED_EXERCISES.map((e) => [e.id, e]))
  return {
    id,
    name,
    steps: exerciseIds.map((exerciseId) => {
      const e = byId.get(exerciseId)!
      return { exerciseId, rangeMin: e.rangeMin, rangeMax: e.rangeMax }
    }),
  }
}

export const SEED_PROGRESSIONS: Progression[] = [
  ladder('ladder-push-up', 'Push-up', ['push-up-incline', 'push-up', 'push-up-decline', 'push-up-archer']),
  ladder('ladder-pull-up', 'Pull-up', ['pull-up-negative', 'pull-up-band', 'pull-up']),
  ladder('ladder-dip', 'Dip', ['dip-band', 'dip', 'ring-dip']),
  ladder('ladder-l-sit', 'L-sit', ['l-sit-supported', 'l-sit-tuck', 'l-sit']),
  ladder('ladder-front-lever', 'Front lever', ['front-lever-tuck', 'front-lever-adv-tuck', 'front-lever-one-leg', 'front-lever-straddle']),
  ladder('ladder-pistol', 'Pistol squat', ['pistol-box', 'pistol-assisted', 'pistol-squat']),
]

export const SEED_LOCATIONS: Location[] = [
  { id: 'loc-gym', name: 'Gym', equipment: ['barbell', 'rack', 'bench', 'dumbbells', 'cable', 'machine', 'pullup_bar', 'dip_bars', 'kettlebell', 'bands'] },
  { id: 'loc-home', name: 'Home', equipment: ['rings'] },
  { id: 'loc-outdoors', name: 'Outdoors', equipment: [] },
]

/**
 * Adds any seed rows that are missing, and refreshes seed exercises the user has never edited
 * (updatedAt === createdAt) so improvements reach existing installs. Edited rows are left alone,
 * except the alternative-equipment list, which the user cannot edit.
 */
export async function seedIfNeeded(db: TrainingDb, now = Date.now()): Promise<number> {
  return db.transaction('rw', db.exercises, db.progressions, db.locations, async () => {
    const rows = await db.exercises.toArray()
    const existing = new Map(rows.map((r) => [r.id, r]))
    const missing = SEED_EXERCISES.filter((e) => !existing.has(e.id)).map((e) => ({ ...e, createdAt: now, updatedAt: now }))
    await db.exercises.bulkAdd(missing)
    for (const seed of SEED_EXERCISES) {
      const row = existing.get(seed.id)
      if (!row) continue
      const patch: Partial<typeof row> = {}
      if (JSON.stringify(row.equipmentAlt) !== JSON.stringify(seed.equipmentAlt)) patch.equipmentAlt = seed.equipmentAlt
      if (row.updatedAt === row.createdAt) {
        if (row.name !== seed.name) patch.name = seed.name
        if (JSON.stringify(row.equipment) !== JSON.stringify(seed.equipment)) patch.equipment = seed.equipment
      }
      if (Object.keys(patch).length) await db.exercises.update(seed.id, patch)
    }

    const existingP = new Set((await db.progressions.toCollection().primaryKeys()) as string[])
    await db.progressions.bulkAdd(SEED_PROGRESSIONS.filter((p) => !existingP.has(p.id)))

    if ((await db.locations.count()) === 0) await db.locations.bulkAdd(SEED_LOCATIONS)
    return missing.length
  })
}
