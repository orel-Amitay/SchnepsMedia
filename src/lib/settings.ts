import type { Settings } from './types'

const KEY = 'subwaydle-nyc:settings'

const defaults: Settings = {
  showStatusBadges: true,
  darkMode: true,
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...defaults }
    return { ...defaults, ...(JSON.parse(raw) as Settings) }
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
