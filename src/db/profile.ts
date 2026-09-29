import { z } from 'zod'
import { BODY_AREAS, type CoachProfile } from '../engine/types'
import { db } from './schema'

// The coach profile (setup answers), stored in the settings table and validated on read.

export const profileSchema = z.object({
  goal: z.enum(['strength', 'muscle', 'fitness']),
  weeklyAim: z.number().int().min(1).max(7).nullable(),
  typicalMinutes: z.number().int().min(10).max(180),
  baselines: z.record(z.string(), z.object({ kg: z.number().positive(), reps: z.number().int().min(1).max(30) })),
  pullUps: z.number().int().min(0).nullable(),
  avoidAreas: z.array(z.enum(BODY_AREAS)),
  avoidNote: z.string(),
  running: z.object({ runs: z.boolean(), longestKm: z.number().min(0), perWeek: z.number().int().min(0).max(14) }),
  note: z.string(),
  /** Locations the user trains at (ids from the locations table). */
  locationIds: z.array(z.string()),
  completedAt: z.number(),
})

export type StoredProfile = z.infer<typeof profileSchema> & CoachProfile

export const DEFAULT_PROFILE: StoredProfile = {
  goal: 'strength',
  weeklyAim: 3,
  typicalMinutes: 45,
  baselines: {},
  pullUps: null,
  avoidAreas: [],
  avoidNote: '',
  running: { runs: true, longestKm: 5, perWeek: 1 },
  note: '',
  locationIds: ['loc-gym'],
  completedAt: 0,
}

export async function getProfile(): Promise<StoredProfile | undefined> {
  const raw = (await db.settings.get('coachProfile'))?.value
  const parsed = profileSchema.safeParse(raw)
  return parsed.success ? (parsed.data as StoredProfile) : undefined
}

export async function saveProfile(p: StoredProfile): Promise<void> {
  await db.settings.put({ key: 'coachProfile', value: profileSchema.parse(p) })
}
