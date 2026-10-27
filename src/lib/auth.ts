import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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

function authErrorMessage(err: unknown): string {
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code?: string }).code ?? '')
      : ''
  const message =
    err instanceof Error ? err.message : typeof err === 'string' ? err : ''

  if (code === 'auth/unauthorized-domain') {
    return 'Domain not authorized in Firebase (add schnepsmedia.vercel.app)'
  }
  if (code === 'auth/operation-not-allowed') {
    return 'Google provider is disabled in Firebase Auth'
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup blocked — allow popups or try again'
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Sign-in cancelled'
  }
  if (code === 'auth/api-key-not-valid' || /API key not valid/i.test(message)) {
    return 'Firebase API key invalid — fix key in Google Cloud / Firebase settings'
  }
  if (code) return `Google sign-in failed (${code})`
  return message || 'Google sign-in failed'
}

export async function completeGoogleRedirect(): Promise<Player | null> {
  const auth = getFirebaseAuth()
  if (!auth || !firebaseConfigured) return null
  const result = await getRedirectResult(auth)
  if (!result?.user) return null
  return fromFirebaseUser(result.user)
}

export async function signInWithGoogle(): Promise<Player> {
  const auth = getFirebaseAuth()
  if (!auth || !firebaseConfigured) {
    throw new Error('GOOGLE_NOT_CONFIGURED')
  }
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    const result = await signInWithPopup(auth, provider)
    return fromFirebaseUser(result.user)
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code ?? '')
        : ''
    // Popup often fails in mobile / strict browsers — fall back to redirect.
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      await signInWithRedirect(auth, provider)
      // Page will navigate away; caller won't get a player this turn.
      throw new Error('REDIRECTING')
    }
    throw new Error(authErrorMessage(err))
  }
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
