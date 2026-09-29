import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { backupStatus } from '../../db/backup'
import { fmtDate } from '../../lib/format'
import { back } from '../../router'
import { Header } from '../../ui'
import { BackupNowButton, RestoreButton } from './BackupControls'

/** Step-by-step guide for moving to a new phone, with the backup and restore buttons in place. */
export function MovePhone() {
  const status = useLiveQuery(() => backupStatus(), [])
  const appUrl = typeof window !== 'undefined' ? window.location.href.split('#')[0] : ''

  return (
    <div>
      <Header title="Move to a new phone" onBack={() => back('/settings')} />
      <div className="flex flex-col gap-6 px-4 py-4">
        <p className="text-muted">
          Your training lives only on this phone. Moving takes about five minutes: make a backup in iCloud Drive on the old phone, install the app on
          the new one, and restore it there.
        </p>

        <Part title="On the old phone">
          <Step n={1} title="Make a fresh backup">
            <p>
              Tap the button, then choose <b>Save to Files</b> → <b>iCloud Drive</b> → <b>Save</b>.
            </p>
            <p className="text-sm text-muted">
              Last backup: {status?.lastExportAt ? fmtDate(status.lastExportAt) : 'none yet'}.
            </p>
            <BackupNowButton label="Back up to iCloud Drive" />
          </Step>
          <Step n={2} title="Check it is there">
            <p>
              Open the <b>Files</b> app → <b>iCloud Drive</b>. You should see <span className="num">training-log-(date).json</span>.
            </p>
          </Step>
          <Step n={3} title="Train on the old phone? Back up again">
            <p>If you log anything on the old phone after the backup, repeat step 1 before switching. The newest file is the one to restore.</p>
          </Step>
        </Part>

        <Part title="On the new phone">
          <Step n={4} title="Install the app">
            <p>
              Open <b>Safari</b> and go to <span className="break-all text-target">{appUrl}</span>. Tap <b>Share</b> → <b>Add to Home Screen</b> →{' '}
              <b>Add</b>.
            </p>
          </Step>
          <Step n={5} title="Open it from the home screen icon">
            <p>
              Important: use the <b>icon</b>, not the Safari tab. The icon and Safari keep separate data, and your training should be in the icon.
            </p>
          </Step>
          <Step n={6} title="Restore your backup">
            <p>
              On the first screen, tap <b>Restore from a backup</b> (or come to this page: Settings → Move to a new phone). Pick the newest file in
              iCloud Drive and tap <b>Restore</b>.
            </p>
            <RestoreButton />
          </Step>
          <Step n={7} title="Reconnect the AI coach">
            <p>
              The API key is never in backups. Go to <b>Settings → AI coach</b>, paste your key, and tap <b>Test connection</b>.
            </p>
          </Step>
          <Step n={8} title="Check, then tidy up">
            <p>
              Open <b>History</b> and check your sessions and runs are there. When you are happy, you can delete the app from the old phone.
            </p>
          </Step>
        </Part>
      </div>
    </div>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold text-muted">{title}</h2>
      <ol className="flex flex-col gap-3">{children}</ol>
    </section>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl bg-surface p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold num">{n}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="font-semibold">{title}</div>
        {children}
      </div>
    </li>
  )
}
