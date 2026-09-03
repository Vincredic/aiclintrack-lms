const ADMIN_SESSION_KEY = 'lms_admin_unlocked'

function getAdminKey(): string {
  return (import.meta.env.VITE_ADMIN_KEY || '').trim()
}

export function isAdminConfigured(): boolean {
  return Boolean(getAdminKey()) || import.meta.env.DEV
}

export function isAdminUnlocked(): boolean {
  if (typeof window === 'undefined') return false
  const required = getAdminKey()
  if (!required) return import.meta.env.DEV
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) === required
}

export function unlockAdmin(key: string): boolean {
  const required = getAdminKey()
  if (!required) {
    if (!import.meta.env.DEV) return false
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, 'dev')
    return true
  }
  if (key !== required) return false
  window.sessionStorage.setItem(ADMIN_SESSION_KEY, required)
  return true
}

export function lockAdmin(): void {
  window.sessionStorage.removeItem(ADMIN_SESSION_KEY)
}

export function isAdminHash(hash = window.location.hash): boolean {
  const value = hash.replace(/^#\/?/, '').split(/[?&]/)[0]
  return value === 'admin'
}
