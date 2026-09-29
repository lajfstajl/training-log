import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_PROFILE, getProfile, saveProfile, type StoredProfile } from '../../db/profile'
import { db, type Location } from '../../db/schema'
import { BODY_AREAS, EQUIPMENT, type BodyArea, type Equipment } from '../../engine/types'
import { navigate } from '../../router'
import { Button, Chip, Header, NumberPad } from '../../ui'
import { coachingSummary } from './summary'

// "Meet your coach": setup as a short conversation. Each answer is a big tap; nothing is required
// except where you train. The result is a loose plan, not a schedule.

const LIFTS: [string, string][] = [
  ['back-squat', 'Squat'],
  ['bench-press', 'Bench press'],
  ['deadlift', 'Deadlift'],
  ['overhead-press', 'Overhead press'],
]
const REPS = [3, 5, 8, 10]
const PULLUPS: [string, number | null][] = [
  ['Not sure', null],
  ['None yet', 0],
  ['1–4', 2],
  ['5–9', 7],
  ['10+', 12],
]
const AREA_LABEL: Record<BodyArea, string> = {
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
const EQUIP_LABEL = (e: string) => e.replace('_', ' ').replace(/^./, (c) => c.toUpperCase())

type StepId = 'intro' | 'goal' | 'aim' | 'minutes' | 'where' | 'equipment' | 'lifts' | 'pullups' | 'avoid' | 'running' | 'note' | 'summary'
const STEPS: StepId[] = ['intro', 'goal', 'aim', 'minutes', 'where', 'equipment', 'lifts', 'pullups', 'avoid', 'running', 'note', 'summary']

export function Onboarding() {
  const loaded = useLiveQuery(async () => ({ profile: (await getProfile()) ?? null, locations: await db.locations.toArray() }), [])
  if (!loaded) return null
  return <Conversation initial={loaded.profile} locations={loaded.locations} />
}

function Conversation({ initial, locations }: { initial: StoredProfile | null; locations: Location[] }) {
  const editing = !!initial
  const [p, setP] = useState<StoredProfile>(initial ?? DEFAULT_PROFILE)
  const [equip, setEquip] = useState<Record<string, Equipment[]>>(() =>
    Object.fromEntries(locations.map((l) => [l.id, l.equipment as Equipment[]])),
  )
  const [step, setStep] = useState(editing ? STEPS.indexOf('summary') : 0)
  const [pad, setPad] = useState<{ label: string; initial?: number; onDone: (n: number) => void } | null>(null)
  // The question currently open for an answer; scrolled into view whenever it changes.
  const currentRef = useRef<HTMLDivElement>(null)
  const set = (patch: Partial<StoredProfile>) => setP((x) => ({ ...x, ...patch }))
  // First run: walk through the questions. Editing: each answer returns to the summary.
  const next = () => setStep((s) => (editing ? STEPS.indexOf('summary') : Math.min(STEPS.length - 1, s + 1)))

  useEffect(() => {
    // First run: keep the newest question in view. Editing: show the question that was tapped.
    currentRef.current?.scrollIntoView({ behavior: 'smooth', block: editing ? 'start' : 'end' })
  }, [step, editing])

  const locName = (id: string) => locations.find((l) => l.id === id)?.name ?? id

  const persist = async () => {
    await saveProfile({ ...p, completedAt: initial?.completedAt || Date.now() })
    await db.transaction('rw', db.locations, async () => {
      for (const id of p.locationIds) await db.locations.update(id, { equipment: equip[id] ?? [] })
    })
  }

  // Editing an existing setup saves every change right away (never lose data, no Save to forget).
  const first = useRef(true)
  useEffect(() => {
    if (!editing) return
    if (first.current) {
      first.current = false
      return
    }
    if (p.locationIds.length > 0) persist()
  }, [p, equip])

  const finish = async (then: string) => {
    await persist()
    navigate(then, true)
  }

  // ---- Question text and the user's answer, per step ----
  const ask: Record<StepId, string> = {
    intro: editing
      ? 'Tap any of your answers to change it. Changes are saved right away.'
      : 'Hi, I’m your coach. A few quick questions so I can suggest the right session each time. It takes about a minute, and you can change everything later.',
    goal: 'What matters most right now?',
    aim: 'How many sessions a week is realistic in a normal week? Runs count too. This is a soft aim, not a schedule.',
    minutes: 'How long is a typical session?',
    where: 'Where do you train?',
    equipment: 'What’s there? I only suggest exercises that fit.',
    lifts: 'Your recent working sets, if you know them. A set you did recently, not a max. “Not sure” is fine: then we find your weights together.',
    pullups: 'How many strict pull-ups can you do in a row?',
    avoid: 'Anything that hurts, or movements you want to avoid?',
    running: 'Do you run?',
    note: 'Anything else I should know? Optional.',
    summary: 'Here’s how I’ll coach you:',
  }
  const answer: Partial<Record<StepId, string>> = {
    goal: { strength: 'Get stronger', muscle: 'Build muscle', fitness: 'All-round fitness' }[p.goal],
    aim: p.weeklyAim === null ? 'It varies' : `${p.weeklyAim} a week`,
    minutes: `${p.typicalMinutes}${p.typicalMinutes >= 75 ? '+' : ''} min`,
    where: p.locationIds.map(locName).join(', '),
    equipment: p.locationIds.map((id) => `${locName(id)}: ${(equip[id] ?? []).length} items`).join(' · '),
    lifts: LIFTS.map(([id, name]) => (p.baselines[id] ? `${name} ${p.baselines[id].kg}×${p.baselines[id].reps}` : null)).filter(Boolean).join(', ') || 'Not sure',
    pullups: PULLUPS.find(([, v]) => v === p.pullUps)?.[0] ?? `${p.pullUps}`,
    avoid: p.avoidAreas.length ? p.avoidAreas.map((a) => AREA_LABEL[a]).join(', ') + (p.avoidNote ? ` (${p.avoidNote})` : '') : 'Nothing',
    running: p.running.runs ? `Yes, ${p.running.perWeek} a week, longest ${p.running.longestKm} km` : 'No',
    note: p.note || 'Nothing else',
    intro: editing ? undefined : 'Let’s go',
  }

  // ---- Controls for the current step ----
  const controls = (id: StepId): ReactNode => {
    switch (id) {
      case 'intro':
        return editing ? null : (
          <Button variant="primary" big className="w-full" onClick={next}>
            Let’s go
          </Button>
        )
      case 'goal':
        return (
          <Choices
            options={[
              ['strength', 'Get stronger'],
              ['muscle', 'Build muscle'],
              ['fitness', 'All-round fitness'],
            ]}
            value={p.goal}
            onPick={(v) => {
              set({ goal: v as StoredProfile['goal'] })
              next()
            }}
          />
        )
      case 'aim':
        return (
          <Choices
            options={[
              ['2', '2'],
              ['3', '3'],
              ['4', '4'],
              ['varies', 'It varies'],
            ]}
            value={p.weeklyAim === null ? 'varies' : String(p.weeklyAim)}
            onPick={(v) => {
              set({ weeklyAim: v === 'varies' ? null : Number(v) })
              next()
            }}
          />
        )
      case 'minutes':
        return (
          <Choices
            options={[30, 45, 60, 75].map((m) => [String(m), m === 75 ? '75+' : String(m)])}
            value={String(p.typicalMinutes)}
            onPick={(v) => {
              set({ typicalMinutes: Number(v) })
              next()
            }}
          />
        )
      case 'where':
        return (
          <>
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <Chip
                  key={l.id}
                  selected={p.locationIds.includes(l.id)}
                  onClick={() =>
                    set({ locationIds: p.locationIds.includes(l.id) ? p.locationIds.filter((x) => x !== l.id) : [...p.locationIds, l.id] })
                  }
                  className="flex-1"
                >
                  {l.name}
                </Chip>
              ))}
            </div>
            <NextButton disabled={p.locationIds.length === 0} onClick={next} />
          </>
        )
      case 'equipment':
        return (
          <>
            {p.locationIds.map((id) => (
              <div key={id} className="mb-3">
                <div className="mb-1.5 text-sm text-muted">{locName(id)}</div>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map((q) => {
                    const on = (equip[id] ?? []).includes(q)
                    return (
                      <Chip key={q} selected={on} onClick={() => setEquip((e) => ({ ...e, [id]: on ? e[id].filter((x) => x !== q) : [...(e[id] ?? []), q] }))}>
                        {EQUIP_LABEL(q)}
                      </Chip>
                    )
                  })}
                </div>
              </div>
            ))}
            <NextButton onClick={next} />
          </>
        )
      case 'lifts':
        return (
          <>
            <div className="flex flex-col gap-3">
              {LIFTS.map(([id, name]) => {
                const b = p.baselines[id]
                const setB = (v: { kg: number; reps: number } | undefined) => {
                  const baselines = { ...p.baselines }
                  if (v) baselines[id] = v
                  else delete baselines[id]
                  set({ baselines })
                }
                return (
                  <div key={id} className="rounded-xl bg-surface-2 p-2">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex-1 font-medium">{name}</span>
                      <Chip selected={!b} onClick={() => setB(undefined)}>
                        Not sure
                      </Chip>
                      <Chip
                        selected={!!b}
                        onClick={() => setPad({ label: `${name}: kg`, initial: b?.kg, onDone: (kg) => kg > 0 && setB({ kg, reps: b?.reps ?? 5 }) })}
                        className="min-w-20 num"
                      >
                        {b ? `${b.kg} kg` : 'Enter kg'}
                      </Chip>
                    </div>
                    {b && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted">for</span>
                        {REPS.map((r) => (
                          <Chip key={r} selected={b.reps === r} onClick={() => setB({ ...b, reps: r })} className="flex-1 num">
                            {r}
                          </Chip>
                        ))}
                        <span className="text-sm text-muted">reps</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <NextButton onClick={next} />
          </>
        )
      case 'pullups':
        return (
          <Choices
            options={PULLUPS.map(([label, v]) => [String(v), label])}
            value={String(p.pullUps)}
            onPick={(v) => {
              set({ pullUps: v === 'null' ? null : Number(v) })
              next()
            }}
          />
        )
      case 'avoid':
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <Chip selected={p.avoidAreas.length === 0} onClick={() => set({ avoidAreas: [] })}>
                Nothing
              </Chip>
              {BODY_AREAS.map((a) => (
                <Chip
                  key={a}
                  selected={p.avoidAreas.includes(a)}
                  onClick={() => set({ avoidAreas: p.avoidAreas.includes(a) ? p.avoidAreas.filter((x) => x !== a) : [...p.avoidAreas, a] })}
                >
                  {AREA_LABEL[a]}
                </Chip>
              ))}
            </div>
            {p.avoidAreas.length > 0 && (
              <input
                placeholder="What should I know? (optional)"
                value={p.avoidNote}
                onChange={(e) => set({ avoidNote: e.target.value })}
                className="mt-3 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none"
              />
            )}
            <p className="mt-2 text-sm text-muted">I leave out exercises that load these areas. For pain on a given day, you tell me at the check-in.</p>
            <NextButton onClick={next} />
          </>
        )
      case 'running':
        return (
          <>
            <div className="flex gap-2">
              <Chip selected={p.running.runs} onClick={() => set({ running: { ...p.running, runs: true } })} className="flex-1">
                Yes
              </Chip>
              <Chip selected={!p.running.runs} onClick={() => set({ running: { ...p.running, runs: false } })} className="flex-1">
                No
              </Chip>
            </div>
            {p.running.runs && (
              <>
                <div className="mt-3 mb-1.5 text-sm text-muted">Longest run in the last month</div>
                <div className="flex flex-wrap gap-2">
                  {[0, 3, 5, 8, 10, 15, 21].map((km) => (
                    <Chip key={km} selected={p.running.longestKm === km} onClick={() => set({ running: { ...p.running, longestKm: km } })} className="num">
                      {km === 0 ? 'None' : `${km} km`}
                    </Chip>
                  ))}
                  <Chip
                    selected={![0, 3, 5, 8, 10, 15, 21].includes(p.running.longestKm)}
                    onClick={() => setPad({ label: 'Longest run, km', initial: p.running.longestKm, onDone: (km) => set({ running: { ...p.running, longestKm: km } }) })}
                  >
                    Other
                  </Chip>
                </div>
                <div className="mt-3 mb-1.5 text-sm text-muted">Runs you’d like per week</div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Chip key={n} selected={p.running.perWeek === n} onClick={() => set({ running: { ...p.running, perWeek: n } })} className="flex-1 num">
                      {n}
                    </Chip>
                  ))}
                </div>
              </>
            )}
            <NextButton onClick={next} />
          </>
        )
      case 'note':
        return (
          <>
            <textarea
              rows={3}
              placeholder="For example: “I prefer dumbbells for pressing” or “Mondays are short”"
              value={p.note}
              onChange={(e) => set({ note: e.target.value })}
              className="w-full rounded-xl border border-line bg-surface-2 p-3 outline-none"
            />
            <NextButton label={p.note ? 'Next' : 'Skip'} onClick={next} />
          </>
        )
      case 'summary':
        return (
          <>
            <ul className="mb-4 flex list-disc flex-col gap-2 pl-5">
              {coachingSummary(p, p.locationIds.map(locName)).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <Button variant="primary" big onClick={() => finish('/checkin')}>
                Start training
              </Button>
              <Button onClick={() => finish('/')}>{editing ? 'Done' : 'Done for now'}</Button>
            </div>
          </>
        )
    }
  }

  // Editing shows every question (the first message becomes the "tap to change" hint).
  const visible = editing ? STEPS : STEPS.slice(0, step + 1)

  return (
    <div className="flex min-h-full flex-col">
      <Header title={editing ? 'Coach setup' : 'Meet your coach'} onBack={() => navigate('/', true)} />
      <div className="flex flex-col gap-3 px-4 py-4">
        {visible.map((id) => {
          const i = STEPS.indexOf(id)
          const isCurrent = editing ? id === STEPS[step] : i === step
          return (
            <div key={id} ref={isCurrent ? currentRef : undefined} className="flex scroll-mt-20 flex-col gap-2">
              <Bubble from="coach">{ask[id]}</Bubble>
              {isCurrent ? (
                <div className="rounded-2xl border border-target/50 p-3">{controls(id)}</div>
              ) : (
                answer[id] && (
                  <button
                    onClick={() => setStep(i)}
                    className="ml-auto flex min-h-12 max-w-[90%] items-center gap-2 text-right active:opacity-70"
                    aria-label={`Change: ${ask[id]}`}
                  >
                    <Bubble from="me">{answer[id]}</Bubble>
                    {editing && <span className="shrink-0 text-sm text-target underline underline-offset-4">Change</span>}
                  </button>
                )
              )}
            </div>
          )
        })}
      </div>
      <NumberPad
        open={!!pad}
        label={pad?.label ?? ''}
        initial={pad?.initial}
        suggestions={[]}
        allowNegative={false}
        onClose={() => setPad(null)}
        onDone={(n) => {
          if (n !== undefined) pad?.onDone(n)
          setPad(null)
        }}
      />
    </div>
  )
}

function Bubble({ from, children }: { from: 'coach' | 'me'; children: ReactNode }) {
  return from === 'coach' ? (
    <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-surface px-4 py-3">{children}</div>
  ) : (
    <div className="inline-block rounded-2xl rounded-tr-sm bg-target/20 px-4 py-2 text-ink">{children}</div>
  )
}

function Choices({ options, value, onPick }: { options: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([v, label]) => (
        <Chip key={v} selected={value === v} onClick={() => onPick(v)} className="flex-1 whitespace-nowrap">
          {label}
        </Chip>
      ))}
    </div>
  )
}

function NextButton({ onClick, disabled, label = 'Next' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <Button variant="primary" className="mt-3 w-full" disabled={disabled} onClick={onClick}>
      {label}
    </Button>
  )
}
