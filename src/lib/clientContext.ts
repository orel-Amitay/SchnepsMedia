export type DeviceKind = 'phone' | 'tablet' | 'desktop'

const SESSION_ID_KEY = 'transfer-nyc:session-id'
const SESSION_START_KEY = 'transfer-nyc:session-start'

function randomId() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

/** Stable for the browser tab (sessionStorage). */
export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY)
    if (!id) {
      id = `s_${randomId()}`
      sessionStorage.setItem(SESSION_ID_KEY, id)
    }
    return id
  } catch {
    return `s_${randomId()}`
  }
}

export function getSessionStartedAt(): number {
  try {
    const raw = sessionStorage.getItem(SESSION_START_KEY)
    if (raw) {
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return n
    }
    const now = Date.now()
    sessionStorage.setItem(SESSION_START_KEY, String(now))
    return now
  } catch {
    return Date.now()
  }
}

export function sessionDurationSec(now = Date.now()): number {
  return Math.max(0, Math.round((now - getSessionStartedAt()) / 1000))
}

export function detectDevice(): DeviceKind {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  const w = Math.min(window.innerWidth || 1200, window.screen?.width || 1200)

  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    return 'tablet'
  }
  if (/Mobi|iPhone|iPod|Android.*Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) || w < 768) {
    return 'phone'
  }
  if (w < 1024 && 'ontouchstart' in window) return 'tablet'
  return 'desktop'
}

export type ClientContext = {
  sessionId: string
  device: DeviceKind
  viewport: string
  sessionStartedAt: number
}

export function getClientContext(): ClientContext {
  const sessionStartedAt = getSessionStartedAt()
  return {
    sessionId: getSessionId(),
    device: detectDevice(),
    viewport:
      typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '0x0',
    sessionStartedAt,
  }
}

export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm ? `${h}h ${rm}m` : `${h}h`
}
