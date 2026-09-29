import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { db } from '../../db/schema'
import { EQUIPMENT, MUSCLES, PATTERNS, type Exercise, type Rir, type TrackingType } from '../../engine/types'
import { MUSCLE_LABEL, PATTERN_LABEL } from '../../lib/format'
import { back } from '../../router'
import { Button, Chip, Header } from '../../ui'

const TYPES: { value: TrackingType; label: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps' },
  { value: 'bodyweight_reps', label: 'Bodyweight reps' },
  { value: 'timed_hold', label: 'Timed hold' },
]

/** Every change is saved immediately. */
export function ExerciseEdit({ exerciseId }: { exerciseId: string }) {
  const ex = useLiveQuery(() => db.exercises.get(exerciseId), [exerciseId])
  const ladder = useLiveQuery(async () => {
    const e = await db.exercises.get(exerciseId)
    return e?.progressionId ? db.progressions.get(e.progressionId) : undefined
  }, [exerciseId])
  const names = useLiveQuery(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), [])
  if (!ex) return null

  const save = (patch: Partial<Exercise>) => db.exercises.update(exerciseId, { ...patch, updatedAt: Date.now() })
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const isHold = ex.trackingType === 'timed_hold'

  return (
    <div>
      <Header title={ex.name} onBack={() => back('/settings/exercises')} />
      <div className="flex flex-col gap-5 px-4 py-4">
        <Field label="Name">
          <input
            defaultValue={ex.name}
            onChange={(e) => save({ name: e.target.value })}
            className="h-12 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none"
          />
        </Field>

        <Field label="Tracking">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t.value} selected={ex.trackingType === t.value} onClick={() => save({ trackingType: t.value })}>
                {t.label}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Movement pattern">
          <div className="flex flex-wrap gap-2">
            {PATTERNS.map((p) => (
              <Chip key={p} selected={ex.pattern === p} onClick={() => save({ pattern: p })}>
                {PATTERN_LABEL[p]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Primary muscles (direct, count 1)">
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <Chip key={m} selected={ex.primaryMuscles.includes(m)} onClick={() => save({ primaryMuscles: toggle(ex.primaryMuscles, m) })}>
                {MUSCLE_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Secondary muscles (indirect, count 0.5)">
          <div className="flex flex-wrap gap-2">
            {MUSCLES.map((m) => (
              <Chip key={m} selected={ex.secondaryMuscles.includes(m)} onClick={() => save({ secondaryMuscles: toggle(ex.secondaryMuscles, m) })}>
                {MUSCLE_LABEL[m]}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <NumField label={isHold ? 'Range min (s)' : 'Rep range min'} value={ex.rangeMin} onSave={(v) => save({ rangeMin: v })} />
          <NumField label={isHold ? 'Range max (s)' : 'Rep range max'} value={ex.rangeMax} onSave={(v) => save({ rangeMax: v })} />
          <NumField label="Increment (kg)" value={ex.increment} onSave={(v) => save({ increment: v })} />
          <NumField label="Rest (s)" value={ex.defaultRestSec} onSave={(v) => save({ defaultRestSec: v })} />
          <NumField label="Working sets" value={ex.defaultWorkingSets} onSave={(v) => save({ defaultWorkingSets: Math.max(1, Math.round(v)) })} />
        </div>

        <Field label="Target RIR">
          <div className="flex gap-2">
            {([0, 1, 2, 3, 4] as Rir[]).map((r) => (
              <Chip key={r} selected={ex.targetRir === r} onClick={() => save({ targetRir: r })} className="flex-1">
                {r === 4 ? '4+' : r}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Options">
          <div className="flex flex-wrap gap-2">
            <Chip selected={ex.isMainLift} onClick={() => save({ isMainLift: !ex.isMainLift })}>
              Main lift
            </Chip>
            <Chip selected={ex.unilateral} onClick={() => save({ unilateral: !ex.unilateral })}>
              Unilateral
            </Chip>
            <Chip selected={ex.progressionMode === 'load'} onClick={() => save({ progressionMode: 'load' })}>
              Progress by load
            </Chip>
            <Chip selected={ex.progressionMode === 'ladder'} onClick={() => save({ progressionMode: 'ladder' })}>
              Progress by ladder
            </Chip>
          </div>
        </Field>

        {ladder && (
          <Field label={`Ladder: ${ladder.name}`}>
            <ol className="list-decimal pl-5 text-sm">
              {ladder.steps.map((s, i) => (
                <li key={s.exerciseId} className={i === ex.progressionStep ? 'font-semibold text-target' : 'text-muted'}>
                  {names?.get(s.exerciseId) ?? s.exerciseId} · {s.rangeMin}–{s.rangeMax}
                </li>
              ))}
            </ol>
          </Field>
        )}

        <Field label="Equipment">
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT.map((q) => (
              <Chip key={q} selected={ex.equipment.includes(q)} onClick={() => save({ equipment: toggle(ex.equipment, q) })}>
                {q.replace('_', ' ')}
              </Chip>
            ))}
          </div>
        </Field>

        <Button variant={ex.archived ? 'secondary' : 'danger'} onClick={() => save({ archived: !ex.archived })}>
          {ex.archived ? 'Restore exercise' : 'Archive exercise'}
        </Button>
        <p className="text-xs text-muted">Archived exercises are hidden from pickers. Their history is kept.</p>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-muted">{label}</div>
      {children}
    </div>
  )
}

function NumField({ label, value, onSave }: { label: string; value: number; onSave: (v: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-muted">{label}</span>
      <input
        inputMode="decimal"
        defaultValue={value}
        onBlur={(e) => {
          const n = Number(e.target.value.replace(',', '.'))
          if (Number.isFinite(n) && n >= 0) onSave(n)
          else e.target.value = String(value)
        }}
        className="h-12 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none num"
      />
    </label>
  )
}
