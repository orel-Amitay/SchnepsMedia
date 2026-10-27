import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import type { AnalyticsEvent } from './analytics'
import { fetchRecentEvents, loadLocalEvents } from './analytics'
import { getDb } from './firebase'
import type { LeaderboardEntry } from './leaderboard'
import { dateKeyUTC } from './rng'

export type MetricsSnapshot = {
  generatedAt: number
  todayKey: string
  source: 'local' | 'mixed'
  totals: {
    events: number
    pageViews: number
    signIns: number
    games: number
    wins: number
    losses: number
    winRate: number
    newRoutes: number
    shares: number
    uniquePlayers: number
  }
  today: {
    events: number
    pageViews: number
    signIns: number
    games: number
    wins: number
    losses: number
    winRate: number
    newRoutes: number
    uniquePlayers: number
  }
  guessDistribution: number[]
  topPlayers: Array<{ uid: string; name: string; wins: number; games: number }>
  recent: AnalyticsEvent[]
  leaderboardToday: LeaderboardEntry[]
}

function emptyDist() {
  return [0, 0, 0, 0, 0, 0]
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(fallback), ms)
    promise
      .then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        window.clearTimeout(timer)
        resolve(fallback)
      })
  })
}

function aggregate(
  events: AnalyticsEvent[],
  todayKey: string,
): Omit<MetricsSnapshot, 'generatedAt' | 'todayKey' | 'leaderboardToday' | 'recent' | 'source'> {
  const totals = {
    events: events.length,
    pageViews: 0,
    signIns: 0,
    games: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    newRoutes: 0,
    shares: 0,
    uniquePlayers: 0,
  }
  const today = {
    events: 0,
    pageViews: 0,
    signIns: 0,
    games: 0,
    wins: 0,
    losses: 0,
    winRate: 0,
    newRoutes: 0,
    uniquePlayers: 0,
  }
  const guessDistribution = emptyDist()
  const players = new Map<string, { name: string; wins: number; games: number }>()
  const allUids = new Set<string>()
  const todayUids = new Set<string>()

  for (const e of events) {
    const isToday = e.dateKey === todayKey
    if (isToday) today.events += 1
    if (e.uid) {
      allUids.add(e.uid)
      if (isToday) todayUids.add(e.uid)
    }

    switch (e.type) {
      case 'page_view':
        totals.pageViews += 1
        if (isToday) today.pageViews += 1
        break
      case 'sign_in':
        totals.signIns += 1
        if (isToday) today.signIns += 1
        break
      case 'game_win': {
        totals.games += 1
        totals.wins += 1
        if (isToday) {
          today.games += 1
          today.wins += 1
        }
        const g = typeof e.meta.guesses === 'number' ? e.meta.guesses : null
        if (g && g >= 1 && g <= 6) guessDistribution[g - 1]! += 1
        if (e.uid) {
          const row = players.get(e.uid) ?? { name: e.displayName || e.uid, wins: 0, games: 0 }
          row.wins += 1
          row.games += 1
          row.name = e.displayName || row.name
          players.set(e.uid, row)
        }
        break
      }
      case 'game_lose':
        totals.games += 1
        totals.losses += 1
        if (isToday) {
          today.games += 1
          today.losses += 1
        }
        if (e.uid) {
          const row = players.get(e.uid) ?? { name: e.displayName || e.uid, wins: 0, games: 0 }
          row.games += 1
          row.name = e.displayName || row.name
          players.set(e.uid, row)
        }
        break
      case 'new_route':
        totals.newRoutes += 1
        if (isToday) today.newRoutes += 1
        break
      case 'share':
        totals.shares += 1
        break
      default:
        break
    }
  }

  totals.winRate = totals.games ? Math.round((totals.wins / totals.games) * 100) : 0
  today.winRate = today.games ? Math.round((today.wins / today.games) * 100) : 0
  totals.uniquePlayers = allUids.size
  today.uniquePlayers = todayUids.size

  const topPlayers = [...players.entries()]
    .map(([uid, v]) => ({ uid, name: v.name, wins: v.wins, games: v.games }))
    .sort((a, b) => b.wins - a.wins || b.games - a.games)
    .slice(0, 10)

  return { totals, today, guessDistribution, topPlayers }
}

async function fetchLeaderboardToday(todayKey: string): Promise<LeaderboardEntry[]> {
  const db = getDb()
  if (!db) return []
  return withTimeout(
    (async () => {
      const q = query(collection(db, 'leaderboard'), orderBy('updatedAt', 'desc'), limit(100))
      const snap = await getDocs(q)
      const rows: LeaderboardEntry[] = []
      snap.forEach((d) => {
        const e = d.data() as LeaderboardEntry
        if (e.dateKey === todayKey) rows.push(e)
      })
      return rows.sort((a, b) => b.score - a.score).slice(0, 25)
    })(),
    2500,
    [] as LeaderboardEntry[],
  )
}

function buildSnapshot(
  events: AnalyticsEvent[],
  leaderboardToday: LeaderboardEntry[],
  source: 'local' | 'mixed',
): MetricsSnapshot {
  const todayKey = dateKeyUTC(new Date())
  const agg = aggregate(events, todayKey)
  return {
    generatedAt: Date.now(),
    todayKey,
    source,
    ...agg,
    recent: events.slice(0, 40),
    leaderboardToday,
  }
}

/** Instant local snapshot so admin UI never hangs on Firestore. */
export function loadLocalMetricsSnapshot(): MetricsSnapshot {
  return buildSnapshot(loadLocalEvents(), [], 'local')
}

export async function loadMetricsSnapshot(): Promise<MetricsSnapshot> {
  const [events, leaderboardToday] = await Promise.all([
    fetchRecentEvents(500),
    fetchLeaderboardToday(dateKeyUTC(new Date())),
  ])
  return buildSnapshot(events, leaderboardToday, 'mixed')
}
