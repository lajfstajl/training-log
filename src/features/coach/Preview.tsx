import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { loadPlan, saveSuggestion, startSessionFromPlan, type LoadedPlan } from '../../db/coach'
import { getAiSettings } from '../../coach/ai'
import { coachChoose } from '../../coach/run'
import { loadEngineHistory } from '../../db/history'
import { getProfile } from '../../db/profile'
import type { PainReport } from '../../engine/types'
import { activeSession } from '../../db/repo'
import { db } from '../../db/schema'
import { weekVolume, type Candidate } from '../../engine/candidates'
import { alternativesFor, reselect, sessionMinutes, type RegenReason } from '../../engine/select'
import { fmtSet } from '../../lib/format'
import { navigate } from '../../router'
import { Button, Chip, Header, Sheet, TargetPill } from '../../ui'
import { askConfirm } from '../../ui/confirm'
import { RUN_WORD } from './describe'

const ROLE = { main: 'Heavy', accessory: 'Accessory', core: 'Core' } as const
const REASONS: [RegenReason, string][] = [
  ['shorter', 'Shorter'],
  ['no_barbell', 'No barbell'],
  ['more_pull', 'More pulling'],
  ['less_legs', 'Less legs'],
  ['different', 'Different exercises'],
]

export function Preview({ checkinId }: { checkinId: string }) {
  const plan = useLiveQuery(() => loadPlan(checkinId), [checkinId])
  if (plan === undefined) return null
  if (plan === null) return <p className="p-4 text-muted">Plan not found.</p>
  return plan.suggestion.run ? <RunPreview plan={plan} /> : <SessionPreview plan={plan} />
}

function Rationale({ text }: { text: string; model?: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
      <div className="mb-1 text-sm text-target">Coach</div>
      <p>{text}</p>
    </div>
  )
}

function RunPreview({ plan }: { plan: LoadedPlan }) {
  const run = plan.suggestion.run!
  return (
    <div className="flex min-h-full flex-col">
      <Header title="Today’s run" onBack={() => navigate('/checkin', true)} />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <Rationale text={plan.suggestion.rationale} model={plan.suggestion.model} />
        <section className="rounded-2xl border border-line p-4">
          <div className="text-xl font-semibold">{RUN_WORD[run.type]}</div>
          <div className="mt-2 flex gap-2">
            <TargetPill>about {run.minutes} min</TargetPill>
            <TargetPill>max {run.maxKm} km</TargetPill>
          </div>
          <p className="mt-3">{run.how}</p>
          <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
            {run.why.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
        <p className="text-sm text-muted">Record it on your watch, then log it here when you’re back.</p>
      </div>
      <div className="pb-safe sticky bottom-0 border-t border-line bg-bg px-4 pt-3">
        <Button variant="primary" big className="w-full" onClick={() => navigate(`/run/new/${run.type}/${plan.suggestion.id}`)}>
          Log run when done
        </Button>
      </div>
    </div>
  )
}

function SessionPreview({ plan }: { plan: LoadedPlan }) {
  const [swapFor, setSwapFor] = useState<Candidate | null>(null)
  const [regen, setRegen] = useState(false)
  const [request, setRequest] = useState('')
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState('')
  const hasKey = useLiveQuery(async () => !!(await getAiSettings()).apiKey, []) ?? false
  const fellBack = plan.suggestion.usedFallback
  const chosen = plan.chosen
  const total = Math.round(sessionMinutes(chosen))

  const saveIds = async (ids: string[], reason: string, minutes = plan.suggestion.minutes) =>
    saveSuggestion({
      checkinId: plan.checkin.id,
      candidatesId: plan.candidatesId,
      model: plan.suggestion.model,
      rawJson: JSON.stringify(ids),
      valid: true,
      usedFallback: plan.suggestion.usedFallback,
      ids,
      rationale: plan.suggestion.rationale,
      minutes,
      reason,
    })

  const doRegen = async (reason: RegenReason) => {
    setRegen(false)
    const history = await loadEngineHistory()
    const byId = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
    const r = reselect(plan.candidates, chosen, plan.suggestion.minutes, weekVolume(history, byId, Date.now()), reason)
    await saveIds(
      r.items.map((c) => c.id),
      reason,
      r.minutes,
    )
  }

  /** Free-text change: the AI re-chooses from the same candidates; numbers stay the engine's. */
  const askCoach = async () => {
    if (!request.trim()) return
    setAsking(true)
    setAskError('')
    try {
      const [history, exercises, profile] = await Promise.all([loadEngineHistory(), db.exercises.toArray(), getProfile()])
      if (!profile) return
      const byId = new Map(exercises.map((e) => [e.id, e]))
      const kind = plan.checkin.focus === 'calisthenics' ? 'calisthenics' : 'strength'
      const outcome = await coachChoose(
        {
          now: Date.now(),
          choice: plan.checkin.trainingType,
          focus: plan.checkin.focus ?? kind,
          minutes: plan.suggestion.minutes,
          energy: plan.checkin.energy,
          pain: plan.checkin.pain as PainReport[],
          profile,
          history,
          exercises: byId,
          weekVolume: weekVolume(history, byId, Date.now()),
          reasons: plan.checkin.reasons ?? [],
          candidates: plan.candidates,
          engineIds: chosen.map((c) => c.id),
          request: request.trim(),
          previousIds: chosen.map((c) => c.id),
        },
        kind,
        plan.candidates,
      )
      if (outcome.usedFallback || outcome.skipped) {
        setAskError(outcome.errors.length ? 'The coach couldn’t make that change. Try the quick options, or swap exercises yourself.' : 'The coach is not connected.')
        return
      }
      await saveSuggestion({
        checkinId: plan.checkin.id,
        candidatesId: plan.candidatesId,
        model: outcome.model,
        rawJson: JSON.stringify({ raw: outcome.raw, errors: outcome.errors }),
        valid: true,
        usedFallback: false,
        ids: outcome.ids,
        rationale: outcome.rationale ?? plan.suggestion.rationale,
        minutes: plan.suggestion.minutes,
        reason: request.trim(),
      })
      setRequest('')
      setRegen(false)
    } finally {
      setAsking(false)
    }
  }

  const start = async () => {
    const running = await activeSession()
    if (running) {
      if (await askConfirm({ title: 'A session is already in progress', body: 'Finish or discard it first.', confirm: 'Open it' })) {
        navigate(`/session/${running.id}`)
      }
      return
    }
    const id = await startSessionFromPlan(chosen, { kind: plan.checkin.focus === 'calisthenics' ? 'calisthenics' : 'strength', suggestionId: plan.suggestion.id })
    navigate(`/session/${id}`, true)
  }

  return (
    <div className="flex min-h-full flex-col">
      <Header title="Your session" onBack={() => navigate('/checkin', true)} />
      <div className="flex flex-1 flex-col gap-3 px-4 py-4">
        <Rationale text={plan.suggestion.rationale} model={plan.suggestion.model} />
        {fellBack && <p className="text-sm text-muted">The AI coach couldn’t be reached, so this is the engine’s plan. It works the same.</p>}
        <p className="text-sm text-muted">
          About {total} min{total > plan.suggestion.minutes ? ` (a bit over your ${plan.suggestion.minutes})` : ''} · {chosen.length} exercises
        </p>
        <ul className="flex flex-col gap-2">
          {chosen.map((c) => {
            const s = c.target.sets[0]
            return (
              <li key={c.id} className="rounded-2xl bg-surface p-3">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold">{c.exercise.name}</span>
                      <span className={`text-xs ${c.role === 'main' ? 'text-target' : 'text-muted'}`}>{ROLE[c.role]}</span>
                    </div>
                    <div className="mt-1">
                      <TargetPill>
                        {c.target.sets.length} × {fmtSet(c.exercise.trackingType, { kg: s?.targetKg, reps: s?.targetReps, seconds: s?.targetSec, rir: s?.targetRir })}
                      </TargetPill>
                    </div>
                    {c.marks.length > 0 && <p className="mt-1 text-sm text-warn">{c.marks.join(' · ')}</p>}
                    <p className="mt-1 text-sm text-muted">{c.target.why}</p>
                  </div>
                  <Button variant="ghost" className="shrink-0 text-sm text-muted" onClick={() => setSwapFor(c)}>
                    Swap
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="pb-safe sticky bottom-0 flex gap-2 border-t border-line bg-bg px-4 pt-3">
        <Button onClick={() => setRegen(true)}>Change…</Button>
        <Button variant="primary" big className="flex-1" onClick={start}>
          Start session
        </Button>
      </div>

      <Sheet open={!!swapFor} onClose={() => setSwapFor(null)} title={swapFor ? `Instead of ${swapFor.exercise.name}` : ''}>
        {swapFor && (
          <div className="flex flex-col gap-2">
            {alternativesFor(swapFor, plan.candidates, chosen.map((c) => c.id)).map((alt) => {
              const s = alt.target.sets[0]
              return (
                <button
                  key={alt.id}
                  onClick={async () => {
                    setSwapFor(null)
                    await saveIds(
                      chosen.map((c) => (c.id === swapFor.id ? alt.id : c.id)),
                      `swap ${swapFor.id} → ${alt.id}`,
                    )
                  }}
                  className="rounded-xl bg-surface-2 p-3 text-left active:opacity-70"
                >
                  <div className="font-medium">{alt.exercise.name}</div>
                  <div className="text-sm text-target num">
                    {alt.target.sets.length} × {fmtSet(alt.exercise.trackingType, { kg: s?.targetKg, reps: s?.targetReps, seconds: s?.targetSec, rir: s?.targetRir })}
                  </div>
                  <div className="text-sm text-muted">{alt.target.why}</div>
                </button>
              )
            })}
            {alternativesFor(swapFor, plan.candidates, chosen.map((c) => c.id)).length === 0 && (
              <p className="text-muted">No other exercise with the same movement fits here today.</p>
            )}
          </div>
        )}
      </Sheet>

      <Sheet open={regen} onClose={() => setRegen(false)} title="Change the session">
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map(([r, l]) => (
            <Chip key={r} onClick={() => doRegen(r)}>
              {l}
            </Chip>
          ))}
        </div>
        {hasKey && (
          <div className="mt-4">
            <div className="mb-1.5 text-sm text-muted">Or tell the coach</div>
            <textarea
              rows={2}
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="For example: “dumbbells instead of barbell today”, “my knee is a bit sore”"
              className="w-full rounded-xl border border-line bg-surface-2 p-3 outline-none"
            />
            {askError && <p className="mt-1 text-sm text-warn">{askError}</p>}
            <Button variant="primary" className="mt-2 w-full" disabled={asking || !request.trim()} onClick={askCoach}>
              {asking ? 'Asking the coach…' : 'Ask the coach'}
            </Button>
          </div>
        )}
        <p className="mt-3 text-sm text-muted">The weights and reps stay the engine’s numbers; only the choice of exercises changes.</p>
      </Sheet>
    </div>
  )
}
