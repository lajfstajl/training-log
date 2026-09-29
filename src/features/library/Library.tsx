import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { db } from '../../db/schema'
import { config } from '../../engine/config'
import { PATTERNS, type Exercise } from '../../engine/types'
import { PATTERN_LABEL, uuid } from '../../lib/format'
import { back, navigate } from '../../router'
import { Button, Chip, Header } from '../../ui'

export function Library() {
  const [q, setQ] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const all = useLiveQuery(() => db.exercises.orderBy('name').toArray(), []) ?? []
  const list = all.filter((e) => e.trackingType !== 'run' && e.archived === showArchived && (!q || e.name.toLowerCase().includes(q.toLowerCase())))

  const create = async () => {
    const now = Date.now()
    const id = uuid()
    const ex: Exercise = {
      id,
      name: 'New exercise',
      trackingType: 'weight_reps',
      pattern: 'isolation',
      primaryMuscles: [],
      secondaryMuscles: [],
      equipment: [],
      rangeMin: config.r1.accessory.repMin,
      rangeMax: config.r1.accessory.repMax,
      targetRir: config.r1.accessory.defaultRir as Exercise['targetRir'],
      increment: 2.5,
      progressionMode: 'load',
      isMainLift: false,
      unilateral: false,
      defaultRestSec: config.logging.restSec.accessory,
      defaultWorkingSets: config.logging.workingSets.accessory,
      archived: false,
      createdAt: now,
      updatedAt: now,
    }
    await db.exercises.add(ex)
    navigate(`/settings/exercises/${id}`)
  }

  return (
    <div>
      <Header title="Exercise library" onBack={() => back('/settings')} right={<Button onClick={create}>+ New</Button>} />
      <div className="px-4 py-3">
        <input
          type="search"
          placeholder="Search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="mb-3 h-12 w-full rounded-xl border border-line bg-surface-2 px-3 outline-none"
        />
        <div className="mb-4 flex gap-2">
          <Chip selected={!showArchived} onClick={() => setShowArchived(false)}>
            Active
          </Chip>
          <Chip selected={showArchived} onClick={() => setShowArchived(true)}>
            Archived
          </Chip>
        </div>
        {PATTERNS.map((p) => {
          const group = list.filter((e) => e.pattern === p)
          if (group.length === 0) return null
          return (
            <section key={p} className="mb-4">
              <h2 className="mb-1 text-sm font-semibold text-muted">{PATTERN_LABEL[p]}</h2>
              <ul className="divide-y divide-line rounded-2xl bg-surface px-3">
                {group.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => navigate(`/settings/exercises/${e.id}`)} className="flex min-h-12 w-full items-center justify-between gap-2 text-left">
                      <span>
                        {e.name}
                        {e.isMainLift && <span className="ml-2 text-xs text-target">main</span>}
                      </span>
                      <span className="text-xs text-muted num">
                        {e.rangeMin}–{e.rangeMax}
                        {e.trackingType === 'timed_hold' ? ' s' : ''} @ {e.targetRir}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
