import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import {
  addExerciseToSession,
  addSet,
  addWarmupSet,
  deleteSession,
  finishSession,
  loadSessionView,
  moveSessionExercise,
  removeSessionExercise,
  swapSessionExercise,
  type SessionView,
} from '../../db/repo'
import type { SetRecord } from '../../engine/types'
import { useWakeLock } from '../../lib/device'
import { fmtSet } from '../../lib/format'
import { navigate } from '../../router'
import { Button, Header, Sheet, TargetPill } from '../../ui'
import { askConfirm } from '../../ui/confirm'
import { ExercisePicker } from './ExercisePicker'
import { RestTimer } from './RestTimer'
import { SetDock } from './SetDock'

type Item = SessionView['items'][number]

/** First unconfirmed set in exercise order, else the last set. */
function autoCurrent(items: Item[]): SetRecord | undefined {
  for (const it of items) {
    const s = it.sets.find((x) => x.completedAt === undefined)
    if (s) return s
  }
  return undefined
}

function setLabel(it: Item, s: SetRecord): string {
  if (s.isWarmup) return 'Warm-up'
  const working = it.sets.filter((x) => !x.isWarmup)
  return `Set ${working.indexOf(s) + 1} of ${working.length}`
}

/** Same rule as previousConfirmed in the repo, computed from the loaded view. */
function prevFor(it: Item, s: SetRecord): SetRecord | undefined {
  return it.sets.filter((x) => x.order < s.order && !x.isWarmup && x.completedAt !== undefined).pop()
}

function lastFor(it: Item, s: SetRecord): SetRecord | undefined {
  if (s.isWarmup || !it.last) return undefined
  const idx = it.sets.filter((x) => !x.isWarmup).indexOf(s)
  return it.last[idx]
}

export function ActiveSession({ sessionId, mode }: { sessionId: string; mode: 'live' | 'edit' }) {
  const view = useLiveQuery(() => loadSessionView(sessionId), [sessionId])
  const [selectedId, setSelectedId] = useState<string>()
  const [expanded, setExpanded] = useState<string>()
  const [picker, setPicker] = useState<{ swapFor?: Item } | null>(null)
  const [exMenu, setExMenu] = useState<Item>()
  const [sessionMenu, setSessionMenu] = useState(false)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [now, setNow] = useState(Date.now())
  const live = mode === 'live'

  useWakeLock(live && view?.session.status === 'active')

  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [live])

  // Empty session: open the picker straight away.
  const isEmpty = !!view && view.items.length === 0
  useEffect(() => {
    if (live && isEmpty) setPicker({})
  }, [live, isEmpty])

  const finished = view?.session.status === 'finished'
  useEffect(() => {
    if (live && finished) navigate(`/session/${sessionId}/summary`, true)
  }, [live, finished, sessionId])

  if (view === undefined) return null
  if (!view) return <p className="p-4 text-muted">Session not found.</p>

  const { session, items } = view
  const allSets = items.flatMap((it) => it.sets)
  const current = allSets.find((s) => s.id === selectedId) ?? (live ? autoCurrent(items) : undefined)
  const currentItem = current && items.find((it) => it.se.id === current.sessionExerciseId)
  const openId = expanded ?? currentItem?.se.id
  const unconfirmedWorking = allSets.filter((s) => !s.isWarmup && s.completedAt === undefined).length
  const elapsedMin = Math.max(0, Math.round(((session.finishedAt ?? now) - session.startedAt) / 60000))

  const select = (s: SetRecord) => {
    setSelectedId(s.id)
    setExpanded(s.sessionExerciseId)
  }

  const doFinish = async () => {
    await finishSession(sessionId)
    navigate(`/session/${sessionId}/summary`, true)
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        title={live ? `Session · ${elapsedMin} min` : 'Edit session'}
        onBack={live ? () => navigate('/') : () => navigate(`/history/${sessionId}`, true)}
        right={
          <div className="flex items-center">
            <button aria-label="Session options" onClick={() => setSessionMenu(true)} className="min-h-12 min-w-12 text-xl text-muted">
              ⋯
            </button>
            {live ? (
              <Button variant="primary" onClick={() => (unconfirmedWorking > 0 ? setConfirmFinish(true) : doFinish())}>
                Finish
              </Button>
            ) : (
              <Button variant="primary" onClick={() => navigate(`/history/${sessionId}`, true)}>
                Done
              </Button>
            )}
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="flex flex-col gap-2">
          {items.map((it) => {
            const isOpen = openId === it.se.id
            const working = it.sets.filter((s) => !s.isWarmup)
            const doneCount = working.filter((s) => s.completedAt !== undefined).length
            return (
              <li key={it.se.id} className={`rounded-2xl border ${isOpen ? 'border-line bg-surface' : 'border-transparent bg-surface/60'}`}>
                <div className="flex items-start gap-2 p-3 pb-1">
                  <button className="min-h-12 flex-1 text-left" onClick={() => setExpanded(isOpen ? '' : it.se.id)}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{it.exercise.name}</span>
                      <span className={`text-sm num ${doneCount === working.length && working.length > 0 ? 'text-good' : 'text-muted'}`}>
                        {doneCount}/{working.length}
                      </span>
                    </div>
                    {it.se.why && <p className="mt-0.5 text-xs text-muted">{it.se.why}</p>}
                  </button>
                  <button aria-label={`${it.exercise.name} options`} onClick={() => setExMenu(it)} className="min-h-12 min-w-12 text-xl text-muted">
                    ⋯
                  </button>
                </div>
                {isOpen && (
                  <div className="px-2 pb-2">
                    {it.sets.map((s) => {
                      const last = lastFor(it, s)
                      const done = s.completedAt !== undefined
                      const isCur = current?.id === s.id
                      return (
                        <button
                          key={s.id}
                          onClick={() => select(s)}
                          className={`flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left ${isCur ? 'bg-surface-2 ring-1 ring-target/50' : ''}`}
                        >
                          <span className="w-6 text-center text-sm text-muted num">
                            {s.isWarmup ? 'W' : it.sets.filter((x) => !x.isWarmup).indexOf(s) + 1}
                          </span>
                          <TargetPill>
                            {fmtSet(it.exercise.trackingType, { kg: s.targetKg, reps: s.targetReps, seconds: s.targetSec, rir: s.targetRir })}
                          </TargetPill>
                          <span className="flex-1 truncate text-right text-sm">
                            {done ? (
                              <span className="font-bold num">{fmtSet(it.exercise.trackingType, s)}</span>
                            ) : last ? (
                              <span className="text-muted num">last {fmtSet(it.exercise.trackingType, last)}</span>
                            ) : null}
                          </span>
                          <span aria-label={done ? 'confirmed' : 'not confirmed'} className={`w-5 text-center ${done ? 'text-good' : 'text-line'}`}>
                            {done ? '✓' : '○'}
                          </span>
                        </button>
                      )
                    })}
                    <Button variant="ghost" className="mt-1 w-full text-sm text-muted" onClick={() => addSet(it.se.id)}>
                      + Add set
                    </Button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <Button className="mt-3 w-full" onClick={() => setPicker({})}>
          + Add exercise
        </Button>
        {live && items.length > 0 && !current && (
          <div className="mt-6 text-center">
            <p className="mb-3 text-muted">All planned sets done.</p>
            <Button variant="primary" big className="w-full" onClick={doFinish}>
              Finish session
            </Button>
          </div>
        )}
      </div>

      {/* Bottom dock: rest timer and the current set, within thumb reach. */}
      {(live || current) && (
        <div className="pb-safe sticky bottom-0 z-20 border-t border-line bg-bg">
          {live && <RestTimer session={session} />}
          {current && currentItem && (
            <SetDock
              key={current.id}
              set={current}
              exercise={currentItem.exercise}
              label={setLabel(currentItem, current)}
              last={lastFor(currentItem, current)}
              prev={prevFor(currentItem, current)}
              onConfirmed={() => {
                // Stay on this exercise if it has sets left; otherwise move to the first open set.
                const next = currentItem.sets.find((s) => s.order > current.order && s.completedAt === undefined)
                setSelectedId(next?.id)
                setExpanded(next ? currentItem.se.id : undefined)
              }}
            />
          )}
        </div>
      )}

      <ExercisePicker
        key={picker?.swapFor?.se.id ?? 'add'}
        open={picker !== null}
        onClose={() => setPicker(null)}
        title={picker?.swapFor ? `Swap ${picker.swapFor.exercise.name}` : 'Add exercise'}
        initialPattern={picker?.swapFor?.exercise.pattern}
        excludeId={picker?.swapFor?.exercise.id}
        onPick={async (exId) => {
          if (picker?.swapFor) await swapSessionExercise(picker.swapFor.se.id, exId)
          else await addExerciseToSession(sessionId, exId)
          setSelectedId(undefined)
          setExpanded(undefined)
        }}
      />

      <Sheet open={!!exMenu} onClose={() => setExMenu(undefined)} title={exMenu?.exercise.name}>
        {exMenu && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { moveSessionExercise(exMenu.se.id, -1); setExMenu(undefined) }}>
                ↑ Move up
              </Button>
              <Button className="flex-1" onClick={() => { moveSessionExercise(exMenu.se.id, 1); setExMenu(undefined) }}>
                ↓ Move down
              </Button>
            </div>
            <Button onClick={() => { setPicker({ swapFor: exMenu }); setExMenu(undefined) }}>Swap exercise</Button>
            <Button onClick={() => { addWarmupSet(exMenu.se.id); setExMenu(undefined) }}>Add warm-up set</Button>
            <Button
              variant="danger"
              onClick={async () => {
                const it = exMenu
                setExMenu(undefined)
                const logged = it.sets.filter((s) => s.completedAt !== undefined).length
                if (
                  logged > 0 &&
                  !(await askConfirm({
                    title: `Remove ${it.exercise.name}?`,
                    body: `${logged} logged ${logged === 1 ? 'set' : 'sets'} will be deleted.`,
                    confirm: 'Remove',
                    danger: true,
                  }))
                )
                  return
                await removeSessionExercise(it.se.id)
                setSelectedId(undefined)
              }}
            >
              Remove exercise
            </Button>
          </div>
        )}
      </Sheet>

      <Sheet open={sessionMenu} onClose={() => setSessionMenu(false)} title="Session">
        <div className="flex flex-col gap-2">
          <Button onClick={() => { setSessionMenu(false); setPicker({}) }}>Add exercise</Button>
          {live && (
            <Button
              variant="danger"
              onClick={async () => {
                setSessionMenu(false)
                const ok = await askConfirm({
                  title: 'Discard this session?',
                  body: 'Everything logged in it will be deleted.',
                  confirm: 'Discard',
                  danger: true,
                })
                if (!ok) return
                await deleteSession(sessionId)
                navigate('/', true)
              }}
            >
              Discard session
            </Button>
          )}
        </div>
      </Sheet>

      <Sheet open={confirmFinish} onClose={() => setConfirmFinish(false)} title="Finish session?">
        <p className="mb-4 text-muted">
          {unconfirmedWorking} planned {unconfirmedWorking === 1 ? 'set is' : 'sets are'} not confirmed. They stay in the record as planned but do
          not count as done.
        </p>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setConfirmFinish(false)}>
            Back
          </Button>
          <Button variant="primary" className="flex-1" onClick={doFinish}>
            Finish
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
