import { useLiveQuery } from 'dexie-react-hooks'
import { useRef, useState } from 'react'
import { backupStatus, parseBackup, restoreBackup, shareBackup, snoozeBackupReminder, type ParseResult } from '../../db/backup'
import { fmtDate } from '../../lib/format'
import { navigate } from '../../router'
import { Button, Sheet } from '../../ui'

// Backup and restore building blocks, used in Settings, the "new phone" guide, Today, and first launch.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const RESULT_TEXT = {
  shared: 'Backup done. If you chose “Save to Files”, it is in iCloud Drive.',
  downloaded: 'Backup file downloaded.',
  cancelled: 'Backup cancelled, nothing was saved.',
} as const

export function BackupNowButton({
  label = 'Back up now',
  variant = 'primary',
  big,
  onDone,
}: {
  label?: string
  variant?: 'primary' | 'secondary'
  big?: boolean
  onDone?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<keyof typeof RESULT_TEXT>()
  return (
    <div>
      <Button
        variant={variant}
        big={big}
        className="w-full"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const r = await shareBackup()
            setResult(r)
            if (r !== 'cancelled') onDone?.()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Preparing backup…' : label}
      </Button>
      {result && <p className={`mt-2 text-sm ${result === 'cancelled' ? 'text-muted' : 'text-good'}`}>{RESULT_TEXT[result]}</p>}
    </div>
  )
}

/** Pick a backup file (from Files / iCloud Drive), preview it, then replace this device's data. */
export function RestoreButton({ label = 'Restore from a backup…', variant = 'secondary' }: { label?: string; variant?: 'primary' | 'secondary' }) {
  const [preview, setPreview] = useState<ParseResult>()
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const status = useLiveQuery(() => backupStatus(), [])

  const onFile = async (f: File | undefined) => {
    if (!f) return
    setPreview(parseBackup(await f.text()))
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <Button variant={variant} className="w-full" onClick={() => fileRef.current?.click()}>
        {label}
      </Button>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <Sheet open={!!preview} onClose={() => setPreview(undefined)} title="Restore backup">
        {preview && !preview.ok && <p className="text-bad">{preview.error}</p>}
        {preview?.ok && (
          <>
            <p className="mb-2 text-sm text-muted">Backup from {fmtDate(preview.backup.exportedAt)}. It contains:</p>
            <ul className="mb-4 text-sm num">
              <li>
                {plural(preview.counts.sessions, 'session')} and {plural(preview.counts.runs, 'run')}
              </li>
              <li>{plural(preview.counts.sets, 'set')}</li>
              <li>your coach setup and {preview.counts.exercises} exercises</li>
            </ul>
            {status?.hasData ? (
              <p className="mb-4 rounded-xl border border-warn/50 p-3 text-sm text-warn">
                This replaces everything on this device. Back up first if you want to keep what is here now.
              </p>
            ) : (
              <p className="mb-4 text-sm text-muted">This device has no training data yet, so nothing is lost.</p>
            )}
            <p className="mb-4 text-sm text-muted">The AI coach key is not in backups. Paste it again in Settings → AI coach.</p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => setPreview(undefined)}>
                Cancel
              </Button>
              <Button
                variant={status?.hasData ? 'danger' : 'primary'}
                className="flex-1"
                disabled={busy}
                onClick={async () => {
                  setBusy(true)
                  try {
                    await restoreBackup(preview.backup)
                    setPreview(undefined)
                    navigate('/', true)
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {status?.hasData ? 'Replace my data' : 'Restore'}
              </Button>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}

/** Gentle nudge on Today when there is data and no recent backup. */
export function BackupReminder() {
  const status = useLiveQuery(() => backupStatus(), [])
  // After a successful backup, confirm it here instead of silently disappearing.
  const [done, setDone] = useState(false)
  if (done) {
    return (
      <div className="mb-4 rounded-2xl border border-good/40 bg-surface p-4">
        <p className="font-semibold text-good">Backup done</p>
        <p className="mt-1 text-sm text-muted">If you chose “Save to Files”, it is in iCloud Drive. I’ll remind you again in a week.</p>
      </div>
    )
  }
  if (!status?.due || status.snoozed) return null
  return (
    <div className="mb-4 rounded-2xl border border-line bg-surface p-4">
      <p className="font-semibold">Time for a backup</p>
      <p className="mt-1 text-sm text-muted">
        {status.lastExportAt ? `Last backup ${fmtDate(status.lastExportAt)}.` : 'No backup yet.'} Your training lives only on this phone; a backup in
        iCloud Drive keeps it safe.
      </p>
      <div className="mt-3 flex gap-2">
        <div className="flex-1">
          <BackupNowButton onDone={() => setDone(true)} />
        </div>
        <Button variant="ghost" className="text-muted" onClick={() => snoozeBackupReminder()}>
          Later
        </Button>
      </div>
    </div>
  )
}
