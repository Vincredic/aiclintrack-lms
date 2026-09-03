import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import type { AddYouTubeInput } from '../../hooks/useAdminCatalog'
import { parseYouTubeVideoId } from '../../lib/videoSource'
import { resolveYouTubeMetadata, type YouTubeMetadata } from '../../lib/youtubeMetadata'
import {
  YOUTUBE_CHANNEL_HANDLE,
  YOUTUBE_CHANNEL_MODULE_ID,
  YOUTUBE_CHANNEL_MODULE_TITLE,
  YOUTUBE_CHANNEL_URL,
} from '../../config/youtubeChannel'
import { type CourseModule } from '../../types/lms'
import { CloseIcon } from './icons'

interface AddYouTubeModalProps {
  open: boolean
  modules: CourseModule[]
  onClose: () => void
  onAdd: (input: AddYouTubeInput) => Promise<void>
}

export function AddYouTubeModal({
  open,
  modules,
  onClose,
  onAdd,
}: AddYouTubeModalProps) {
  const titleId = useId()
  const urlRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [moduleId, setModuleId] = useState(YOUTUBE_CHANNEL_MODULE_ID)
  const [lookup, setLookup] = useState<YouTubeMetadata | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasChannelModule = modules.some(
    (module) => module.id === YOUTUBE_CHANNEL_MODULE_ID,
  )

  useEffect(() => {
    if (!open) return
    setUrl('')
    setTitle('')
    setDescription('')
    setModuleId(YOUTUBE_CHANNEL_MODULE_ID)
    setLookup(null)
    setError(null)
    setLookingUp(false)
    setSaving(false)
    const frame = window.requestAnimationFrame(() => urlRef.current?.focus())
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const lookupVideo = async () => {
    const youtubeId = parseYouTubeVideoId(url)
    if (!youtubeId) {
      setError(
        `Paste a YouTube URL from @${YOUTUBE_CHANNEL_HANDLE}.`,
      )
      return
    }
    setError(null)
    setLookingUp(true)
    try {
      const meta = await resolveYouTubeMetadata(url)
      setLookup(meta)
      setTitle((current) => current.trim() || meta.title)
      if (meta.author) {
        setDescription((current) =>
            current.trim() ? current : `Added from YouTube · ${meta.author}.`,
        )
      }
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not look up that video.')
    } finally {
      setLookingUp(false)
    }
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const selected = modules.find((module) => module.id === moduleId)
      await onAdd({
        url,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        moduleId,
        moduleTitle: selected?.title ?? YOUTUBE_CHANNEL_MODULE_TITLE,
      })
      onClose()
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not add that video.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center md:p-6">
      <button
        type="button"
        aria-label="Close add YouTube dialog"
        className="absolute inset-0 bg-slate-950/55"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-2xl md:rounded-2xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-700">
              @{YOUTUBE_CHANNEL_HANDLE} only
            </p>
            <h2 id={titleId} className="text-base font-semibold text-slate-900">
              Add a channel video
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Learners already see public uploads from{' '}
              <a
                href={YOUTUBE_CHANNEL_URL}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                @{YOUTUBE_CHANNEL_HANDLE}
              </a>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              YouTube URL
            </span>
            <div className="flex gap-2">
              <input
                ref={urlRef}
                type="text"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value)
                  setLookup(null)
                }}
                placeholder={`YouTube URL from @${YOUTUBE_CHANNEL_HANDLE}`}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => void lookupVideo()}
                disabled={lookingUp || !url.trim()}
                className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lookingUp ? 'Looking up…' : 'Look up'}
              </button>
            </div>
          </label>

          {lookup ? (
            <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <img
                src={lookup.thumbnailUrl}
                alt=""
                className="h-16 w-28 shrink-0 rounded-lg object-cover bg-slate-200"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{lookup.title}</p>
                {lookup.author ? (
                  <p className="mt-0.5 text-xs text-slate-500">{lookup.author}</p>
                ) : null}
              </div>
            </div>
          ) : null}

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Title
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Fetched from YouTube, or enter your own"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Description <span className="font-normal text-slate-400">(optional)</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Module
            </span>
            <select
              value={moduleId}
              onChange={(event) => setModuleId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              {!hasChannelModule ? (
                <option value={YOUTUBE_CHANNEL_MODULE_ID}>
                  {YOUTUBE_CHANNEL_MODULE_TITLE}
                </option>
              ) : null}
              {modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !url.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? 'Adding…' : 'Add to catalog'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
