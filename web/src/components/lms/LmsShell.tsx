import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { emitVideoCompleted, useIframeBridge } from '../../hooks/useIframeBridge'
import { useCourseData } from '../../hooks/useCourseData'
import { useLmsProgress } from '../../hooks/useLmsProgress'
import { adjacentVideoIds } from '../../lib/courseCatalog'
import { HeaderBar } from './HeaderBar'
import { MainViewport } from './MainViewport'
import { SidebarNav } from './SidebarNav'

function readHashVideoId(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash.replace(/^#/, '')
  return hash ? new URLSearchParams(hash).get('v') : null
}

function writeHashVideoId(videoId: string) {
  const next = `#v=${encodeURIComponent(videoId)}`
  if (window.location.hash !== next) {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next}`)
  }
}

function preferredVideoId(
  videoIds: string[],
  lastWatchedVideoId: string | null,
): string | null {
  if (videoIds.length === 0) return null
  const fromHash = readHashVideoId()
  if (fromHash && videoIds.includes(fromHash)) return fromHash
  if (lastWatchedVideoId && videoIds.includes(lastWatchedVideoId)) {
    return lastWatchedVideoId
  }
  return videoIds[0] ?? null
}

export function LmsShell() {
  const { course, videos, status, error, reload } = useCourseData()
  const videoIds = useMemo(() => videos.map((video) => video.id), [videos])
  const {
    progress,
    completedIds,
    completedCount,
    totalCount,
    percent,
    isComplete,
    toggleComplete,
    markComplete,
    setLastWatched,
    setPosition,
    getPosition,
  } = useLmsProgress(videoIds, course?.id ?? null)
  const lastWatchedVideoId = progress.lastWatchedVideoId
  const completedVideoIds = progress.completedVideoIds
  const completedRef = useRef(completedIds)
  completedRef.current = completedIds

  const [query, setQuery] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [resumeAt, setResumeAt] = useState(0)

  const resolvedId =
    selectedId && videoIds.includes(selectedId)
      ? selectedId
      : preferredVideoId(videoIds, lastWatchedVideoId)
  const activeVideo = videos.find((video) => video.id === resolvedId) ?? null
  const startSeconds =
    selectedId && selectedId === resolvedId
      ? resumeAt
      : resolvedId
        ? getPosition(resolvedId)
        : 0

  const selectVideo = useCallback(
    (videoId: string) => {
      if (!videoIds.includes(videoId)) return
      setResumeAt(getPosition(videoId))
      setSelectedId(videoId)
      setLastWatched(videoId)
      writeHashVideoId(videoId)
    },
    [getPosition, setLastWatched, videoIds],
  )

  useEffect(() => {
    if (videos.length === 0 || selectedId) return
    const preferred = preferredVideoId(videoIds, lastWatchedVideoId)
    if (preferred) selectVideo(preferred)
  }, [lastWatchedVideoId, selectVideo, selectedId, videoIds, videos.length])

  useEffect(() => {
    const onHash = () => {
      const id = readHashVideoId()
      if (id) selectVideo(id)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [selectVideo])

  const handleMarkComplete = useCallback(
    (videoId: string) => {
      const becameComplete = markComplete(videoId)
      if (!becameComplete) return
      const completedNow = new Set(completedRef.current)
      completedNow.add(videoId)
      const courseComplete =
        videoIds.length > 0 && videoIds.every((id) => completedNow.has(id))
      emitVideoCompleted(videoId, {
        courseId: course?.id,
        courseComplete,
      })
    },
    [course?.id, markComplete, videoIds],
  )

  const handleToggleComplete = useCallback(() => {
    if (!activeVideo) return
    const nextComplete = toggleComplete(activeVideo.id)
    if (nextComplete) {
      const completedNow = new Set(completedRef.current)
      completedNow.add(activeVideo.id)
      const courseComplete =
        videoIds.length > 0 && videoIds.every((id) => completedNow.has(id))
      emitVideoCompleted(activeVideo.id, {
        courseId: course?.id,
        courseComplete,
      })
    }
  }, [activeVideo, course?.id, toggleComplete, videoIds])

  useIframeBridge({
    courseId: course?.id ?? null,
    completedVideoIds,
    lastWatchedVideoId,
    percent,
    onSelectVideo: selectVideo,
    onMarkComplete: handleMarkComplete,
  })

  const neighbors = activeVideo
    ? adjacentVideoIds(videos, activeVideo.id)
    : { previousId: null, nextId: null }

  if (status === 'loading' && videos.length === 0) {
    return <LmsSkeleton />
  }

  if (status === 'error' || !course) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Course unavailable</h1>
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
      <HeaderBar
        courseTitle={course.title}
        courseSubtitle={course.subtitle}
        query={query}
        onQueryChange={setQuery}
        completedCount={completedCount}
        totalCount={totalCount}
        percent={percent}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <div className="relative flex min-h-0 flex-1">
        <SidebarNav
          modules={course.modules}
          query={query}
          activeVideoId={activeVideo?.id ?? null}
          completedIds={completedIds}
          onSelectVideo={selectVideo}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {activeVideo ? (
          <MainViewport
            video={activeVideo}
            complete={isComplete(activeVideo.id)}
            startSeconds={startSeconds}
            hasPrevious={Boolean(neighbors.previousId)}
            hasNext={Boolean(neighbors.nextId)}
            onPrevious={() => neighbors.previousId && selectVideo(neighbors.previousId)}
            onNext={() => neighbors.nextId && selectVideo(neighbors.nextId)}
            onToggleComplete={handleToggleComplete}
            onTimeUpdate={(seconds) => setPosition(activeVideo.id, seconds)}
            onEnded={() => handleMarkComplete(activeVideo.id)}
          />
        ) : (
          <p className="flex flex-1 items-center justify-center text-sm text-slate-500">
            No videos in this catalog.
          </p>
        )}
      </div>
    </div>
  )
}

function LmsSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-100" aria-busy="true" aria-label="Loading course">
      <div className="h-[4.5rem] border-b border-slate-800 bg-slate-950" />
      <div className="flex flex-1">
        <div className="hidden w-80 border-r border-slate-200 bg-white p-4 lg:block">
          <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
          <div className="mt-6 space-y-3">
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
        <div className="flex-1 p-6">
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-slate-200" />
          <div className="mt-5 h-6 w-2/3 animate-pulse rounded bg-slate-200" />
          <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}
