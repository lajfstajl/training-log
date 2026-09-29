import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { coachChoose } from '../../coach/run'
import { saveCandidates, saveCheckin, saveSuggestion } from '../../db/coach'
import { weekVolume } from '../../engine/candidates'
import { loadEngineHistory } from '../../db/history'
import { getProfile, type StoredProfile } from '../../db/profile'
import { getSetting, setSetting } from '../../db/repo'
import { db, type Location } from '../../db/schema'
import { planToday } from '../../engine/plan'
import { BODY_AREAS, type BodyArea, type Equipment, type Exercise, type PainReport, type Progression, type TrainingHistory } from '../../engine/types'
import { navigate } from '../../router'
import { Button, Chip, Header, Sheet } from '../../ui'
import { engineRationale, headline } from './describe'

// Every session starts here: the coach's recommendation on top, then one-tap answers, all
// prefilled. Deviating is one tap ("Run" instead of strength), and the plan follows the choice.

type Choice = 'recommended' | 'strength' | 'calisthenics' | 'run'

const AREA: Record<BodyArea, string> = {
  shoulder: 'Shoulder',
  elbow: 'Elbow',
  wrist: 'Wrist',
  neck: 'Neck',
  upper_back: 'Upper back',
  lower_back: 'Lower back',
  hip: 'Hip',
  knee: 'Knee',
  ankle: 'Ankle',
}

export function Checkin() {
  const data = useLiveQuery(async () => {
    const profile = await getProfile()
    return {
      profile: profile ?? null,
      history: await loadEngineHistory(),
      exercises: await db.exercises.toArray(),
      progressions: await db.progressions.toArray(),
      locations: await db.locations.toArray(),
      lastLocationId: await getSetting<string>('lastLocationId'),
    }
  }, [])
  if (!data) return null
  if (!data.profile) {
    navigate('/welcome', true)
    return null
  }
  return <CheckinForm {...data} profile={data.profile} />
}

function CheckinForm(props: {
  profile: StoredProfile
  history: TrainingHistory
  exercises: Exercise[]
  progressions: Progression[]
  locations: Location[]
  lastLocationId?: string
}) {
  const { profile, history, exercises, progressions } = props
  const locations = props.locations.filter((l) => profile.locationIds.includes(l.id))
  const [choice, setChoice] = useState<Choice>('recommended')
  const [minutes, setMinutes] = useState(profile.typicalMinutes)
  const [energy, setEnergy] = useState(3)
  const [pain, setPain] = useState<PainReport[]>([])
  const [locationId, setLocationId] = useState(
    locations.find((l) => l.id === props.lastLocationId)?.id ?? locations[0]?.id ?? props.locations[0]?.id,
  )
  const [painArea, setPainArea] = useState<BodyArea | null>(null)
  const [busy, setBusy] = useState(false)
  const equipment = (props.locations.find((l) => l.id === locationId)?.equipment ?? []) as Equipment[]

  const base = { now: Date.now(), history, profile, exercises, progressions, equipment, minutes, energy, pain }
  // The recommendation (what the coach would pick) and the plan for the current choice.
  const recommended = useMemo(() => planToday(base), [history, profile, exercises, progressions, equipment, minutes, energy, pain])
  const plan = useMemo(
    () => (choice === 'recommended' ? recommended : planToday({ ...base, focus: choice })),
    [recommended, choice, history, profile, exercises, progressions, equipment, minutes, energy, pain],
  )

  const build = async () => {
    setBusy(true)
    try {
      await buildPlan()
    } finally {
      setBusy(false)
    }
  }

  const buildPlan = async () => {
    await setSetting('lastLocationId', locationId)
    const checkinId = await saveCheckin({
      trainingType: choice,
      focus: plan.focus,
      recommended: recommended.recommendation.focus,
      reasons: recommended.recommendation.reasons,
      minutes,
      energy,
      pain,
      locationId,
    })
    const rationale = engineRationale(plan, choice)
    if (plan.run) {
      await saveSuggestion({ checkinId, model: 'engine', rawJson: JSON.stringify(plan.run), valid: true, usedFallback: false, ids: [], rationale, minutes, run: plan.run })
    } else {
      const candidatesId = await saveCandidates(checkinId, plan.candidates)
      const kind = plan.focus === 'calisthenics' ? 'calisthenics' : 'strength'
      const engineIds = plan.session.map((c) => c.id)
      // AI chooses and explains from the engine's candidates (if a key is set); engine otherwise.
      const outcome = await coachChoose(
        {
          now: Date.now(),
          choice,
          focus: plan.focus,
          minutes,
          energy,
          pain,
          profile,
          history,
          exercises: new Map(exercises.map((e) => [e.id, e])),
          weekVolume: weekVolume(history, new Map(exercises.map((e) => [e.id, e])), Date.now()),
          reasons: recommended.recommendation.reasons,
          candidates: plan.candidates,
          engineIds,
        },
        kind,
        plan.candidates,
      )
      await saveSuggestion({
        checkinId,
        candidatesId,
        model: outcome.model,
        rawJson: JSON.stringify({ raw: outcome.raw, errors: outcome.errors }),
        valid: outcome.valid,
        usedFallback: outcome.usedFallback,
        ids: outcome.ids,
        rationale: outcome.rationale ?? rationale,
        minutes,
      })
    }
    navigate(`/plan/${checkinId}`)
  }

  const recRun = recommended.recommendation.focus.startsWith('run')
  const choices: [Choice, string][] = [
    ['recommended', 'Coach’s pick'],
    ['strength', 'Strength'],
    ['calisthenics', 'Calisthenics'],
    ['run', 'Run'],
  ]

  return (
    <div className="flex min-h-full flex-col">
      <Header title="Today" onBack={() => navigate('/', true)} />
      <div className="flex flex-1 flex-col gap-5 px-4 py-4">
        <section className="rounded-2xl border border-target/40 bg-surface p-4">
          <div className="text-sm text-target">Coach’s pick</div>
          <div className="mt-1 text-xl font-semibold">{headline(recommended)}</div>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {recommended.recommendation.reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <Row label="What are we doing?">
          <div className="grid grid-cols-2 gap-2">
            {choices.map(([v, l]) => (
              <Chip key={v} selected={choice === v} onClick={() => setChoice(v)}>
                {l}
                {v !== 'recommended' && ((v === 'run' && recRun) || v === recommended.recommendation.focus) ? ' ✓' : ''}
              </Chip>
            ))}
          </div>
          <button onClick={() => navigate('/session/new')} className="mt-2 min-h-12 w-full text-sm text-muted underline underline-offset-4">
            Free session: pick exercises myself
          </button>
          {choice !== 'recommended' && <p className="mt-1 text-sm text-target">{headline(plan)}</p>}
        </Row>

        <Row label="How much time?">
          <div className="flex gap-2">
            {[20, 30, 45, 60, 75].map((m) => (
              <Chip key={m} selected={minutes === m} onClick={() => setMinutes(m)} className="flex-1 px-0 num">
                {m === 75 ? '75+' : m}
              </Chip>
            ))}
          </div>
        </Row>

        <Row label="Energy today? (1 drained · 5 great)">
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} selected={energy === n} onClick={() => setEnergy(n)} className="flex-1 num">
                {n}
              </Chip>
            ))}
          </div>
        </Row>

        <Row label="Any pain?">
          <div className="flex flex-wrap gap-2">
            <Chip selected={pain.length === 0} onClick={() => setPain([])}>
              None
            </Chip>
            {BODY_AREAS.map((a) => {
              const p = pain.find((x) => x.area === a)
              return (
                <Chip key={a} selected={!!p} onClick={() => setPainArea(a)}>
                  {AREA[a]}
                  {p ? ` ${p.score}` : ''}
                </Chip>
              )
            })}
          </div>
        </Row>

        {locations.length > 1 && (
          <Row label="Where are you?">
            <div className="flex gap-2">
              {locations.map((l) => (
                <Chip key={l.id} selected={locationId === l.id} onClick={() => setLocationId(l.id)} className="flex-1">
                  {l.name}
                </Chip>
              ))}
            </div>
          </Row>
        )}
      </div>

      <div className="pb-safe sticky bottom-0 border-t border-line bg-bg px-4 pt-3">
        <Button variant="primary" big className="w-full" disabled={busy} onClick={build}>
          {busy ? 'The coach is putting it together…' : plan.run ? 'Show my run' : 'Build my session'}
        </Button>
      </div>

      <Sheet open={!!painArea} onClose={() => setPainArea(null)} title={painArea ? `${AREA[painArea]}: how bad, 0–10?` : ''}>
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 11 }, (_, n) => (
            <Chip
              key={n}
              selected={pain.find((x) => x.area === painArea)?.score === n}
              onClick={() => {
                const rest = pain.filter((x) => x.area !== painArea)
                setPain(n === 0 ? rest : [...rest, { area: painArea!, score: n }])
                setPainArea(null)
              }}
              className="num"
            >
              {n}
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Above 5, I make exercises that load this area lighter and mark them. You can always override.</p>
      </Sheet>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-sm text-muted">{label}</h2>
      {children}
    </section>
  )
}
