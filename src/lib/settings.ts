import { normalizeRouteScope } from './boroughs'
import { normalizeLineCount } from './puzzle'
import type { Settings } from './types'

const KEY = 'transfer-nyc:settings'

const defaults: Settings = {
  showStatusBadges: true,
  darkMode: true,
  routeScope: 'manhattan',
  lineCount: 3,
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
      lineCount: normalizeLineCount(parsed.lineCount),
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
