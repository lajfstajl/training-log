import { useEffect, useState, type ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'good'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-ink text-bg font-semibold',
  secondary: 'bg-surface-2 text-ink border border-line',
  ghost: 'text-ink',
  danger: 'bg-surface-2 text-bad border border-line',
  good: 'bg-good text-bg font-semibold',
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  big,
  disabled,
  className = '',
  type = 'button',
  ariaLabel,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: Variant
  big?: boolean
  disabled?: boolean
  className?: string
  type?: 'button' | 'submit'
  ariaLabel?: string
}) {
  return (
    <button
      type={type}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={`${VARIANT[variant]} ${big ? 'min-h-14 text-lg' : 'min-h-12'} rounded-xl px-4 active:opacity-70 disabled:border disabled:border-line disabled:bg-surface disabled:font-normal disabled:text-muted disabled:active:opacity-100 ${className}`}
    >
      {children}
    </button>
  )
}

export function Chip({
  children,
  selected,
  onClick,
  className = '',
  tone = 'ink',
}: {
  children: ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
  tone?: 'ink' | 'target'
}) {
  const on = tone === 'target' ? 'bg-target text-bg border-target' : 'bg-ink text-bg border-ink'
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`min-h-12 min-w-12 rounded-xl border px-3 font-medium num ${selected ? on : 'border-line bg-surface-2 text-ink'} active:opacity-70 ${className}`}
    >
      {children}
    </button>
  )
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button aria-label="Close" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[88vh] overflow-y-auto rounded-t-2xl border-t border-line bg-surface p-4 pb-safe">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="flex-1 truncate text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 min-h-12 min-w-12 text-2xl leading-none text-muted">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Header({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="pt-safe sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
      <div className="flex min-h-14 items-center gap-2 px-2">
        {onBack ? (
          <button onClick={onBack} aria-label="Back" className="min-h-12 min-w-12 text-2xl text-muted">
            ‹
          </button>
        ) : (
          <span className="w-2" />
        )}
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        {right}
      </div>
    </header>
  )
}

export interface Suggestion {
  label: string
  value: number
}

/**
 * Number stepper. The value opens a big on-screen number pad (the iPhone decimal keyboard
 * has no Done key and covers the dock). Shows the target in target colour until the user
 * enters their own value, which then shows bold in ink.
 */
export function Stepper({
  label,
  value,
  target,
  step,
  min = -Infinity,
  onChange,
  suggestions = [],
  allowNegative = false,
}: {
  label: string
  value: number | undefined
  target: number | undefined
  step: number
  min?: number
  onChange: (v: number | undefined) => void
  suggestions?: Suggestion[]
  allowNegative?: boolean
}) {
  const [padOpen, setPadOpen] = useState(false)
  // Optimistic value so fast repeated taps build on each other before the DB round trip lands.
  const [local, setLocal] = useState<number>()
  const shown = local ?? value ?? target
  const isActual = local !== undefined || value !== undefined

  useEffect(() => {
    if (local !== undefined && value === local) setLocal(undefined)
  }, [value, local])

  const set = (n: number) => {
    setLocal(n)
    onChange(n)
  }

  const bump = (d: number) => set(Math.max(min, Math.round(((shown ?? 0) + d) * 100) / 100))

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <span className="mb-1 text-sm text-muted">{label}</span>
      <div className="flex h-14 items-stretch overflow-hidden rounded-xl border border-line bg-surface-2">
        <button aria-label={`Decrease ${label}`} onClick={() => bump(-step)} className="w-12 shrink-0 text-2xl text-muted active:bg-line">
          −
        </button>
        <button
          aria-label={`${label}: ${shown ?? 'empty'}. Tap to enter`}
          onClick={() => setPadOpen(true)}
          className={`m-1 w-full min-w-0 rounded-lg bg-bg/60 text-center text-2xl num underline decoration-dotted decoration-muted/60 underline-offset-4 ${
            isActual ? 'font-bold text-ink' : 'text-target'
          }`}
        >
          {shown ?? '?'}
        </button>
        <button aria-label={`Increase ${label}`} onClick={() => bump(step)} className="w-12 shrink-0 text-2xl text-muted active:bg-line">
          +
        </button>
      </div>
      <NumberPad
        open={padOpen}
        label={label}
        initial={shown}
        suggestions={suggestions}
        allowNegative={allowNegative}
        onClose={() => setPadOpen(false)}
        onDone={(n) => {
          setPadOpen(false)
          if (n !== undefined) set(Math.max(min, n))
        }}
      />
    </div>
  )
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

/** Full-width number pad in a bottom sheet. Big keys, a Done button, and one-tap suggestions. */
export function NumberPad({
  open,
  label,
  initial,
  suggestions,
  allowNegative,
  onClose,
  onDone,
}: {
  open: boolean
  label: string
  initial: number | undefined
  suggestions: Suggestion[]
  allowNegative: boolean
  onClose: () => void
  onDone: (n: number | undefined) => void
}) {
  // Start empty so typing replaces the value; the old value shows as a placeholder.
  const [text, setText] = useState('')
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setText('')
  }

  const press = (k: string) => {
    if (k === '⌫') return setText((t) => t.slice(0, -1))
    if (k === '.' && text.includes('.')) return
    if (text.replace('-', '').length >= 6) return
    setText((t) => (t === '' && k === '.' ? '0.' : t + k))
  }
  const parsed = text === '' || text === '-' ? undefined : Number(text)

  return (
    <Sheet open={open} onClose={onClose} title={label}>
      <div className="mb-3 flex h-16 items-center justify-center rounded-xl bg-surface-2 text-4xl font-bold num">
        {text !== '' ? text : <span className="text-muted">{initial ?? '–'}</span>}
      </div>
      {suggestions.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Chip key={s.label} onClick={() => onDone(s.value)} className="flex-1 whitespace-nowrap">
              {s.label}
            </Chip>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((k) => (
          <button key={k} onClick={() => press(k)} className="h-14 rounded-xl bg-surface-2 text-2xl font-medium active:bg-line num">
            {k}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {allowNegative && (
          <Button onClick={() => setText((t) => (t.startsWith('-') ? t.slice(1) : `-${t}`))} className="w-20">
            ±
          </Button>
        )}
        <Button variant="good" big className="flex-1" onClick={() => onDone(parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined)}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}

/** Target value styling: outlined in the target colour. */
export function TargetPill({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded-md border border-target/60 px-1.5 py-0.5 text-sm text-target num">{children}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-muted">{children}</p>
}
