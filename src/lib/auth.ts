import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { firebaseConfigured, getFirebaseAuth } from './firebase'

export type Player = {
  uid: string
  displayName: string
  photoURL: string | null
  email: string | null
  provider: 'google' | 'guest'
}

const GUEST_KEY = 'transfer-nyc:guest-player'

function guestFromStorage(): Player | null {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    return raw ? (JSON.parse(raw) as Player) : null
  } catch {
    return null
  }
}

function saveGuest(player: Player | null) {
  try {
    if (!player) localStorage.removeItem(GUEST_KEY)
    else localStorage.setItem(GUEST_KEY, JSON.stringify(player))
  } catch {
    // ignore
  }
}

function fromFirebaseUser(user: User): Player {
  return {
    uid: user.uid,
    displayName: user.displayName || user.email || 'Rider',
    photoURL: user.photoURL,
    email: user.email,
    provider: 'google',
  }
}

export function watchAuth(onChange: (player: Player | null) => void): () => void {
  const auth = getFirebaseAuth()
  if (!auth) {
    onChange(guestFromStorage())
    return () => {}
  }
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      saveGuest(null)
      onChange(fromFirebaseUser(user))
    } else {
      onChange(guestFromStorage())
    }
  })
}

export async function signInWithGoogle(): Promise<Player> {
  const auth = getFirebaseAuth()
  if (!auth || !firebaseConfigured) {
    throw new Error('GOOGLE_NOT_CONFIGURED')
  }
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)
  return fromFirebaseUser(result.user)
}

/** Local fallback so the UI is playable before Firebase keys are added. */
export function signInAsGuest(displayName: string): Player {
  const name = displayName.trim() || 'Guest Rider'
  const player: Player = {
    uid: `guest-${hashName(name)}`,
    displayName: name,
    photoURL: null,
    email: null,
    provider: 'guest',
  }
  saveGuest(player)
  return player
}

export async function signOutPlayer(): Promise<void> {
  saveGuest(null)
  const auth = getFirebaseAuth()
  if (auth) await firebaseSignOut(auth)
}

function hashName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export { firebaseConfigured }
