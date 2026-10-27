import {
  GoogleAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
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
  provider: 'google' | 'guest' | 'password'
}

const SESSION_KEY = 'transfer-nyc:guest-player'

/** Shared app password (also set as VITE_LOGIN_PASSWORD on the host). */
export const LOGIN_PASSWORD =
  (import.meta.env.VITE_LOGIN_PASSWORD as string | undefined)?.trim() || 'TransferSchneps26'

function sessionFromStorage(): Player | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Player) : null
  } catch {
    return null
  }
}

function saveSession(player: Player | null) {
  try {
    if (!player) localStorage.removeItem(SESSION_KEY)
    else localStorage.setItem(SESSION_KEY, JSON.stringify(player))
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
    onChange(sessionFromStorage())
    return () => {}
  }
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      saveSession(null)
      onChange(fromFirebaseUser(user))
    } else {
      onChange(sessionFromStorage())
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
  if (code === 'auth/api-key-not-valid' || /API key not valid/i.test(message)) {
    return 'Firebase API key invalid — fix key in Google Cloud / Firebase settings'
  }
  if (code) return `Google sign-in failed (${code})`
  return message || 'Google sign-in failed'
}

export async function completeGoogleRedirect(): Promise<Player | null> {
  const auth = getFirebaseAuth()
  if (!auth || !firebaseConfigured) return null
  try {
    const result = await getRedirectResult(auth)
    if (!result?.user) return null
    return fromFirebaseUser(result.user)
  } catch (err) {
    throw new Error(authErrorMessage(err))
  }
}

/** Full-page Google redirect (more reliable than popup on Vercel). */
export async function signInWithGoogle(): Promise<Player> {
  const auth = getFirebaseAuth()
  if (!auth || !firebaseConfigured) {
    throw new Error('GOOGLE_NOT_CONFIGURED')
  }
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  provider.addScope('profile')
  provider.addScope('email')
  try {
    await signInWithRedirect(auth, provider)
    throw new Error('REDIRECTING')
  } catch (err) {
    if (err instanceof Error && err.message === 'REDIRECTING') throw err
    throw new Error(authErrorMessage(err))
  }
}

export function signInWithPassword(password: string, displayName = 'Schneps Admin'): Player {
  if (password.trim() !== LOGIN_PASSWORD) {
    throw new Error('WRONG_PASSWORD')
  }
  const player: Player = {
    uid: `password-${hashName(LOGIN_PASSWORD)}`,
    displayName: displayName.trim() || 'Schneps Admin',
    photoURL: null,
    email: 'password@transfer.local',
    provider: 'password',
  }
  saveSession(player)
  return player
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
  saveSession(player)
  return player
}

export async function signOutPlayer(): Promise<void> {
  saveSession(null)
  const auth = getFirebaseAuth()
  if (auth) await firebaseSignOut(auth)
}

function hashName(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export { firebaseConfigured }
