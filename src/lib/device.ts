import { useEffect } from 'react'

/** Keeps the screen on while `active`. Re-acquires after the tab becomes visible again. Silent where unsupported. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | undefined
    let cancelled = false
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen')
        if (cancelled) lock?.release()
      } catch {
        // Not allowed (low battery, unsupported standalone mode). Ignore.
      }
    }
    const onVis = () => document.visibilityState === 'visible' && acquire()
    acquire()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [active])
}

// iOS has no navigator.vibrate and no background timers, so the rest alert is a short beep
// while the app is in the foreground. The AudioContext must be unlocked by a tap first.
let ctx: AudioContext | undefined

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    // no audio
  }
}

export function beep() {
  if (!ctx || ctx.state !== 'running') return
  const t = ctx.currentTime
  for (const [start, freq] of [
    [0, 880],
    [0.18, 1175],
  ] as const) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, t + start)
    gain.gain.exponentialRampToValueAtTime(0.3, t + start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.15)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t + start)
    osc.stop(t + start + 0.16)
  }
  navigator.vibrate?.(200)
}
