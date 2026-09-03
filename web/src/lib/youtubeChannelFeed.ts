import {
  YOUTUBE_CHANNEL_COURSE_ID,
  YOUTUBE_CHANNEL_HANDLE,
  YOUTUBE_CHANNEL_MODULE_ID,
  YOUTUBE_CHANNEL_MODULE_TITLE,
  isAllowedYouTubeAuthor,
  isAllowedYouTubeChannelId,
  youtubeLessonId,
} from '../config/youtubeChannel'
import type { CourseCatalog, CourseVideo } from '../types/lms'
import { youtubeThumbnailUrl } from './videoSource'

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function tagValue(xml: string, tag: string): string {
  const escaped = tag.replace(/:/g, '\\:')
  const match = xml.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)</${escaped}>`, 'i'))
  return decodeXml(match?.[1] ?? '')
}

function tagAttr(xml: string, tag: string, attr: string): string {
  const escaped = tag.replace(/:/g, '\\:')
  const match = xml.match(
    new RegExp(`<${escaped}[^>]*\\s${attr}="([^"]*)"`, 'i'),
  )
  return decodeXml(match?.[1] ?? '')
}

function parseEntry(entry: string): CourseVideo | null {
  const youtubeId = tagValue(entry, 'yt:videoId')
  const title = tagValue(entry, 'title')
  const channelId = tagValue(entry, 'yt:channelId')
  const author = tagValue(entry, 'name')
  if (!youtubeId || !title) return null
  if (!isAllowedYouTubeChannelId(channelId) && !isAllowedYouTubeAuthor(author)) {
    return null
  }

  const description = tagValue(entry, 'media:description')
  const thumbnail =
    tagAttr(entry, 'media:thumbnail', 'url') || youtubeThumbnailUrl(youtubeId)

  return {
    id: youtubeLessonId(youtubeId),
    title,
    description: description || `From the ${YOUTUBE_CHANNEL_HANDLE} YouTube channel.`,
    duration: '',
    category: 'AIClinTrack',
    sourceType: 'youtube',
    sourceUrlOrId: youtubeId,
    thumbnailUrl: thumbnail,
    tags: ['youtube', YOUTUBE_CHANNEL_HANDLE],
  }
}

export function catalogFromChannelFeed(xml: string): CourseCatalog | null {
  if (!xml.includes('<entry')) return null
  const videos = xml
    .split('<entry')
    .slice(1)
    .map((block) => parseEntry(block))
    .filter((video): video is CourseVideo => video !== null)

  if (videos.length === 0) return null

  return {
    id: YOUTUBE_CHANNEL_COURSE_ID,
    title: `${YOUTUBE_CHANNEL_HANDLE} tutorials`,
    subtitle: `@${YOUTUBE_CHANNEL_HANDLE}`,
    description: `Video tutorials from the official ${YOUTUBE_CHANNEL_HANDLE} YouTube channel.`,
    modules: [
      {
        id: YOUTUBE_CHANNEL_MODULE_ID,
        title: YOUTUBE_CHANNEL_MODULE_TITLE,
        summary: `Public uploads from youtube.com/@${YOUTUBE_CHANNEL_HANDLE}.`,
        videos,
      },
    ],
  }
}
