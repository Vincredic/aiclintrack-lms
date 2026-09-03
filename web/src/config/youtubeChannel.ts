export const YOUTUBE_CHANNEL_HANDLE = 'AIClinTrack'
export const YOUTUBE_CHANNEL_ID = 'UCRxbK63ZwgkspA_afRlpxqA'
export const YOUTUBE_CHANNEL_URL = 'https://www.youtube.com/@AIClinTrack'
export const YOUTUBE_CHANNEL_FEED_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`
export const YOUTUBE_FEED_PATH = '/youtube/feed'

export const YOUTUBE_CHANNEL_COURSE_ID = 'aiclintrack-channel'
export const YOUTUBE_CHANNEL_MODULE_ID = 'mod-aiclintrack'
export const YOUTUBE_CHANNEL_MODULE_TITLE = 'AIClinTrack channel'

export function isAllowedYouTubeAuthor(author?: string): boolean {
  const normalized = (author || '').trim().toLowerCase().replace(/\s+/g, '')
  return normalized === 'aiclintrack'
}

export function isAllowedYouTubeChannelId(channelId?: string): boolean {
  const raw = (channelId || '').replace(/^yt:channel:/i, '').trim()
  if (!raw) return false
  return raw === YOUTUBE_CHANNEL_ID || `UC${raw}` === YOUTUBE_CHANNEL_ID
}

export function youtubeLessonId(youtubeId: string): string {
  return `yt-${youtubeId}`
}
