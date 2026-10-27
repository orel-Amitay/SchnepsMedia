import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  limit,
} from 'firebase/firestore'
import type { Player } from './auth'
import { getDb } from './firebase'

export type LeaderboardEntry = {
  uid: string
  displayName: string
  photoURL: string | null
  dateKey: string
  guesses: number | null
  won: boolean
  score: number
  updatedAt: number
}

const LOCAL_KEY = 'subwaydle-nyc:leaderboard'

function scoreFor(won: boolean, guesses: number): number {
  if (!won) return 0
  // Fewer guesses = higher score; win in 1 → 600, in 6 → 100
  return Math.max(100, 700 - guesses * 100)
}

function loadLocal(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as LeaderboardEntry[]) : []
  } catch {
    return []
  }
}

function saveLocal(entries: LeaderboardEntry[]) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(entries))
  } catch {
    // ignore
  }
}

export async function submitScore(opts: {
  player: Player
  dateKey: string
  won: boolean
  guesses: number
}): Promise<void> {
  const entry: LeaderboardEntry = {
    uid: opts.player.uid,
    displayName: opts.player.displayName,
    photoURL: opts.player.photoURL,
    dateKey: opts.dateKey,
    guesses: opts.won ? opts.guesses : null,
    won: opts.won,
    score: scoreFor(opts.won, opts.guesses),
    updatedAt: Date.now(),
  }

  const db = getDb()
  if (db && opts.player.provider === 'google') {
    const id = `${opts.dateKey}_${opts.player.uid}`
    await setDoc(doc(db, 'leaderboard', id), entry, { merge: true })
  }

  const local = loadLocal().filter((e) => !(e.dateKey === entry.dateKey && e.uid === entry.uid))
  local.push(entry)
  saveLocal(local)
}

export async function fetchLeaderboard(dateKey: string): Promise<LeaderboardEntry[]> {
  const local = loadLocal().filter((e) => e.dateKey === dateKey)
  const byUid = new Map(local.map((e) => [e.uid, e]))

  const db = getDb()
  if (db) {
    try {
      const q = query(
        collection(db, 'leaderboard'),
        where('dateKey', '==', dateKey),
        orderBy('score', 'desc'),
        limit(50),
      )
      const snap = await getDocs(q)
      snap.forEach((d) => {
        const e = d.data() as LeaderboardEntry
        byUid.set(e.uid, e)
      })
    } catch {
      // Missing index / rules — fall back to local only
    }
  }

  return [...byUid.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (a.won && b.won) return (a.guesses ?? 99) - (b.guesses ?? 99)
      return b.updatedAt - a.updatedAt
    })
    .slice(0, 25)
}
