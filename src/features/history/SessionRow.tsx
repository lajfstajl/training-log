import { durationText, paceText } from '../../db/history'
import type { SessionSummary } from '../../db/repo'
import type { Run } from '../../db/schema'
import { fmtDate, fmtDuration } from '../../lib/format'
import { navigate } from '../../router'

export const KIND_LABEL = { weights: 'Weights', calisthenics: 'Calisthenics', mixed: 'Mixed', empty: 'Empty', runs: 'Runs' } as const

const RUN_LABEL = { easy: 'Easy run', hard: 'Hard run', long: 'Long run' } as const

export function RunRow({ run }: { run: Run }) {
  return (
    <button
      onClick={() => navigate(`/run/${run.id}`)}
      className="flex min-h-14 w-full flex-col rounded-xl bg-surface px-3 py-2 text-left active:opacity-70"
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="font-semibold">{fmtDate(run.date)}</span>
        <span className="text-xs text-muted">{RUN_LABEL[run.runType]}</span>
      </div>
      <span className="mt-0.5 text-sm text-muted num">
        {run.distanceKm} km · {durationText(run.durationSec)} · {paceText(run.distanceKm, run.durationSec)} min/km
        {run.rpe ? ` · effort ${run.rpe}` : ''}
      </span>
    </button>
  )
}

export function SessionRow({ s }: { s: SessionSummary }) {
  const { session } = s
  return (
    <button
      onClick={() => navigate(`/history/${session.id}`)}
      className="flex min-h-14 w-full flex-col rounded-xl bg-surface px-3 py-2 text-left active:opacity-70"
    >
      <div className="flex w-full items-baseline justify-between gap-2">
        <span className="font-semibold">{fmtDate(session.startedAt)}</span>
        <span className="text-xs text-muted">
          {KIND_LABEL[s.kind]} · {s.setsDone} sets
          {session.finishedAt ? ` · ${fmtDuration(session.finishedAt - session.startedAt)}` : ''}
        </span>
      </div>
      <span className="mt-0.5 w-full truncate text-sm text-muted">{s.names.join(', ') || 'No exercises'}</span>
    </button>
  )
}
