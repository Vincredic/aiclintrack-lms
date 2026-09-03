import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAdminCatalog, type AddYouTubeInput } from '../../hooks/useAdminCatalog'
import { useCourseData } from '../../hooks/useCourseData'
import { flattenVideos } from '../../lib/courseCatalog'
import { lockAdmin } from '../../lib/adminAuth'
import { cn } from '../../lib/cn'
import type { CourseModule, CourseVideo } from '../../types/lms'
import { AddYouTubeModal } from './AddYouTubeModal'
import { AdminGate } from './AdminGate'
import { VideoPlayerWrapper } from './VideoPlayerWrapper'
import { ClockIcon, MenuIcon, PlusIcon } from './icons'

export function AdminShell() {
  return (
    <AdminGate>
      <AdminEditor />
    </AdminGate>
  )
}

function AdminEditor() {
  const { course: published, status, error, reload } = useCourseData()
  const { draft, dirty, addYouTubeVideo, removeVideo, discardDraft, exportJson } =
    useAdminCatalog(published)
  const videos = useMemo(() => (draft ? flattenVideos(draft) : []), [draft])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const activeVideo = videos.find((video) => video.id === selectedId) ?? null

  useEffect(() => {
    if (videos.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !videos.some((video) => video.id === selectedId)) {
      setSelectedId(videos[0].id)
    }
  }, [selectedId, videos])

  const handleAdd = useCallback(
    async (input: AddYouTubeInput) => {
      const video = await addYouTubeVideo(input)
      setSelectedId(video.id)
    },
    [addYouTubeVideo],
  )

  const handleRemove = useCallback(
    (videoId: string) => {
      const index = videos.findIndex((video) => video.id === videoId)
      const fallback = videos[index + 1]?.id ?? videos[index - 1]?.id ?? null
      removeVideo(videoId)
      setSelectedId(fallback)
    },
    [removeVideo, videos],
  )

  if (status === 'loading' || (status === 'ready' && published && !draft)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 text-sm text-slate-500">
        Loading catalog…
      </div>
    )
  }

  if (status === 'error' || !published || !draft) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Catalog unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">
            {error ?? 'courses.json could not be loaded.'}
          </p>
          <button
            type="button"
            onClick={reload}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
              aria-label="Open catalog outline"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-400">
                Catalog admin
              </p>
              <h1 className="truncate text-sm font-semibold md:text-base">{draft.title}</h1>
              <p className="truncate text-xs text-slate-400">
                {videos.length} video{videos.length === 1 ? '' : 's'}
                {dirty ? ' · unpublished draft' : ' · matches published catalog'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-500"
            >
              <PlusIcon className="h-4 w-4" />
              Add YouTube
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Download courses.json
            </button>
            <button
              type="button"
              onClick={discardDraft}
              disabled={!dirty}
              className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Discard draft
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = ''
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-300 hover:bg-white/10"
            >
              Learner view
            </button>
            <button
              type="button"
              onClick={() => {
                lockAdmin()
                window.location.hash = ''
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/10"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950 lg:px-5">
        Learners see public videos from the{' '}
        <strong>@AIClinTrack</strong> YouTube channel. This draft is only in this
        browser. URLs from other channels are rejected.
      </div>

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen ? (
          <button
            type="button"
            aria-label="Close catalog outline"
            className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={cn(
            'z-50 flex h-full w-[min(100%,22rem)] shrink-0 flex-col border-slate-200 bg-white',
            'fixed inset-y-0 left-0 border-r shadow-xl transition-transform lg:static lg:z-0 lg:shadow-none',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Draft outline
            </p>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
              aria-label="Close outline"
            >
              ×
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Draft modules">
            <ul className="space-y-3">
              {draft.modules.map((module) => (
                <AdminModule
                  key={module.id}
                  module={module}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    setSelectedId(id)
                    setSidebarOpen(false)
                  }}
                  onRemove={handleRemove}
                  canRemove={videos.length > 1}
                />
              ))}
            </ul>
          </nav>
        </aside>

        {activeVideo ? (
          <AdminPreview
            video={activeVideo}
            onRemove={() => handleRemove(activeVideo.id)}
            canRemove={videos.length > 1}
          />
        ) : (
          <p className="flex flex-1 items-center justify-center text-sm text-slate-500">
            No videos in this catalog.
          </p>
        )}
      </div>

      <AddYouTubeModal
        open={addOpen}
        modules={draft.modules}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  )
}

function AdminModule({
  module,
  selectedId,
  onSelect,
  onRemove,
  canRemove,
}: {
  module: CourseModule
  selectedId: string | null
  onSelect: (videoId: string) => void
  onRemove: (videoId: string) => void
  canRemove: boolean
}) {
  return (
    <li>
      <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {module.title}
      </p>
      <ul className="mt-1 space-y-0.5">
        {module.videos.map((video) => {
          const active = video.id === selectedId
          return (
            <li key={video.id}>
              <div
                className={cn(
                  'flex items-start gap-1 rounded-lg px-1 py-1',
                  active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50',
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(video.id)}
                  className="min-w-0 flex-1 rounded-md px-1 py-1 text-left"
                >
                  <span className="block text-sm font-medium text-slate-900">
                    {video.title}
                  </span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
                    {video.duration ? (
                      <>
                        <ClockIcon className="h-3 w-3" />
                        {video.duration}
                      </>
                    ) : (
                      video.sourceType
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(video.id)}
                  disabled={!canRemove}
                  className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  aria-label={`Remove ${video.title}`}
                >
                  Remove
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </li>
  )
}

function AdminPreview({
  video,
  onRemove,
  canRemove,
}: {
  video: CourseVideo
  onRemove: () => void
  canRemove: boolean
}) {
  return (
    <section className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <VideoPlayerWrapper
            sourceType={video.sourceType}
            videoId={video.id}
            sourceUrlOrId={video.sourceUrlOrId}
            title={video.title}
            thumbnailUrl={video.thumbnailUrl}
          />
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {video.category} · {video.sourceType}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{video.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {video.description}
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            disabled={!canRemove}
            className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Remove from draft
          </button>
        </div>
      </div>
    </section>
  )
}
