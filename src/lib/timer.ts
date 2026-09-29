// Rest timer maths. State is only timestamps, so a killed app resumes exactly.

export interface RestState {
  restEndsAt?: number
  restTotalSec?: number
}

export function remainingSec(state: RestState, now: number): number | undefined {
  if (state.restEndsAt === undefined) return undefined
  return Math.max(0, Math.ceil((state.restEndsAt - now) / 1000))
}

export function startRest(totalSec: number, now: number): Required<RestState> {
  return { restEndsAt: now + totalSec * 1000, restTotalSec: totalSec }
}

/** Adds (or removes) seconds. Never ends before `now`. */
export function adjustRest(state: RestState, deltaSec: number, now: number): RestState {
  if (state.restEndsAt === undefined) return state
  const endsAt = Math.max(now, state.restEndsAt + deltaSec * 1000)
  return { restEndsAt: endsAt, restTotalSec: Math.max(0, (state.restTotalSec ?? 0) + deltaSec) }
}

export function formatClock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
