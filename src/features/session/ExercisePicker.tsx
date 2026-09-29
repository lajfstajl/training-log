import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/schema'
import { PATTERNS, type Pattern } from '../../engine/types'
import { PATTERN_LABEL } from '../../lib/format'
import { Chip, Sheet } from '../../ui'

export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Add exercise',
  initialPattern,
  excludeId,
}: {
  open: boolean
  onClose: () => void
  onPick: (exerciseId: string) => void
  title?: string
  initialPattern?: Pattern
  excludeId?: string
}) {
  const [q, setQ] = useState('')
  const [pattern, setPattern] = useState<Pattern | undefined>(initialPattern)
  const exercises = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? []
  // Recently used exercises, most recent first.
  const recentIds = useLiveQuery(async () => {
    const sessions = await db.sessions.orderBy('startedAt').reverse().limit(10).toArray()
    const ses = await db.sessionExercises.where('sessionId').anyOf(sessions.map((s) => s.id)).toArray()
    const order = new Map(sessions.map((s, i) => [s.id, i]))
    return [...new Set(ses.sort((a, b) => order.get(a.sessionId)! - order.get(b.sessionId)! || a.order - b.order).map((x) => x.exerciseId))].slice(0, 8)
  }, []) ?? []

  const list = exercises.filter(
    (e) =>
      !e.archived &&
      e.id !== excludeId &&
      e.trackingType !== 'run' &&
      (!pattern || e.pattern === pattern) &&
      (!q || e.name.toLowerCase().includes(q.toLowerCase())),
  )

  // Without a search or filter: Recent, then Main lifts, then everything else.
  const byId = new Map(list.map((e) => [e.id, e]))
  const grouped = !q && !pattern
  const recent = grouped ? recentIds.map((id) => byId.get(id)).filter((e) => !!e) : []
  const main = grouped ? list.filter((e) => e.isMainLift && !recentIds.includes(e.id)) : []
  const rest = grouped ? list.filter((e) => !e.isMainLift && !recentIds.includes(e.id)) : list
  const sections = [
    { title: 'Recent', items: recent },
    { title: 'Main lifts', items: main },
    { title: grouped ? 'All exercises' : '', items: rest },
  ].filter((s) => s.items.length > 0)

  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <input
        type="search"
        placeholder="Search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="mb-3 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none"
      />
      <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        <Chip selected={!pattern} onClick={() => setPattern(undefined)} className="shrink-0">
          All
        </Chip>
        {PATTERNS.map((p) => (
          <Chip key={p} selected={pattern === p} onClick={() => setPattern(p)} className="shrink-0 whitespace-nowrap">
            {PATTERN_LABEL[p]}
          </Chip>
        ))}
      </div>
      {sections.map((s) => (
        <section key={s.title} className="mb-2">
          {s.title && <h3 className="mt-2 text-sm font-semibold text-muted">{s.title}</h3>}
          <ul className="divide-y divide-line">
            {s.items.map((e) => (
              <li key={e.id}>
                <button
                  onClick={() => {
                    onPick(e.id)
                    onClose()
                  }}
                  className="flex min-h-14 w-full items-center justify-between gap-3 text-left active:opacity-70"
                >
                  <span>{e.name}</span>
                  <span className="text-sm text-muted">{PATTERN_LABEL[e.pattern]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {list.length === 0 && <p className="py-6 text-center text-muted">No matches</p>}
    </Sheet>
  )
}
