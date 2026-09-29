import { z } from 'zod'
import { isoDate } from '../lib/format'
import { db, SCHEMA_VERSION, TABLE_NAMES, type TableName } from './schema'

const row = z.looseObject({ id: z.string() })
const settingRow = z.looseObject({ key: z.string() })

const setRow = z.looseObject({
  id: z.string(),
  sessionId: z.string(),
  sessionExerciseId: z.string(),
  exerciseId: z.string(),
  order: z.number(),
  isWarmup: z.boolean(),
})
const exerciseRow = z.looseObject({
  id: z.string(),
  name: z.string(),
  trackingType: z.enum(['weight_reps', 'bodyweight_reps', 'timed_hold', 'run']),
  pattern: z.string(),
  rangeMin: z.number(),
  rangeMax: z.number(),
})
const sessionRow = z.looseObject({ id: z.string(), status: z.enum(['active', 'finished']), startedAt: z.number() })

export const backupSchema = z.object({
  app: z.literal('training-log'),
  schemaVersion: z.number().int().positive(),
  exportedAt: z.number(),
  tables: z.object({
    exercises: z.array(exerciseRow),
    progressions: z.array(row),
    sessions: z.array(sessionRow),
    sessionExercises: z.array(row),
    sets: z.array(setRow),
    locations: z.array(row),
    settings: z.array(settingRow),
    checkins: z.array(row).default([]),
    candidates: z.array(row).default([]),
    suggestions: z.array(row).default([]),
    runs: z.array(row).default([]),
    events: z.array(row).default([]),
  }),
})
export type Backup = z.infer<typeof backupSchema>

// The API key never leaves the device, not even in a backup.
const PRIVATE_SETTINGS = new Set(['apiKey'])

export async function exportBackup(now = Date.now()): Promise<Backup> {
  const tables = {} as Record<TableName, unknown[]>
  await db.transaction('r', TABLE_NAMES.map((t) => db[t]), async () => {
    for (const t of TABLE_NAMES) tables[t] = await db[t].toArray()
  })
  tables.settings = (tables.settings as { key: string }[]).filter((s) => !PRIVATE_SETTINGS.has(s.key))
  return { app: 'training-log', schemaVersion: SCHEMA_VERSION, exportedAt: now, tables } as Backup
}

export function backupFileName(now = Date.now()): string {
  return `training-log-${isoDate(now)}.json`
}

/** Triggers a download in the browser and stamps lastExportAt. */
export async function downloadBackup(now = Date.now()): Promise<void> {
  const data = await exportBackup(now)
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = backupFileName(now)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  await db.settings.put({ key: 'lastExportAt', value: now })
}

export type ParseResult = { ok: true; backup: Backup; counts: Record<TableName, number> } | { ok: false; error: string }

export function parseBackup(text: string): ParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Not a JSON file.' }
  }
  const parsed = backupSchema.safeParse(json)
  if (!parsed.success) return { ok: false, error: `Not a valid Training Log backup: ${parsed.error.issues[0]?.message ?? 'unknown error'}` }
  if (parsed.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: `Backup is from a newer app version (schema ${parsed.data.schemaVersion}). Update the app first.` }
  }
  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, parsed.data.tables[t].length])) as Record<TableName, number>
  return { ok: true, backup: parsed.data, counts }
}

/** Replaces all data with the backup, in one transaction. Keeps the local API key. */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map((t) => db[t]), async () => {
    const keep = await db.settings.bulkGet([...PRIVATE_SETTINGS])
    for (const t of TABLE_NAMES) {
      await db[t].clear()
      await (db[t] as unknown as { bulkAdd(rows: unknown[]): Promise<unknown> }).bulkAdd(backup.tables[t])
    }
    for (const s of keep) if (s) await db.settings.put(s)
  })
}
