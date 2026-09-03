import { useCallback, useEffect, useState } from 'react'
import {
  adminVideoId,
  appendVideoToModule,
  catalogYouTubeIds,
  clearAdminDraft,
  cloneCatalog,
  downloadCoursesJson,
  readAdminDraft,
  removeVideoFromCatalog,
  writeAdminDraft,
} from '../lib/adminCatalog'
import { parseCourseCatalog } from '../lib/courseCatalog'
import { parseYouTubeVideoId, youtubeThumbnailUrl } from '../lib/videoSource'
import { resolveYouTubeMetadata } from '../lib/youtubeMetadata'
import {
  YOUTUBE_CHANNEL_HANDLE,
  YOUTUBE_CHANNEL_MODULE_ID,
  YOUTUBE_CHANNEL_MODULE_TITLE,
} from '../config/youtubeChannel'
import { type CourseCatalog, type CourseVideo } from '../types/lms'

export interface AddYouTubeInput {
  url: string
  title?: string
  description?: string
  category?: string
  moduleId?: string
  moduleTitle?: string
}

export function useAdminCatalog(published: CourseCatalog | null) {
  const [draft, setDraft] = useState<CourseCatalog | null>(null)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!published) return
    const stored = readAdminDraft()
    if (stored) {
      try {
        setDraft(parseCourseCatalog(stored))
        setDirty(true)
        return
      } catch {
        clearAdminDraft()
      }
    }
    setDraft(cloneCatalog(published))
    setDirty(false)
  }, [published])

  const commit = useCallback((next: CourseCatalog) => {
    setDraft(next)
    setDirty(true)
    writeAdminDraft(next)
  }, [])

  const addYouTubeVideo = useCallback(
    async (input: AddYouTubeInput) => {
      if (!draft) throw new Error('Catalog is not loaded yet')
      const youtubeId = parseYouTubeVideoId(input.url)
      if (!youtubeId) {
        throw new Error(
          `Paste a YouTube URL from the @${YOUTUBE_CHANNEL_HANDLE} channel.`,
        )
      }
      if (catalogYouTubeIds(draft).has(youtubeId)) {
        throw new Error('That YouTube video is already in this catalog.')
      }

      const meta = await resolveYouTubeMetadata(input.url)
      const moduleId = input.moduleId?.trim() || YOUTUBE_CHANNEL_MODULE_ID
      const known = draft.modules.find((module) => module.id === moduleId)
      const moduleTitle =
        input.moduleTitle?.trim() ||
        known?.title ||
        YOUTUBE_CHANNEL_MODULE_TITLE

      const video: CourseVideo = {
        id: adminVideoId(youtubeId),
        title: input.title?.trim() || meta.title,
        description:
          input.description?.trim() ||
          (meta.author
            ? `Added from YouTube · ${meta.author}.`
            : 'Added from YouTube.'),
        duration: '',
        category: input.category?.trim() || YOUTUBE_CHANNEL_HANDLE,
        sourceType: 'youtube',
        sourceUrlOrId: youtubeId,
        thumbnailUrl: meta.thumbnailUrl || youtubeThumbnailUrl(youtubeId),
        tags: ['youtube', ...(meta.author ? [meta.author] : [])],
      }

      commit(appendVideoToModule(draft, moduleId, moduleTitle, video))
      return video
    },
    [commit, draft],
  )

  const removeVideo = useCallback(
    (videoId: string) => {
      if (!draft) return
      commit(removeVideoFromCatalog(draft, videoId))
    },
    [commit, draft],
  )

  const discardDraft = useCallback(() => {
    if (!published) return
    clearAdminDraft()
    setDraft(cloneCatalog(published))
    setDirty(false)
  }, [published])

  const exportJson = useCallback(() => {
    if (!draft) return
    downloadCoursesJson(draft)
  }, [draft])

  return {
    draft,
    dirty,
    addYouTubeVideo,
    removeVideo,
    discardDraft,
    exportJson,
  }
}
