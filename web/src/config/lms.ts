const DEFAULT_CTMS_ORIGIN = 'https://app.yourdomain.com'

export function getCtmsOrigin(): string {
  return (import.meta.env.VITE_CTMS_ORIGIN || DEFAULT_CTMS_ORIGIN).replace(
    /\/+$/,
    '',
  )
}

export function getProgressApiUrl(): string {
  return (import.meta.env.VITE_PROGRESS_API_URL || '').replace(/\/+$/, '')
}
