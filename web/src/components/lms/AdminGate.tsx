import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { isAdminConfigured, isAdminUnlocked, unlockAdmin } from '../../lib/adminAuth'

interface AdminGateProps {
  children: ReactNode
}

export function AdminGate({ children }: AdminGateProps) {
  const [unlocked, setUnlocked] = useState(() => isAdminUnlocked())
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const titleId = useId()

  if (!isAdminConfigured()) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            Catalog admin
          </p>
          <h1 className="mt-1 text-lg font-semibold text-slate-900">
            Admin key is not configured
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Set <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">VITE_ADMIN_KEY</code>{' '}
            at build time, then open this page again. This is a static-site gate, not a
            server login.
          </p>
          <button
            type="button"
            onClick={() => {
              window.location.hash = ''
            }}
            className="mt-4 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Back to course
          </button>
        </div>
      </div>
    )
  }

  if (!unlocked) {
    const onSubmit = (event: FormEvent) => {
      event.preventDefault()
      if (unlockAdmin(key)) {
        setUnlocked(true)
        setError(null)
        return
      }
      setError('That key does not match VITE_ADMIN_KEY.')
    }

    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          aria-labelledby={titleId}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
            Catalog admin
          </p>
          <h1 id={titleId} className="mt-1 text-lg font-semibold text-slate-900">
            Unlock catalog editor
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Learners only watch the published course. Use this page to add YouTube videos
            to a draft, then download <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">courses.json</code>.
          </p>
          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Admin key
            </span>
            <input
              type="password"
              value={key}
              onChange={(event) => setKey(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                window.location.hash = ''
              }}
              className="text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Back to course
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    )
  }

  return <>{children}</>
}
