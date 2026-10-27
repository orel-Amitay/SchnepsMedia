import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import type { Player } from './auth'
import {
  getClientContext,
  sessionDurationSec,
  type DeviceKind,
} from './clientContext'
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
  | 'session_start'
  | 'session_end'

export type AnalyticsEvent = {
  type: AnalyticsEventType
  dateKey: string
  uid: string | null
  displayName: string | null
  email: string | null
  provider: 'google' | 'guest' | 'password' | 'anon'
  sessionId: string
  device: DeviceKind
  meta: Record<string, string | number | boolean | null>
  createdAt: number
}

const LOCAL_KEY = 'transfer-nyc:analytics-buffer'

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

function normalizeEvent(raw: Partial<AnalyticsEvent> & { type: AnalyticsEventType }): AnalyticsEvent {
  const meta = raw.meta ?? {}
  const sessionId =
    raw.sessionId ||
    (typeof meta.sessionId === 'string' ? meta.sessionId : '') ||
    'unknown'
  const device =
    raw.device ||
    (meta.device === 'phone' || meta.device === 'tablet' || meta.device === 'desktop'
      ? meta.device
      : 'desktop')
  return {
    type: raw.type,
    dateKey: raw.dateKey || dateKeyUTC(new Date(raw.createdAt || Date.now())),
    uid: raw.uid ?? null,
    displayName: raw.displayName ?? null,
    email: raw.email ?? null,
    provider: raw.provider ?? 'anon',
    sessionId,
    device,
    meta,
    createdAt: raw.createdAt || Date.now(),
  }
}

export function trackEvent(
  type: AnalyticsEventType,
  player: Player | null,
  meta: Record<string, string | number | boolean | null> = {},
): void {
  const client = getClientContext()
  const event: AnalyticsEvent = {
    type,
    dateKey: dateKeyUTC(new Date()),
    uid: player?.uid ?? null,
    displayName: player?.displayName ?? null,
    email: player?.email ?? null,
    provider: player?.provider ?? 'anon',
    sessionId: client.sessionId,
    device: client.device,
    meta: {
      ...meta,
      sessionId: client.sessionId,
      device: client.device,
      viewport: client.viewport,
      durationSec: sessionDurationSec(),
    },
    createdAt: Date.now(),
  }

  bufferLocal(event)

  const db = getDb()
  if (!db) return
  void addDoc(collection(db, 'events'), event).catch(() => {
    // rules / offline — local buffer still has it
  })
}

/** Fire once per tab + on leave so admin can see dwell time. */
export function startSessionTracking(getPlayer: () => Player | null): () => void {
  trackEvent('session_start', getPlayer())

  let ended = false
  const end = () => {
    if (ended) return
    ended = true
    trackEvent('session_end', getPlayer(), {
      durationSec: sessionDurationSec(),
    })
  }

  const onVis = () => {
    if (document.visibilityState === 'hidden') end()
  }
  document.addEventListener('visibilitychange', onVis)
  window.addEventListener('pagehide', end)

  return () => {
    document.removeEventListener('visibilitychange', onVis)
    window.removeEventListener('pagehide', end)
  }
}

export async function fetchRecentEvents(max = 400): Promise<AnalyticsEvent[]> {
  const local = loadLocalEvents().map((e) => normalizeEvent(e))
  const byKey = new Map<string, AnalyticsEvent>()
  for (const e of local) {
    byKey.set(`${e.createdAt}_${e.type}_${e.uid ?? 'anon'}_${e.sessionId}`, e)
  }

  const db = getDb()
  if (db) {
    const cloud = await withTimeout(
      (async () => {
        const q = query(collection(db, 'events'), orderBy('createdAt', 'desc'), limit(max))
        const snap = await getDocs(q)
        const rows: AnalyticsEvent[] = []
        snap.forEach((d) => rows.push(normalizeEvent(d.data() as AnalyticsEvent)))
        return rows
      })(),
      2500,
      [] as AnalyticsEvent[],
    )
    for (const e of cloud) {
      byKey.set(`${e.createdAt}_${e.type}_${e.uid ?? 'anon'}_${e.sessionId}`, e)
    }
  }

  return [...byKey.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, max)
}
