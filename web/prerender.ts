import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { YOUTUBE_CHANNEL_FEED_URL } from './src/config/youtubeChannel'
import { catalogFromChannelFeed } from './src/lib/youtubeChannelFeed'

const INLINE_CATALOG_ID = 'lms-catalog'
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_IN_URL =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|live\/|v\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{11})/i

interface PrerenderVideo {
  id: string
  title: string
  description: string
  duration: string
  category: string
  sourceType: string
  sourceUrlOrId: string
}

interface PrerenderModule {
  id: string
  title: string
  videos: PrerenderVideo[]
}

interface PrerenderCatalog {
  title: string
  subtitle?: string
  description: string
  modules: PrerenderModule[]
}

function catalogPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), 'public/courses.json')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function youtubeId(sourceUrlOrId: string): string | null {
  const trimmed = sourceUrlOrId.trim()
  const fromUrl = trimmed.match(YOUTUBE_IN_URL)
  if (fromUrl?.[1]) return fromUrl[1]
  if (YOUTUBE_ID.test(trimmed)) return trimmed
  return null
}

function fallbackHref(video: PrerenderVideo): string {
  if (video.sourceType === 'youtube') {
    const id = youtubeId(video.sourceUrlOrId)
    if (id) return `https://www.youtube.com/watch?v=${id}`
  }
  if (video.sourceType === 'vimeo') {
    return video.sourceUrlOrId.startsWith('http')
      ? video.sourceUrlOrId
      : `https://vimeo.com/${video.sourceUrlOrId}`
  }
  return video.sourceUrlOrId
}

function snapshotCatalog(): { raw: string; catalog: PrerenderCatalog } {
  const raw = readFileSync(catalogPath(), 'utf8')
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('courses.json must be a course object')
  }
  const record = parsed as Record<string, unknown>
  const modules = Array.isArray(record.modules) ? record.modules : []
  if (modules.length === 0) {
    throw new Error('courses.json does not contain any modules')
  }
  return {
    raw,
    catalog: {
      title: typeof record.title === 'string' ? record.title : 'Video course',
      subtitle: typeof record.subtitle === 'string' ? record.subtitle : undefined,
      description: typeof record.description === 'string' ? record.description : '',
      modules: modules as PrerenderModule[],
    },
  }
}

async function loadCatalog(): Promise<{ raw: string; catalog: PrerenderCatalog }> {
  try {
    const response = await fetch(YOUTUBE_CHANNEL_FEED_URL, {
      headers: { Accept: 'application/atom+xml' },
    })
    if (response.ok) {
      const fromChannel = catalogFromChannelFeed(await response.text())
      if (fromChannel && fromChannel.modules[0]?.videos.length) {
        return {
          raw: JSON.stringify(fromChannel),
          catalog: fromChannel,
        }
      }
    }
  } catch {
    // Build and local prerender still work from the snapshot file.
  }
  return snapshotCatalog()
}

function inlineCatalogScript(rawJson: string): string {
  const safe = rawJson.replace(/</g, '\\u003c')
  return `<script type="application/json" id="${INLINE_CATALOG_ID}">${safe}</script>`
}

function prerenderMarkup(catalog: PrerenderCatalog): string {
  const videos = catalog.modules.flatMap((module) => module.videos)
  const first = videos[0]
  const subtitle = catalog.subtitle
    ? `<p class="truncate text-xs text-slate-400">${escapeHtml(catalog.subtitle)}</p>`
    : ''

  const outline = catalog.modules
    .map((module) => {
      const items = module.videos
        .map(
          (video) => `<li>
            <a class="block rounded-lg px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50" href="#v=${encodeURIComponent(video.id)}">
              ${escapeHtml(video.title)}
              ${video.duration ? `<span class="mt-0.5 block text-[11px] text-slate-500">${escapeHtml(video.duration)}</span>` : ''}
            </a>
          </li>`,
        )
        .join('')
      return `<li class="rounded-xl">
        <p class="px-2 py-2 text-sm font-semibold text-slate-900">${escapeHtml(module.title)}</p>
        <ul class="mb-2 ml-2 space-y-0.5 border-l border-slate-200 pl-2">${items}</ul>
      </li>`
    })
    .join('')

  const main = first
    ? `<div class="min-w-0">
        <span class="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-200">${escapeHtml(first.category || 'Lesson')}</span>
        <h2 class="mt-2 text-xl font-semibold tracking-tight text-slate-900 md:text-2xl">${escapeHtml(first.title)}</h2>
        <p class="mt-4 max-w-3xl text-sm leading-6 text-slate-600">${escapeHtml(first.description)}</p>
        <p class="mt-6 text-sm text-slate-500">The in-app player loads with JavaScript. <a class="font-medium text-blue-700 hover:underline" href="${escapeHtml(fallbackHref(first))}">Open this lesson</a></p>
      </div>`
    : `<p class="text-sm text-slate-500">No videos in this catalog.</p>`

  return `<div class="flex h-dvh flex-col overflow-hidden bg-slate-100">
    <header class="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 text-white">
      <div class="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:gap-6 lg:px-5">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-400">AiClinTrack LMS</p>
          <h1 class="truncate text-sm font-semibold md:text-base">${escapeHtml(catalog.title)}</h1>
          ${subtitle}
        </div>
        <p class="text-xs font-medium text-slate-200">0 of ${videos.length} Completed<span class="text-slate-400"> — 0%</span></p>
      </div>
    </header>
    <div class="relative flex min-h-0 flex-1">
      <aside class="z-50 hidden h-full w-[min(100%,20rem)] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <div class="border-b border-slate-200 px-4 py-3">
          <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Course outline</p>
        </div>
        <nav class="flex-1 overflow-y-auto px-2 py-3" aria-label="Modules and chapters">
          <ul class="space-y-1">${outline}</ul>
        </nav>
      </aside>
      <section class="min-w-0 flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-5xl px-4 py-5 md:px-6 md:py-6">${main}</div>
      </section>
    </div>
  </div>`
}

export function prerenderCatalogPlugin(): Plugin {
  return {
    name: 'prerender-catalog',
    transformIndexHtml: {
      order: 'pre',
      async handler(html) {
        const { raw, catalog } = await loadCatalog()
        const title = escapeHtml(`${catalog.title} · AiClinTrack LMS`)
        return html
          .replace(
            '<title>AiClinTrack LMS · Video Tutorials</title>',
            `<title>${title}</title>`,
          )
          .replace(
            '<div id="root"></div>',
            `${inlineCatalogScript(raw)}\n    <div id="root">${prerenderMarkup(catalog)}</div>`,
          )
      },
    },
  }
}
