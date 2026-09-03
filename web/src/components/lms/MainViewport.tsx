import { cn } from '../../lib/cn'
import type { CourseVideo } from '../../types/lms'
import { VideoPlayerWrapper } from './VideoPlayerWrapper'
import { CheckIcon, ClockIcon } from './icons'

interface MainViewportProps {
  video: CourseVideo
  complete: boolean
  startSeconds: number
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  onToggleComplete: () => void
  onTimeUpdate: (seconds: number) => void
  onEnded: () => void
}

export function MainViewport({
  video,
  complete,
  startSeconds,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  onToggleComplete,
  onTimeUpdate,
  onEnded,
}: MainViewportProps) {
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
            startSeconds={startSeconds}
            onTimeUpdate={onTimeUpdate}
            onEnded={onEnded}
          />
        </div>

        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-200">
                {video.category}
              </span>
              {video.duration ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <ClockIcon className="h-3.5 w-3.5" />
                {video.duration}
              </span>
              ) : null}
            </div>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">
              {video.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onToggleComplete}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2',
              complete
                ? 'bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:outline-emerald-700'
                : 'bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-700',
            )}
            aria-pressed={complete}
          >
            <CheckIcon className="h-4 w-4" />
            {complete ? 'Completed' : 'Mark as Complete'}
          </button>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
          {video.description}
        </p>

        {video.tags && video.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {video.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!hasPrevious}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            className="rounded-lg px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Next lesson
          </button>
        </div>
      </div>
    </section>
  )
}
