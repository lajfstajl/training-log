import { useSyncExternalStore } from 'react'

// Tiny hash router: "#/session/abc" → "/session/abc". Hash routing works on GitHub Pages without rewrites.

function read(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h === '' ? '/' : h
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): string {
  return useSyncExternalStore(subscribe, read)
}

export function navigate(path: string, replace = false) {
  const url = `#${path}`
  if (replace) window.location.replace(url)
  else window.location.hash = path
}

export function back(fallback = '/') {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback, true)
}

/** Matches "/session/:id" style patterns. Returns params or null. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/')
  const a = path.split('/')
  if (p.length !== a.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(a[i])
    else if (p[i] !== a[i]) return null
  }
  return params
}
