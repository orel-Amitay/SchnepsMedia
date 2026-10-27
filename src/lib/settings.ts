import { normalizeRouteScope } from './boroughs'
import type { Settings } from './types'

const KEY = 'transfer-nyc:settings'

const defaults: Settings = {
  showStatusBadges: true,
  darkMode: true,
  routeScope: 'manhattan',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...defaults,
      ...parsed,
      routeScope: normalizeRouteScope(parsed.routeScope),
    }
  } catch {
    return { ...defaults }
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    // ignore
  }
}
