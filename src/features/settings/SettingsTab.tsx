import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { downloadBackup, parseBackup, restoreBackup, type ParseResult } from '../../db/backup'
import { db } from '../../db/schema'
import { ENGINE_VERSION } from '../../engine/config'
import { fmtDate } from '../../lib/format'
import { navigate } from '../../router'
import { Button, Sheet } from '../../ui'
import { AiCoachSettings } from './AiCoachSettings'

export function SettingsTab() {
  const lastExportAt = useLiveQuery(async () => (await db.settings.get('lastExportAt'))?.value as number | undefined, [])
  const [persisted, setPersisted] = useState<boolean>()
  const [preview, setPreview] = useState<ParseResult>()
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setPreview(parseBackup(await f.text()))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="pt-safe px-4">
      <h1 className="pt-6 pb-4 text-2xl font-bold">Settings</h1>

      <Section title="Training">
        <Row label="Coach setup" hint="Goals, where you train, starting weights, running" onClick={() => navigate('/welcome')} />
        <Row label="Exercise library" onClick={() => navigate('/settings/exercises')} />
        <Row label="Coaching methods" hint="Rules, sources and evidence" onClick={() => navigate('/settings/methods')} />
      </Section>

      <Section title="AI coach">
        <AiCoachSettings />
      </Section>

      <Section title="Backup">
        <p className="mb-3 text-sm text-muted">
          Your data lives only on this device. Last export: {lastExportAt ? fmtDate(lastExportAt) : 'never'}.
        </p>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => downloadBackup()}>
            Export JSON
          </Button>
          <Button className="flex-1" onClick={() => fileRef.current?.click()}>
            Import…
          </Button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="mt-3 text-xs text-muted">
          Storage {persisted === undefined ? 'status unknown' : persisted ? 'is persistent' : 'may be cleared by the browser; export regularly'}.
        </p>
      </Section>

      <p className="mt-6 mb-4 text-center text-xs text-muted">
        Training Log {__APP_VERSION__} · engine {ENGINE_VERSION}
      </p>

      <Sheet open={!!preview} onClose={() => setPreview(undefined)} title="Import backup">
        {preview && !preview.ok && <p className="text-bad">{preview.error}</p>}
        {preview?.ok && (
          <>
            <p className="mb-2 text-sm text-muted">Exported {fmtDate(preview.backup.exportedAt)}. It contains:</p>
            <ul className="mb-4 text-sm num">
              <li>{preview.counts.sessions} sessions</li>
              <li>{preview.counts.sets} sets</li>
              <li>{preview.counts.exercises} exercises</li>
            </ul>
            <p className="mb-4 rounded-xl border border-warn/50 p-3 text-sm text-warn">
              Importing replaces all data on this device. Export first if you want to keep what is here now.
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setPreview(undefined)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={async () => {
                  await restoreBackup(preview.backup)
                  setPreview(undefined)
                  navigate('/', true)
                }}
              >
                Replace my data
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-muted">{title}</h2>
      <div className="rounded-2xl bg-surface p-3">{children}</div>
    </section>
  )
}

function Row({ label, hint, onClick }: { label: string; hint?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex min-h-12 w-full items-center justify-between text-left active:opacity-70">
      <span>
        {label}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <span className="text-muted">›</span>
    </button>
  )
}
