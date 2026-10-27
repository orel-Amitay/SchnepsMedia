import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import type { Player } from './auth'
import { getDb } from './firebase'
import { dateKeyUTC } from './rng'

export type AnalyticsEventType =
  | 'page_view'
  | 'sign_in'
  | 'sign_out'
  | 'game_win'
  | 'game_lose'
  | 'new_route'
  | 'today_route'
  | 'reset'
  | 'share'
  | 'peek_answer'
  | 'leaderboard_open'

export type AnalyticsEvent = {
  type: AnalyticsEventType
  dateKey: string
  uid: string | null
  displayName: string | null
  email: string | null
  provider: 'google' | 'guest' | 'password' | 'anon'
  meta: Record<string, string | number | boolean | null>
  createdAt: number
}

const LOCAL_KEY = 'transfer-nyc:analytics-buffer'

function bufferLocal(event: AnalyticsEvent) {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const list: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : []
    list.unshift(event)
    localStorage.setItem(LOCAL_KEY, JSON.stringify(list.slice(0, 300)))
  } catch {
    // ignore
  }
}

export function loadLocalEvents(): AnalyticsEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as AnalyticsEvent[]) : []
  } catch {
    return []
  }
}

export function trackEvent(
  type: AnalyticsEventType,
  player: Player | null,
  meta: Record<string, string | number | boolean | null> = {},
): void {
  const event: AnalyticsEvent = {
    type,
    dateKey: dateKeyUTC(new Date()),
    uid: player?.uid ?? null,
    displayName: player?.displayName ?? null,
    email: player?.email ?? null,
    provider: player?.provider ?? 'anon',
    meta,
    createdAt: Date.now(),
  }

  bufferLocal(event)

  const db = getDb()
  if (!db) return
  void addDoc(collection(db, 'events'), event).catch(() => {
    // rules / offline — local buffer still has it
  })
}

export async function fetchRecentEvents(max = 400): Promise<AnalyticsEvent[]> {
  const local = loadLocalEvents()
  const byKey = new Map<string, AnalyticsEvent>()
  for (const e of local) {
    byKey.set(`${e.createdAt}_${e.type}_${e.uid ?? 'anon'}`, e)
  }

  const db = getDb()
  if (db) {
    try {
      const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(max))
      const snap = await getDocs(q)
      snap.forEach((d) => {
        const e = d.data() as AnalyticsEvent
        byKey.set(`${e.createdAt}_${e.type}_${e.uid ?? 'anon'}`, e)
      })
    } catch {
      // missing index/rules
    }
  }

  return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, max)
}
