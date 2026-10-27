const raw = (import.meta.env.VITE_ADMIN_EMAILS as string | undefined) ?? 'orelamitay8@gmail.com'

const adminEmails = new Set(
  raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
)

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return adminEmails.has(email.trim().toLowerCase())
}

export function isAdminRoute(): boolean {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname.replace(/\/+$/, '') || '/'
  if (path === '/admin') return true
  return new URLSearchParams(window.location.search).has('admin')
}
