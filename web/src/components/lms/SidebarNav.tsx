import { useEffect, useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { videoMatchesQuery } from '../../lib/courseCatalog'
import type { CourseModule, CourseVideo } from '../../types/lms'
import { CheckIcon, ChevronIcon, ClockIcon } from './icons'

interface SidebarNavProps {
  modules: CourseModule[]
  query: string
  activeVideoId: string | null
  completedIds: Set<string>
  onSelectVideo: (videoId: string) => void
  open: boolean
  onClose: () => void
}

export function SidebarNav({
  modules,
  query,
  activeVideoId,
  completedIds,
  onSelectVideo,
  open,
  onClose,
}: SidebarNavProps) {
  const filtered = useMemo(() => {
    const needle = query.trim()
    if (!needle) return modules
    return modules
      .map((module) => ({
        ...module,
        videos: module.videos.filter((video) => videoMatchesQuery(video, query)),
      }))
      .filter((module) => module.videos.length > 0)
  }, [modules, query])

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    const next = new Set<string>()
    if (query.trim()) {
      filtered.forEach((module) => next.add(module.id))
    } else {
      const owner = modules.find((module) =>
        module.videos.some((video) => video.id === activeVideoId),
      )
      if (owner) next.add(owner.id)
      else if (modules[0]) next.add(modules[0].id)
    }
    setExpanded(next)
  }, [activeVideoId, filtered, modules, query])

  const toggle = (moduleId: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(moduleId)) next.delete(moduleId)
      else next.add(moduleId)
      return next
    })
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close course outline"
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={cn(
          'z-50 flex h-full w-[min(100%,20rem)] shrink-0 flex-col border-slate-200 bg-white',
          'fixed inset-y-0 left-0 border-r shadow-xl transition-transform lg:static lg:z-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Course outline
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Close outline"
          >
            ×
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Modules and chapters">
          {filtered.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              No videos match “{query.trim()}”.
            </p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((module) => (
                <ModuleAccordion
                  key={module.id}
                  module={module}
                  expanded={expanded.has(module.id)}
                  onToggle={() => toggle(module.id)}
                  activeVideoId={activeVideoId}
                  completedIds={completedIds}
                  onSelectVideo={(id) => {
                    onSelectVideo(id)
                    onClose()
                  }}
                />
              ))}
            </ul>
          )}
        </nav>
      </aside>
    </>
  )
}

function ModuleAccordion({
  module,
  expanded,
  onToggle,
  activeVideoId,
  completedIds,
  onSelectVideo,
}: {
  module: CourseModule
  expanded: boolean
  onToggle: () => void
  activeVideoId: string | null
  completedIds: Set<string>
  onSelectVideo: (videoId: string) => void
}) {
  const done = module.videos.filter((video) => completedIds.has(video.id)).length
  const panelId = `${module.id}-panel`
  const buttonId = `${module.id}-button`

  return (
    <li className="rounded-xl">
      <button
        type="button"
        id={buttonId}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
      >
        <ChevronIcon
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform',
            expanded ? 'rotate-0' : '-rotate-90',
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {module.title}
          </span>
          <span className="block text-[11px] text-slate-500">
            {done}/{module.videos.length} complete
          </span>
        </span>
      </button>

      {expanded ? (
        <ul id={panelId} role="region" aria-labelledby={buttonId} className="mb-2 ml-2 space-y-0.5 border-l border-slate-200 pl-2">
          {module.videos.map((video) => (
            <VideoRow
              key={video.id}
              video={video}
              active={video.id === activeVideoId}
              complete={completedIds.has(video.id)}
              onSelect={() => onSelectVideo(video.id)}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

function VideoRow({
  video,
  active,
  complete,
  onSelect,
}: {
  video: CourseVideo
  active: boolean
  complete: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? 'true' : undefined}
        className={cn(
          'flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition',
          active
            ? 'bg-blue-50 text-blue-950 ring-1 ring-blue-200'
            : 'text-slate-700 hover:bg-slate-50',
        )}
      >
        <span
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            complete
              ? 'bg-blue-600 text-white'
              : 'border border-slate-300 text-slate-400',
          )}
          aria-hidden="true"
        >
          {complete ? <CheckIcon className="h-3 w-3" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium leading-5">{video.title}</span>
          <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            {video.duration ? (
              <>
                <ClockIcon className="h-3 w-3" />
                {video.duration}
              </>
            ) : null}
          </span>
        </span>
        {complete ? <span className="sr-only">Completed</span> : null}
      </button>
    </li>
  )
}
