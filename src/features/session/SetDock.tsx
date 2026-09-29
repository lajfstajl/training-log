import { useState } from 'react'
import { confirmSet, deleteSet, unconfirmSet, updateSet } from '../../db/repo'
import type { Exercise, Rir, SetRecord } from '../../engine/types'
import { unlockAudio } from '../../lib/device'
import { fmtSet } from '../../lib/format'
import { effectiveValues, missingField } from '../../lib/prefill'
import { Button, Chip, Sheet, Stepper, TargetPill, type Suggestion } from '../../ui'
import { askConfirm } from '../../ui/confirm'

const RIRS: Rir[] = [0, 1, 2, 3, 4]

/** Number-pad shortcuts: skip empty values and duplicates. */
function suggest(items: [string, number | undefined][]): Suggestion[] {
  const out: Suggestion[] = []
  for (const [label, value] of items) {
    if (value === undefined || out.some((s) => s.value === value)) continue
    out.push({ label: `${label}: ${value}`, value })
  }
  return out
}

/**
 * The bottom dock: everything needed to log the current set, within thumb reach.
 * Inputs are pre-filled with the target but nothing counts until Confirm is tapped.
 */
export function SetDock({
  set,
  exercise,
  label,
  last,
  prev,
  onConfirmed,
}: {
  set: SetRecord
  exercise: Exercise
  label: string
  last?: SetRecord
  /** Previous confirmed working set of this exercise today; its load carries forward. */
  prev?: SetRecord
  onConfirmed: () => void
}) {
  const [menu, setMenu] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const type = exercise.trackingType
  const isHold = type === 'timed_hold'
  const isWeight = type === 'weight_reps'
  const done = set.completedAt !== undefined

  const shown = effectiveValues(type, set, prev)
  const missing = missingField(type, shown, set.isWarmup)
  // The suggested load (blue) when the user has not typed one.
  const kgSuggestion = set.targetKg ?? (set.isWarmup ? undefined : prev?.kg) ?? (isWeight ? undefined : 0)
  const rir = shown.rir

  // Edits are saved as they happen, so an already confirmed set only needs closing.
  const onConfirm = async () => {
    unlockAudio()
    if (!done && !(await confirmSet(set.id))) return
    onConfirmed()
  }

  const target = fmtSet(type, { kg: set.targetKg, reps: set.targetReps, seconds: set.targetSec, rir: set.targetRir })

  return (
    <div className="px-3 pt-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">
            {exercise.name} <span className="font-normal text-muted">· {label}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 text-sm">
            <TargetPill>{target}</TargetPill>
            {last && <span className="text-muted num">last {fmtSet(type, last)}</span>}
          </div>
        </div>
        <button aria-label="Set options" onClick={() => setMenu(true)} className="min-h-12 min-w-12 rounded-xl text-xl text-muted">
          ⋯
        </button>
      </div>

      <div className="mt-2 flex gap-2">
        {!isHold && (
          <Stepper
            label={isWeight ? 'kg' : 'extra kg'}
            value={set.kg}
            target={kgSuggestion}
            step={exercise.increment || 2.5}
            min={isWeight ? 0 : -200}
            allowNegative={!isWeight}
            suggestions={suggest([
              ['Target', set.targetKg],
              ['Last time', last?.kg],
              ['Previous set', prev?.kg],
            ])}
            onChange={(v) => updateSet(set.id, { kg: v })}
          />
        )}
        {isHold ? (
          <>
            <Stepper
              label="seconds"
              value={set.seconds}
              target={set.targetSec}
              step={5}
              min={0}
              suggestions={suggest([
                ['Target', set.targetSec],
                ['Last time', last?.seconds],
              ])}
              onChange={(v) => updateSet(set.id, { seconds: v })}
            />
            <Stepper
              label="extra kg"
              value={set.kg}
              target={kgSuggestion}
              step={exercise.increment || 2.5}
              min={-200}
              allowNegative
              onChange={(v) => updateSet(set.id, { kg: v })}
            />
          </>
        ) : (
          <Stepper
            label="reps"
            value={set.reps}
            target={set.targetReps}
            step={1}
            min={0}
            suggestions={suggest([
              ['Target', set.targetReps],
              ['Last time', last?.reps],
            ])}
            onChange={(v) => updateSet(set.id, { reps: v })}
          />
        )}
      </div>

      {!set.isWarmup && (
        <div className="mt-2 flex items-center gap-1.5" role="group" aria-label={isHold ? 'How much longer could you have held' : 'Reps left in the tank'}>
          <span className="w-14 text-sm leading-tight text-muted">{isHold ? 'Time left' : 'Reps left'}</span>
          {RIRS.map((r) => (
            <Chip
              key={r}
              tone={set.rir === undefined ? 'target' : 'ink'}
              selected={rir === r}
              onClick={() => updateSet(set.id, { rir: r })}
              className="flex-1 px-0 text-lg"
            >
              {r === 4 ? '4+' : r}
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-2 flex gap-2">
        {done && (
          <Button onClick={() => unconfirmSet(set.id)} className="shrink-0">
            Undo
          </Button>
        )}
        <Button variant="good" big className="flex-1" disabled={!!missing} onClick={onConfirm}>
          {missing || (done ? 'Done' : '✓ Confirm set')}
        </Button>
      </div>

      {noteOpen || set.note ? (
        <input
          key={set.id}
          placeholder="Note for this set"
          defaultValue={set.note}
          onChange={(e) => updateSet(set.id, { note: e.target.value })}
          className="mt-2 h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm outline-none"
        />
      ) : null}

      <Sheet open={menu} onClose={() => setMenu(false)} title={`${exercise.name} · ${label}`}>
        <div className="flex flex-col gap-2">
          <Button onClick={() => { updateSet(set.id, { isWarmup: !set.isWarmup }); setMenu(false) }}>
            {set.isWarmup ? 'Mark as working set' : 'Mark as warm-up'}
          </Button>
          <Button onClick={() => { setNoteOpen(true); setMenu(false) }}>Add note</Button>
          <Button
            variant="danger"
            onClick={async () => {
              setMenu(false)
              if (
                done &&
                !(await askConfirm({ title: 'Delete this set?', body: `It is already logged (${fmtSet(type, set)}).`, confirm: 'Delete set', danger: true }))
              )
                return
              deleteSet(set.id)
            }}
          >
            Delete set
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
