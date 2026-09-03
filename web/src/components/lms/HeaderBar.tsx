import { MenuIcon, SearchIcon } from './icons'

interface HeaderBarProps {
  courseTitle: string
  courseSubtitle?: string
  query: string
  onQueryChange: (value: string) => void
  completedCount: number
  totalCount: number
  percent: number
  onOpenSidebar: () => void
}

export function HeaderBar({
  courseTitle,
  courseSubtitle,
  query,
  onQueryChange,
  completedCount,
  totalCount,
  percent,
  onOpenSidebar,
}: HeaderBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
      <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-6 lg:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Open course outline"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-400">
              AiClinTrack LMS
            </p>
            <h1 className="truncate text-sm font-semibold md:text-base">
              {courseTitle}
            </h1>
            {courseSubtitle ? (
              <p className="truncate text-xs text-slate-400">{courseSubtitle}</p>
            ) : null}
          </div>
        </div>

        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search videos and tags</span>
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search titles, categories, or tags"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
          />
        </label>

        <div className="shrink-0 lg:w-64">
          <p className="text-xs font-medium text-slate-200">
            {completedCount} of {totalCount} Completed
            <span className="text-slate-400"> — {percent}%</span>
          </p>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Course completion"
          >
            <div
              className="h-full rounded-full bg-blue-500 transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
