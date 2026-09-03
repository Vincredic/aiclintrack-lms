import type { VideoSourceType } from '../types/lms'

const SOURCE_TYPES: readonly VideoSourceType[] = ['youtube', 'vimeo', 'html5']

export function isVideoSourceType(value: unknown): value is VideoSourceType {
  return typeof value === 'string' && SOURCE_TYPES.includes(value as VideoSourceType)
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_IN_URL =
  /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|shorts\/|live\/|v\/|watch\?(?:.*&)?v=))([A-Za-z0-9_-]{11})/i

export function parseYouTubeVideoId(sourceUrlOrId: string): string | null {
  const trimmed = sourceUrlOrId.trim()
  const fromUrl = trimmed.match(YOUTUBE_IN_URL)
  if (fromUrl?.[1]) return fromUrl[1]
  if (YOUTUBE_ID.test(trimmed)) return trimmed
  return null
}

function extractYouTubeId(sourceUrlOrId: string): string {
  return parseYouTubeVideoId(sourceUrlOrId) ?? sourceUrlOrId.trim()
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

function extractVimeoId(sourceUrlOrId: string): string {
  const trimmed = sourceUrlOrId.trim()
  const match = trimmed.match(
    /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/,
  )
  if (match?.[1]) return match[1]
  if (/^\d+$/.test(trimmed)) return trimmed
  return trimmed
}

export function buildYouTubeEmbedUrl(
  sourceUrlOrId: string,
  options?: { startSeconds?: number; origin?: string },
): string {
  const id = extractYouTubeId(sourceUrlOrId)
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    enablejsapi: '1',
  })
  if (options?.origin) params.set('origin', options.origin)
  if (options?.startSeconds && options.startSeconds > 0) {
    params.set('start', String(Math.floor(options.startSeconds)))
  }
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}

export function buildVimeoEmbedUrl(
  sourceUrlOrId: string,
  options?: { startSeconds?: number },
): string {
  const id = extractVimeoId(sourceUrlOrId)
  const params = new URLSearchParams({
    title: '0',
    byline: '0',
    portrait: '0',
    dnt: '1',
  })
  const hash =
    options?.startSeconds && options.startSeconds > 0
      ? `#t=${Math.floor(options.startSeconds)}s`
      : ''
  return `https://player.vimeo.com/video/${id}?${params.toString()}${hash}`
}
