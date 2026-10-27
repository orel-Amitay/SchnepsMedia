import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import type { AnalyticsEvent } from './analytics'
import { fetchRecentEvents, loadLocalEvents } from './analytics'
import type { DeviceKind } from './clientContext'
import { getDb } from './firebase'
import type { LeaderboardEntry } from './leaderboard'
import { dateKeyUTC } from './rng'

export type SessionRow = {
  sessionId: string
  uid: string | null
  displayName: string | null
  email: string | null
  provider: string
  device: DeviceKind | 'unknown'
  viewport: string | null
  firstAt: number
  lastAt: number
  durationSec: number
  events: number
  games: number
  wins: number
  pageViews: number
}

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
    sessions: number
    avgSessionSec: number
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
    sessions: number
    avgSessionSec: number
  }
  devices: { phone: number; tablet: number; desktop: number; unknown: number }
  guessDistribution: number[]
  topPlayers: Array<{ uid: string; name: string; wins: number; games: number }>
  sessions: SessionRow[]
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

function eventDevice(e: AnalyticsEvent): DeviceKind | 'unknown' {
  if (e.device === 'phone' || e.device === 'tablet' || e.device === 'desktop') return e.device
  const d = e.meta.device
  if (d === 'phone' || d === 'tablet' || d === 'desktop') return d
  return 'unknown'
}

function eventSessionId(e: AnalyticsEvent): string {
  if (e.sessionId && e.sessionId !== 'unknown') return e.sessionId
  if (typeof e.meta.sessionId === 'string' && e.meta.sessionId) return e.meta.sessionId
  return e.uid ? `uid_${e.uid}` : `anon_${e.createdAt}`
}

function buildSessions(events: AnalyticsEvent[]): SessionRow[] {
  const map = new Map<
    string,
    {
      row: SessionRow
      reportedDuration: number
    }
  >()

  // Oldest → newest so we pick up identity as it appears
  const chronological = [...events].sort((a, b) => a.createdAt - b.createdAt)

  for (const e of chronological) {
    const id = eventSessionId(e)
    const device = eventDevice(e)
    const viewport = typeof e.meta.viewport === 'string' ? e.meta.viewport : null
    const reported =
      typeof e.meta.durationSec === 'number' && Number.isFinite(e.meta.durationSec)
        ? e.meta.durationSec
        : 0

    let entry = map.get(id)
    if (!entry) {
      entry = {
        reportedDuration: reported,
        row: {
          sessionId: id,
          uid: e.uid,
          displayName: e.displayName,
          email: e.email,
          provider: e.provider,
          device,
          viewport,
          firstAt: e.createdAt,
          lastAt: e.createdAt,
          durationSec: 0,
          events: 0,
          games: 0,
          wins: 0,
          pageViews: 0,
        },
      }
      map.set(id, entry)
    }

    const row = entry.row
    row.events += 1
    row.lastAt = Math.max(row.lastAt, e.createdAt)
    row.firstAt = Math.min(row.firstAt, e.createdAt)
    if (reported > entry.reportedDuration) entry.reportedDuration = reported
    if (e.uid) row.uid = e.uid
    if (e.displayName) row.displayName = e.displayName
    if (e.email) row.email = e.email
    if (e.provider && e.provider !== 'anon') row.provider = e.provider
    if (device !== 'unknown') row.device = device
    if (viewport) row.viewport = viewport
    if (e.type === 'page_view') row.pageViews += 1
    if (e.type === 'game_win') {
      row.games += 1
      row.wins += 1
    }
    if (e.type === 'game_lose') row.games += 1
  }

  const rows: SessionRow[] = []
  for (const { row, reportedDuration } of map.values()) {
    const spanSec = Math.max(0, Math.round((row.lastAt - row.firstAt) / 1000))
    row.durationSec = Math.max(spanSec, reportedDuration)
    rows.push(row)
  }

  return rows.sort((a, b) => b.lastAt - a.lastAt)
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
    sessions: 0,
    avgSessionSec: 0,
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
    sessions: 0,
    avgSessionSec: 0,
  }
  const devices = { phone: 0, tablet: 0, desktop: 0, unknown: 0 }
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

  const sessions = buildSessions(events)
  for (const s of sessions) {
    const bucket = s.device in devices ? s.device : 'unknown'
    devices[bucket as keyof typeof devices] += 1
  }

  const todaySessions = sessions.filter((s) => dateKeyUTC(new Date(s.firstAt)) === todayKey)
  totals.sessions = sessions.length
  today.sessions = todaySessions.length
  totals.avgSessionSec = sessions.length
    ? Math.round(sessions.reduce((a, s) => a + s.durationSec, 0) / sessions.length)
    : 0
  today.avgSessionSec = todaySessions.length
    ? Math.round(todaySessions.reduce((a, s) => a + s.durationSec, 0) / todaySessions.length)
    : 0

  totals.winRate = totals.games ? Math.round((totals.wins / totals.games) * 100) : 0
  today.winRate = today.games ? Math.round((today.wins / today.games) * 100) : 0
  totals.uniquePlayers = allUids.size
  today.uniquePlayers = todayUids.size

  const topPlayers = [...players.entries()]
    .map(([uid, v]) => ({ uid, name: v.name, wins: v.wins, games: v.games }))
    .sort((a, b) => b.wins - a.wins || b.games - a.games)
    .slice(0, 10)

  return {
    totals,
    today,
    devices,
    guessDistribution,
    topPlayers,
    sessions: sessions.slice(0, 80),
  }
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
