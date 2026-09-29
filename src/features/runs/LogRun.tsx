import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { deleteRun, paceText, saveRun } from '../../db/history'
import { db, type Run } from '../../db/schema'
import type { RunType } from '../../engine/types'
import { isoDate } from '../../lib/format'
import { back, navigate } from '../../router'
import { Button, Chip, Header, Stepper } from '../../ui'
import { askConfirm } from '../../ui/confirm'

const TYPES: [RunType, string][] = [
  ['easy', 'Easy'],
  ['hard', 'Hard'],
  ['long', 'Long'],
]

/** Manual run entry. Pace is calculated. `type` pre-selects from a coach suggestion. */
export function LogRun({ runId, type, suggestionId }: { runId?: string; type?: RunType; suggestionId?: string }) {
  const existing = useLiveQuery(async () => (runId ? ((await db.runs.get(runId)) ?? null) : null), [runId])
  if (runId && existing === undefined) return null
  return <RunForm existing={existing ?? undefined} type={type} suggestionId={suggestionId} />
}

function RunForm({ existing, type, suggestionId }: { existing?: Run; type?: RunType; suggestionId?: string }) {
  const today = isoDate(Date.now())
  const [date, setDate] = useState(existing ? isoDate(existing.date) : today)
  const [km, setKm] = useState<number | undefined>(existing?.distanceKm)
  const [min, setMin] = useState<number | undefined>(existing ? Math.floor(existing.durationSec / 60) : undefined)
  const [sec, setSec] = useState<number | undefined>(existing ? Math.round(existing.durationSec % 60) : undefined)
  const [runType, setRunType] = useState<RunType>(existing?.runType ?? type ?? 'easy')
  const [rpe, setRpe] = useState<number | undefined>(existing?.rpe)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const durationSec = (min ?? 0) * 60 + (sec ?? 0)
  const valid = (km ?? 0) > 0 && durationSec > 0
  const yesterday = isoDate(Date.now() - 86_400_000)

  const save = async () => {
    // Noon on the chosen day keeps "days ago" arithmetic stable across time zones.
    const [y, m, d] = date.split('-').map(Number)
    const when = date === today ? Date.now() : new Date(y, m - 1, d, 12).getTime()
    await saveRun(
      {
        date: existing && isoDate(existing.date) === date ? existing.date : when,
        distanceKm: km!,
        durationSec,
        runType,
        rpe,
        notes,
        suggestionId: existing?.suggestionId ?? suggestionId,
      },
      existing?.id,
    )
    navigate('/', true)
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header title={existing ? 'Edit run' : 'Log run'} onBack={() => back('/')} />
      <div className="flex flex-1 flex-col gap-5 px-4 py-4">
        <Field label="When">
          <div className="flex gap-2">
            <Chip selected={date === today} onClick={() => setDate(today)} className="flex-1">
              Today
            </Chip>
            <Chip selected={date === yesterday} onClick={() => setDate(yesterday)} className="flex-1">
              Yesterday
            </Chip>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-12 flex-1 rounded-xl border border-line bg-surface-2 px-2 text-ink"
              aria-label="Pick a date"
            />
          </div>
        </Field>

        <Field label="Type">
          <div className="flex gap-2">
            {TYPES.map(([v, l]) => (
              <Chip key={v} selected={runType === v} onClick={() => setRunType(v)} className="flex-1">
                {l}
              </Chip>
            ))}
          </div>
        </Field>

        <Stepper label="Distance (km)" value={km} target={undefined} step={0.5} min={0} onChange={setKm} />

        <div className="flex gap-2">
          <Stepper label="Time: minutes" value={min} target={undefined} step={1} min={0} onChange={setMin} />
          <Stepper label="seconds" value={sec} target={undefined} step={5} min={0} onChange={(v) => setSec(v === undefined ? v : Math.min(59, v))} />
        </div>

        <p className="text-muted">
          Pace <span className="font-bold text-ink num">{valid ? paceText(km!, durationSec) : '–'}</span> min/km
        </p>

        <Field label="How hard did it feel? (1 = very easy, 10 = all-out)">
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Chip key={n} selected={rpe === n} onClick={() => setRpe(rpe === n ? undefined : n)} className="num">
                {n}
              </Chip>
            ))}
          </div>
        </Field>

        <textarea
          rows={2}
          placeholder="Note (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-line bg-surface-2 p-3 outline-none"
        />

        {existing && (
          <Button
            variant="danger"
            onClick={async () => {
              if (!(await askConfirm({ title: 'Delete this run?', confirm: 'Delete', danger: true }))) return
              await deleteRun(existing.id)
              navigate('/history', true)
            }}
          >
            Delete run
          </Button>
        )}
      </div>
      <div className="pb-safe sticky bottom-0 border-t border-line bg-bg px-4 pt-3">
        <Button variant="good" big className="w-full" disabled={!valid} onClick={save}>
          {valid ? 'Save run' : 'Enter distance and time'}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-sm text-muted">{label}</div>
      {children}
    </div>
  )
}
