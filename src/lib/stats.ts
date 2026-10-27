import type { Stats } from './types'

const KEY = 'transfer-nyc:stats'

const empty = (): Stats => ({
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  guessDistribution: [0, 0, 0, 0, 0, 0],
  lastDateKey: null,
})

export function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return empty()
    return { ...empty(), ...(JSON.parse(raw) as Stats) }
  } catch {
    return empty()
  }
}

export function saveStats(stats: Stats): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stats))
  } catch {
    // ignore
  }
}

export function recordFinish(opts: {
  dateKey: string
  won: boolean
  guesses: number
}): Stats {
  const stats = loadStats()
  if (stats.lastDateKey === opts.dateKey) return stats

  stats.played += 1
  stats.lastDateKey = opts.dateKey
  if (opts.won) {
    stats.wins += 1
    stats.currentStreak += 1
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak)
    const idx = Math.min(Math.max(opts.guesses, 1), 6) - 1
    stats.guessDistribution[idx] = (stats.guessDistribution[idx] ?? 0) + 1
  } else {
    stats.currentStreak = 0
  }
  saveStats(stats)
  return stats
}
