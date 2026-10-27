import type { LineId } from './types'

const PREFIX = 'subwaydle-nyc:v3:'

export type DayState = {
  dateKey: string
  guesses: LineId[][]
  status: 'playing' | 'won' | 'lost'
}

export function loadDay(dateKey: string): DayState | null {
  try {
    const raw = localStorage.getItem(PREFIX + dateKey)
    if (!raw) return null
    return JSON.parse(raw) as DayState
  } catch {
    return null
  }
}

export function saveDay(state: DayState): void {
  try {
    localStorage.setItem(PREFIX + state.dateKey, JSON.stringify(state))
  } catch {
    // ignore quota / private mode
  }
}

export function clearDay(dateKey: string): void {
  try {
    localStorage.removeItem(PREFIX + dateKey)
  } catch {
    // ignore
  }
}
