import Dexie, { type EntityTable } from 'dexie'
import type { Exercise, Progression, SetRecord } from '../engine/types'

export const SCHEMA_VERSION = 1

export interface Session {
  id: string
  status: 'active' | 'finished'
  startedAt: number
  finishedAt?: number
  feel?: 'too_easy' | 'about_right' | 'too_hard'
  notes: string
  calibration: boolean
  /** How the session was built: coach strength/calisthenics, or a free session. */
  kind?: 'strength' | 'calisthenics' | 'free'
  suggestionId?: string
  /** Rest timer lives in the DB so it survives a killed app. */
  restEndsAt?: number
  restTotalSec?: number
  createdAt: number
  updatedAt: number
}

export interface SessionExercise {
  id: string
  sessionId: string
  exerciseId: string
  order: number
  why?: string
  swappedFrom?: string
  /** Rules that produced this exercise's targets (coach sessions). */
  ruleIds?: string[]
  /** R15: the next set's load is re-suggested after each confirmed set. */
  calibrating?: boolean
}

export interface Location {
  id: string
  name: string
  equipment: string[]
}

export interface Setting {
  key: string
  value: unknown
}

// Tables for later phases. Declared now so Phase 2 to 4 need no disruptive migration.
export interface Checkin {
  id: string
  createdAt: number
  /** What the user chose: 'recommended' or a deviation. */
  trainingType: string
  /** The focus the plan was built for, and what the coach recommended. */
  focus?: string
  recommended?: string
  reasons?: string[]
  minutes: number
  energy: number
  pain: { area: string; score: number }[]
  locationId?: string
}
/** A stored engine candidate. The exercise is looked up by id when loaded. */
export interface StoredCandidate {
  id: string
  role: 'main' | 'accessory' | 'core'
  baseScore: number
  target: import('../engine/types').Target
  marks: string[]
  estMinutes: number
}
export interface CandidateList {
  id: string
  checkinId: string
  engineVersion: string
  items: StoredCandidate[]
  createdAt: number
}
export interface Suggestion {
  id: string
  checkinId: string
  candidatesId?: string
  /** 'engine' when built without the AI. */
  model: string
  rawJson: string
  valid: boolean
  usedFallback: boolean
  /** Chosen candidate ids in order, and the rationale shown on the preview. */
  ids: string[]
  rationale: string
  minutes: number
  run?: import('../engine/run').RunSuggestion
  reason?: string
  createdAt: number
}
export interface Run {
  id: string
  suggestionId?: string
  date: number
  distanceKm: number
  durationSec: number
  runType: 'easy' | 'hard' | 'long'
  rpe?: number
  avgHr?: number
  maxHr?: number
  cadence?: number
  elevationM?: number
  laps?: unknown[]
  notes: string
  source: 'manual' | 'garmin_paste' | 'file'
}
export interface EngineEvent {
  id: string
  date: number
  exerciseId: string
  type: 'progressed' | 'reset' | 'ladder_up' | 'ladder_down' | 'return_reduction'
  ruleId: string
  sessionId?: string
  change?: string
}

export class TrainingDb extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>
  progressions!: EntityTable<Progression, 'id'>
  sessions!: EntityTable<Session, 'id'>
  sessionExercises!: EntityTable<SessionExercise, 'id'>
  sets!: EntityTable<SetRecord, 'id'>
  locations!: EntityTable<Location, 'id'>
  settings!: EntityTable<Setting, 'key'>
  checkins!: EntityTable<Checkin, 'id'>
  candidates!: EntityTable<CandidateList, 'id'>
  suggestions!: EntityTable<Suggestion, 'id'>
  runs!: EntityTable<Run, 'id'>
  events!: EntityTable<EngineEvent, 'id'>

  constructor(name = 'training-log') {
    super(name)
    this.version(SCHEMA_VERSION).stores({
      exercises: 'id, name, pattern',
      progressions: 'id',
      sessions: 'id, status, startedAt',
      sessionExercises: 'id, sessionId, exerciseId',
      sets: 'id, sessionId, sessionExerciseId, exerciseId, completedAt',
      locations: 'id',
      settings: 'key',
      checkins: 'id, createdAt',
      candidates: 'id, checkinId',
      suggestions: 'id, checkinId',
      runs: 'id, date',
      events: 'id, date, exerciseId',
    })
  }
}

export const TABLE_NAMES = [
  'exercises',
  'progressions',
  'sessions',
  'sessionExercises',
  'sets',
  'locations',
  'settings',
  'checkins',
  'candidates',
  'suggestions',
  'runs',
  'events',
] as const
export type TableName = (typeof TABLE_NAMES)[number]

export const db = new TrainingDb()
