import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { listRuns } from '../../db/history'
import { sessionSummaries, type SessionKind } from '../../db/repo'
import { isoWeek } from '../../lib/format'
import { Chip, Empty } from '../../ui'
import { KIND_LABEL, RunRow, SessionRow } from './SessionRow'

type Filter = SessionKind | 'all' | 'runs'
const FILTERS: Filter[] = ['all', 'weights', 'calisthenics', 'mixed', 'runs']

export function HistoryList() {
  const [filter, setFilter] = useState<Filter>('all')
  const sessions = useLiveQuery(() => sessionSummaries(), [])
  const runs = useLiveQuery(() => listRuns(), [])
  if (!sessions || !runs) return null

  const items: { date: number; node: ReactNode }[] = [
    ...(filter === 'runs' ? [] : sessions.filter((s) => filter === 'all' || s.kind === filter)).map((s) => ({
      date: s.session.startedAt,
      node: <SessionRow key={s.session.id} s={s} />,
    })),
    ...(filter === 'all' || filter === 'runs' ? runs : []).map((r) => ({ date: r.date, node: <RunRow key={r.id} run={r} /> })),
  ].sort((a, b) => b.date - a.date)

  const weeks: { key: string; monday: number; items: ReactNode[] }[] = []
  for (const it of items) {
    const w = isoWeek(it.date)
    const last = weeks[weeks.length - 1]
    if (last?.key === w.key) last.items.push(it.node)
    else weeks.push({ ...w, items: [it.node] })
  }

  return (
    <div className="pt-safe px-4">
      <h1 className="pt-6 pb-4 text-2xl font-bold">History</h1>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <Chip key={f} selected={filter === f} onClick={() => setFilter(f)} className="shrink-0">
            {f === 'all' ? 'All' : KIND_LABEL[f]}
          </Chip>
        ))}
      </div>
      {weeks.length === 0 && <Empty>Nothing here yet.</Empty>}
      {weeks.map((w) => (
        <section key={w.key} className="mb-5">
          <h2 className="mb-2 text-sm font-semibold text-muted">
            Week {Number(w.key.slice(-2))} · {new Date(w.monday).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </h2>
          <div className="flex flex-col gap-2">{w.items}</div>
        </section>
      ))}
    </div>
  )
}
