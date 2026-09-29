import { useRef } from 'react'
import { startSession } from '../../db/repo'
import { navigate } from '../../router'
import { Header } from '../../ui'
import { ExercisePicker } from './ExercisePicker'

/** Start training: pick the first exercise, and only then create the session (no empty "ghost" sessions). */
export function NewSession() {
  // The picker calls onPick and then onClose; don't navigate home while the session is being created.
  const picking = useRef(false)
  return (
    <div className="flex h-full flex-col">
      <Header title="New session" onBack={() => navigate('/', true)} />
      <ExercisePicker
        open
        title="First exercise"
        onClose={() => !picking.current && navigate('/', true)}
        onPick={async (exId) => {
          picking.current = true
          const id = await startSession([exId])
          navigate(`/session/${id}`, true)
        }}
      />
    </div>
  )
}
