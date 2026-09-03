import {
  YOUTUBE_CHANNEL_HANDLE,
  isAllowedYouTubeAuthor,
} from '../config/youtubeChannel'
import { asRecord } from './json'
import {
  parseYouTubeVideoId,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from './videoSource'

export interface YouTubeMetadata {
  youtubeId: string
  title: string
  author?: string
  thumbnailUrl: string
}

async function fetchJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) {
    throw new Error(`Lookup failed (${response.status})`)
  }
  return response.json()
}

function metadataFromOEmbed(
  youtubeId: string,
  payload: unknown,
): YouTubeMetadata | null {
  const record = asRecord(payload)
  if (!record) return null
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  if (!title) return null
  const author =
    typeof record.author_name === 'string' ? record.author_name.trim() : undefined
  const thumbnail =
    typeof record.thumbnail_url === 'string' && record.thumbnail_url
      ? record.thumbnail_url
      : youtubeThumbnailUrl(youtubeId)
  return {
    youtubeId,
    title,
    author: author || undefined,
    thumbnailUrl: thumbnail,
  }
}

function assertChannelVideo(meta: YouTubeMetadata): YouTubeMetadata {
  if (isAllowedYouTubeAuthor(meta.author)) return meta
  throw new Error(
    `Only videos from the ${YOUTUBE_CHANNEL_HANDLE} YouTube channel can be used.`,
  )
}

export async function resolveYouTubeMetadata(
  input: string,
  signal?: AbortSignal,
): Promise<YouTubeMetadata> {
  const youtubeId = parseYouTubeVideoId(input)
  if (!youtubeId) {
    throw new Error(
      `Paste a YouTube watch, share, Shorts, or embed URL from @${YOUTUBE_CHANNEL_HANDLE}.`,
    )
  }

  const encoded = encodeURIComponent(youtubeWatchUrl(youtubeId))
  const endpoints = [
    `https://www.youtube.com/oembed?format=json&url=${encoded}`,
    `https://noembed.com/embed?url=${encoded}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const parsed = metadataFromOEmbed(
        youtubeId,
        await fetchJson(endpoint, signal),
      )
      if (parsed) return assertChannelVideo(parsed)
    } catch (caught: unknown) {
      if (
        caught instanceof Error &&
        caught.message.includes(YOUTUBE_CHANNEL_HANDLE)
      ) {
        throw caught
      }
    }
  }

  throw new Error(
    `Could not confirm that video is from @${YOUTUBE_CHANNEL_HANDLE}.`,
  )
}
