import { useSyncExternalStore } from 'react'
import { Button, Sheet } from '.'

// In-app confirmation sheet, replacing window.confirm (which looks foreign in the installed app).
// Usage: if (await askConfirm({ title, body, confirm: 'Delete', danger: true })) { ... }

interface Request {
  title: string
  body?: string
  confirm: string
  cancel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

let current: Request | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export function askConfirm(opts: Omit<Request, 'resolve'>): Promise<boolean> {
  current?.resolve(false)
  return new Promise((resolve) => {
    current = { ...opts, resolve }
    emit()
  })
}

function settle(ok: boolean) {
  const r = current
  current = null
  emit()
  r?.resolve(ok)
}

export function ConfirmHost() {
  const req = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
  return (
    <Sheet open={!!req} onClose={() => settle(false)} title={req?.title}>
      {req?.body && <p className="mb-4 text-muted">{req.body}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => settle(false)}>
          {req?.cancel ?? 'Cancel'}
        </Button>
        <Button variant={req?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => settle(true)}>
          {req?.confirm}
        </Button>
      </div>
    </Sheet>
  )
}
