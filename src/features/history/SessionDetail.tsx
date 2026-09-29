import { useLiveQuery } from 'dexie-react-hooks'
import { activeSession, deleteSession, loadSessionView, repeatSession } from '../../db/repo'
import { fmtDate, fmtDuration, fmtSet } from '../../lib/format'
import { back, navigate } from '../../router'
import { Button, Header, TargetPill } from '../../ui'
import { askConfirm } from '../../ui/confirm'

const FEEL = { too_easy: 'Too easy', about_right: 'About right', too_hard: 'Too hard' } as const

export function SessionDetail({ sessionId }: { sessionId: string }) {
  const view = useLiveQuery(() => loadSessionView(sessionId), [sessionId])
  if (view === undefined) return null
  if (view === null) return <p className="p-4 text-muted">Session not found.</p>
  const { session, items } = view

  const repeat = async () => {
    const running = await activeSession()
    if (
      running &&
      !(await askConfirm({
        title: 'A session is already in progress',
        body: 'Finish or discard it before repeating another one.',
        confirm: 'Open it',
      }))
    )
      return
    const id = await repeatSession(sessionId)
    navigate(`/session/${id}`)
  }

  const remove = async () => {
    const ok = await askConfirm({ title: 'Delete this session?', body: 'This cannot be undone.', confirm: 'Delete', danger: true })
    if (!ok) return
    await deleteSession(sessionId)
    navigate('/history', true)
  }

  return (
    <div>
      <Header title={fmtDate(session.startedAt)} onBack={() => back('/history')} />
      <div className="px-4 py-3">
        <p className="text-sm text-muted">
          {session.finishedAt ? fmtDuration(session.finishedAt - session.startedAt) : 'In progress'}
          {session.feel && ` · ${FEEL[session.feel]}`}
        </p>
        {session.notes && <p className="mt-2 whitespace-pre-wrap">{session.notes}</p>}

        <ul className="mt-4 flex flex-col gap-3">
          {items.map((it) => (
            <li key={it.se.id} className="rounded-2xl bg-surface p-3">
              <h3 className="font-semibold">{it.exercise.name}</h3>
              {it.se.why && <p className="text-xs text-muted">{it.se.why}</p>}
              <ul className="mt-2 flex flex-col gap-1">
                {it.sets.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-center text-muted num">{s.isWarmup ? 'W' : i + 1 - it.sets.slice(0, i).filter((x) => x.isWarmup).length}</span>
                    <TargetPill>{fmtSet(it.exercise.trackingType, { kg: s.targetKg, reps: s.targetReps, seconds: s.targetSec, rir: s.targetRir })}</TargetPill>
                    <span className="text-muted">→</span>
                    {s.completedAt !== undefined ? (
                      <span className="font-bold num">{fmtSet(it.exercise.trackingType, s)}</span>
                    ) : (
                      <span className="text-muted">not done</span>
                    )}
                    {s.note && <span className="truncate text-xs text-muted">· {s.note}</span>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-2 px-4 pb-4">
        <Button variant="danger" onClick={remove}>
          Delete
        </Button>
        {session.status === 'finished' && (
          <Button className="flex-1" onClick={() => navigate(`/session/${sessionId}/edit`)}>
            Edit
          </Button>
        )}
        <Button variant="primary" className="flex-1" onClick={repeat}>
          Repeat
        </Button>
      </div>
    </div>
  )
}
