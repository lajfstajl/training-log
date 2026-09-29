import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../../db/schema'
import { ENGINE_VERSION } from '../../engine/config'
import { fmtDate } from '../../lib/format'
import { navigate } from '../../router'
import { BackupNowButton, RestoreButton } from '../backup/BackupControls'
import { AiCoachSettings } from './AiCoachSettings'

export function SettingsTab() {
  const lastExportAt = useLiveQuery(async () => (await db.settings.get('lastExportAt'))?.value as number | undefined, [])
  const [persisted, setPersisted] = useState<boolean>()

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {})
  }, [])

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
          Your data lives only on this phone. Last backup: {lastExportAt ? fmtDate(lastExportAt) : 'never'}. Save it to iCloud Drive with the
          share sheet.
        </p>
        <div className="flex flex-col gap-2">
          <BackupNowButton label="Back up to iCloud Drive" />
          <RestoreButton />
        </div>
        <div className="mt-2">
          <Row label="Move to a new phone" hint="Step-by-step guide" onClick={() => navigate('/settings/move')} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Storage {persisted === undefined ? 'status unknown' : persisted ? 'is persistent' : 'may be cleared by the browser; back up regularly'}.
        </p>
      </Section>

      <p className="mt-6 mb-4 text-center text-xs text-muted">
        Training Log {__APP_VERSION__} · engine {ENGINE_VERSION}
      </p>

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
