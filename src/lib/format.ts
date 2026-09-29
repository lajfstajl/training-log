import type { Rir, TrackingType } from '../engine/types'

export const uuid = () => crypto.randomUUID()

export function fmtKg(kg: number | undefined): string {
  if (kg === undefined) return '–'
  return String(Math.round(kg * 100) / 100)
}

export function fmtRir(rir: Rir | undefined): string {
  if (rir === undefined) return '–'
  return rir >= 4 ? '4+' : String(rir)
}

/** "80 kg × 5 · 2 left", "BW+10 × 8 · 1 left", "30 s · 1 left". "left" = reps in reserve (RIR). */
export function fmtSet(
  type: TrackingType,
  s: { kg?: number; reps?: number; seconds?: number; rir?: Rir },
): string {
  const rir = s.rir !== undefined ? ` · ${fmtRir(s.rir)} left` : ''
  if (type === 'timed_hold') {
    const load = s.kg ? ` ${loadLabel(type, s.kg)}` : ''
    return `${s.seconds ?? '–'} s${load}${rir}`
  }
  return `${loadLabel(type, s.kg)} × ${s.reps ?? '–'}${rir}`
}

export function loadLabel(type: TrackingType, kg: number | undefined): string {
  if (type === 'weight_reps') return kg === undefined ? '? kg' : `${fmtKg(kg)} kg`
  if (!kg) return 'BW'
  return kg > 0 ? `BW+${fmtKg(kg)}` : `BW${fmtKg(kg)}`
}

export function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${min % 60} min`
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function isoDate(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** ISO week key like "2026-W40" and the Monday it starts on. */
export function isoWeek(ts: number): { key: string; monday: number } {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  const thursday = new Date(monday)
  thursday.setDate(monday.getDate() + 3)
  const yearStart = new Date(thursday.getFullYear(), 0, 1)
  // Round to whole days first: a daylight saving change makes the difference an hour off.
  const days = Math.round((thursday.getTime() - yearStart.getTime()) / 86400000)
  const week = 1 + Math.floor(days / 7)
  return { key: `${thursday.getFullYear()}-W${week.toString().padStart(2, '0')}`, monday: monday.getTime() }
}

export const PATTERN_LABEL: Record<string, string> = {
  squat: 'Squat',
  hinge: 'Hinge',
  horizontal_push: 'Horizontal push',
  vertical_push: 'Vertical push',
  horizontal_pull: 'Horizontal pull',
  vertical_pull: 'Vertical pull',
  core: 'Core',
  skill: 'Skill',
  isolation: 'Isolation',
}

export const MUSCLE_LABEL: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
}
