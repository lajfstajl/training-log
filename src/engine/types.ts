// Domain types shared by the engine, the database and the UI.
// The engine only depends on these plain shapes, never on Dexie or React.

export type TrackingType = 'weight_reps' | 'bodyweight_reps' | 'timed_hold' | 'run'

// 'isolation' is not in the brief's pattern list; it holds single-joint accessories
// (curls, raises, calf raises) so they do not distort the compound patterns in R5.
export const PATTERNS = [
  'squat',
  'hinge',
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'core',
  'skill',
  'isolation',
] as const
export type Pattern = (typeof PATTERNS)[number]

export const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
] as const
export type Muscle = (typeof MUSCLES)[number]

export const EQUIPMENT = [
  'barbell',
  'rack',
  'bench',
  'dumbbells',
  'cable',
  'machine',
  'pullup_bar',
  'dip_bars',
  'rings',
  'bands',
  'kettlebell',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

export type ProgressionMode = 'load' | 'ladder'

/** RIR is stored as 0..4 where 4 means "4 or more". */
export type Rir = 0 | 1 | 2 | 3 | 4

export interface Exercise {
  id: string
  name: string
  trackingType: TrackingType
  pattern: Pattern
  primaryMuscles: Muscle[]
  secondaryMuscles: Muscle[]
  /** Everything the exercise needs. */
  equipment: Equipment[]
  /** Optional alternative set that works instead, e.g. rings instead of a pull-up bar. */
  equipmentAlt?: Equipment[]
  /** Reps for rep work, seconds for timed holds. */
  rangeMin: number
  rangeMax: number
  targetRir: Rir
  /** kg added when progressing load. */
  increment: number
  progressionMode: ProgressionMode
  progressionId?: string
  progressionStep?: number
  isMainLift: boolean
  unilateral: boolean
  defaultRestSec: number
  defaultWorkingSets: number
  archived: boolean
  createdAt: number
  updatedAt: number
}

export interface ProgressionStep {
  exerciseId: string
  rangeMin: number
  rangeMax: number
}

export interface Progression {
  id: string
  name: string
  steps: ProgressionStep[]
}

/** Where a set's target came from. Phase 2 adds 'engine'. */
export type PlannedFrom = 'engine' | 'history' | 'default' | 'manual'

export interface SetRecord {
  id: string
  sessionId: string
  sessionExerciseId: string
  exerciseId: string
  order: number
  isWarmup: boolean
  // Target (planned). Never overwritten by what was actually done.
  // kg means load for weight_reps, and added load for bodyweight and holds (negative = assisted).
  targetKg?: number
  targetReps?: number
  targetSec?: number
  targetRir?: Rir
  plannedFrom: PlannedFrom
  ruleIds?: string[]
  // Actual. Undefined until the user edits or confirms.
  kg?: number
  reps?: number
  seconds?: number
  rir?: Rir
  note: string
  /** A set only counts once confirmed. */
  completedAt?: number
  createdAt: number
  updatedAt: number
}

// ---------- Coach, history and planning types ----------

export const BODY_AREAS = ['shoulder', 'elbow', 'wrist', 'neck', 'upper_back', 'lower_back', 'hip', 'knee', 'ankle'] as const
export type BodyArea = (typeof BODY_AREAS)[number]

export type RunType = 'easy' | 'hard' | 'long'

/** Setup answers. Loose by design: aims and facts, never a schedule. */
export interface CoachProfile {
  goal: 'strength' | 'muscle' | 'fitness'
  /** Soft sessions-per-week aim including runs. null = "it varies" (treated as config default). */
  weeklyAim: number | null
  typicalMinutes: number
  /** Recent working set per main lift (exerciseId → kg × reps). Missing = "not sure". */
  baselines: Record<string, { kg: number; reps: number }>
  /** Strict pull-ups in a row, used to place the pull-up ladder. null = not sure. */
  pullUps: number | null
  avoidAreas: BodyArea[]
  avoidNote: string
  running: { runs: boolean; longestKm: number; perWeek: number }
  note: string
}

/** One exercise in one finished session: its confirmed working sets. */
export interface Exposure {
  exerciseId: string
  sessionId: string
  date: number
  sets: LoggedSet[]
}

export interface RunRecord {
  date: number
  distanceKm: number
  durationSec: number
  runType: RunType
}

export interface SessionRecord {
  date: number
  kind: 'strength' | 'calisthenics' | 'free'
}

export interface TrainingHistory {
  exposures: Exposure[]
  runs: RunRecord[]
  sessions: SessionRecord[]
}

export interface PainReport {
  area: BodyArea
  score: number
}

export type Focus = 'strength' | 'calisthenics' | 'run_easy' | 'run_hard' | 'run_long'

export type EngineEventType = 'progressed' | 'reset' | 'ladder_up' | 'ladder_down' | 'return_reduction'

/** A planned working set from the engine. */
export interface TargetSet {
  targetKg?: number
  targetReps?: number
  targetSec?: number
  targetRir: Rir
}

/** The engine's next target for one exercise, with its reasons. */
export interface Target {
  exerciseId: string
  sets: TargetSet[]
  ruleIds: string[]
  why: string
  calibrating: boolean
  event?: EngineEventType
  /** Short phrase for the finish summary, e.g. "+2.5 kg" or "reset to 72.5 kg". */
  change?: string
}

/** Minimal set shape the pure functions need. */
export interface LoggedSet {
  exerciseId: string
  isWarmup: boolean
  kg?: number
  reps?: number
  seconds?: number
  rir?: Rir
  completedAt?: number
}
