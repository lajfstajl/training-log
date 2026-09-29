import type { ReactNode } from 'react'
import type { RunType } from './engine/types'
import { MovePhone } from './features/backup/MovePhone'
import { Checkin } from './features/coach/Checkin'
import { Onboarding } from './features/coach/Onboarding'
import { Preview } from './features/coach/Preview'
import { LogRun } from './features/runs/LogRun'
import { HistoryList } from './features/history/HistoryList'
import { SessionDetail } from './features/history/SessionDetail'
import { ExerciseEdit } from './features/library/ExerciseEdit'
import { Library } from './features/library/Library'
import { ProgressTab } from './features/progress/ProgressTab'
import { ActiveSession } from './features/session/ActiveSession'
import { FinishSummary } from './features/session/FinishSummary'
import { NewSession } from './features/session/NewSession'
import { MethodsDoc } from './features/settings/MethodsDoc'
import { SettingsTab } from './features/settings/SettingsTab'
import { TodayTab } from './features/today/TodayTab'
import { match, navigate, useRoute } from './router'
import { ConfirmHost } from './ui/confirm'

// Simple stroke icons (text symbols like ⚙ render as coloured emoji on iPhone).
const icon = (d: ReactNode) => (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d}
  </svg>
)

const TABS = [
  { path: '/', label: 'Today', icon: icon(<><path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11" /></>) },
  { path: '/history', label: 'History', icon: icon(<><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>) },
  { path: '/progress', label: 'Progress', icon: icon(<path d="M4 19l5-6 4 3 7-9" />) },
  { path: '/settings', label: 'Settings', icon: icon(<><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>) },
]

function Screen({ path }: { path: string }) {
  let m: Record<string, string> | null

  // Full screen routes without the tab bar
  if (path === '/welcome') return <Onboarding />
  if (path === '/checkin') return <Checkin />
  if ((m = match('/plan/:id', path))) return <Preview key={m.id} checkinId={m.id} />
  if (path === '/run/new') return <LogRun />
  if ((m = match('/run/new/:type', path))) return <LogRun type={m.type as RunType} />
  if ((m = match('/run/new/:type/:suggestionId', path))) return <LogRun type={m.type as RunType} suggestionId={m.suggestionId} />
  if ((m = match('/run/:id', path))) return <LogRun key={m.id} runId={m.id} />
  if (path === '/session/new') return <NewSession />
  if ((m = match('/session/:id', path))) return <ActiveSession key={m.id} sessionId={m.id} mode="live" />
  if ((m = match('/session/:id/edit', path))) return <ActiveSession key={m.id} sessionId={m.id} mode="edit" />
  if ((m = match('/session/:id/summary', path))) return <FinishSummary sessionId={m.id} />

  let page
  if ((m = match('/history/:id', path))) page = <SessionDetail sessionId={m.id} />
  else if (path.startsWith('/history')) page = <HistoryList />
  else if (path === '/progress') page = <ProgressTab />
  else if (path === '/settings/exercises') page = <Library />
  else if ((m = match('/settings/exercises/:id', path))) page = <ExerciseEdit exerciseId={m.id} />
  else if (path === '/settings/methods') page = <MethodsDoc />
  else if (path === '/settings/move') page = <MovePhone />
  else if (path.startsWith('/settings')) page = <SettingsTab />
  else page = <TodayTab />

  const activeTab = TABS.slice(1).find((t) => path.startsWith(t.path))?.path ?? '/'

  return (
    <div className="flex min-h-full flex-col">
      <main className="flex-1 pb-24">{page}</main>
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          {TABS.map((t) => (
            <button
              key={t.path}
              onClick={() => navigate(t.path)}
              aria-current={activeTab === t.path ? 'page' : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${activeTab === t.path ? 'text-ink' : 'text-muted'}`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export default function App() {
  const path = useRoute()
  return (
    <>
      <Screen path={path} />
      <ConfirmHost />
    </>
  )
}
