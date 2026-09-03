import { LMS_ADMIN_DRAFT_KEY, type CourseCatalog, type CourseVideo } from '../types/lms'
import { flattenVideos } from './courseCatalog'
import { youtubeLessonId } from '../config/youtubeChannel'
import { parseYouTubeVideoId } from './videoSource'

export function adminVideoId(youtubeId: string): string {
  return youtubeLessonId(youtubeId)
}

export function catalogYouTubeIds(course: CourseCatalog): Set<string> {
  const ids = new Set<string>()
  for (const video of flattenVideos(course)) {
    const youtubeId = parseYouTubeVideoId(video.sourceUrlOrId)
    if (youtubeId) ids.add(youtubeId)
  }
  return ids
}

export function cloneCatalog(course: CourseCatalog): CourseCatalog {
  return JSON.parse(JSON.stringify(course)) as CourseCatalog
}

export function readAdminDraft(): unknown | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LMS_ADMIN_DRAFT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

export function writeAdminDraft(course: CourseCatalog): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(LMS_ADMIN_DRAFT_KEY, JSON.stringify(course))
  } catch {
    // Quota or private-mode failures should not block editing.
  }
}

export function clearAdminDraft(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(LMS_ADMIN_DRAFT_KEY)
}

function catalogForExport(course: CourseCatalog): CourseCatalog {
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    description: course.description,
    modules: course.modules.map((module) => ({
      id: module.id,
      title: module.title,
      summary: module.summary,
      videos: module.videos.map((video) => videoForExport(video)),
    })),
  }
}

function videoForExport(video: CourseVideo): CourseVideo {
  return {
    id: video.id,
    title: video.title,
    description: video.description,
    duration: video.duration,
    category: video.category,
    sourceType: video.sourceType,
    sourceUrlOrId: video.sourceUrlOrId,
    thumbnailUrl: video.thumbnailUrl,
    tags: video.tags,
  }
}

export function downloadCoursesJson(course: CourseCatalog): void {
  const blob = new Blob([JSON.stringify(catalogForExport(course), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'courses.json'
  link.click()
  URL.revokeObjectURL(url)
}

export function appendVideoToModule(
  course: CourseCatalog,
  moduleId: string,
  moduleTitle: string,
  video: CourseVideo,
): CourseCatalog {
  const next = cloneCatalog(course)
  let module = next.modules.find((item) => item.id === moduleId)
  if (!module) {
    module = {
      id: moduleId,
      title: moduleTitle,
      summary: 'Videos added by catalog admin.',
      videos: [],
    }
    next.modules.push(module)
  }
  module.videos.push(video)
  return next
}

export function removeVideoFromCatalog(
  course: CourseCatalog,
  videoId: string,
): CourseCatalog {
  const next = cloneCatalog(course)
  next.modules = next.modules
    .map((module) => ({
      ...module,
      videos: module.videos.filter((video) => video.id !== videoId),
    }))
    .filter((module) => module.videos.length > 0)
  if (next.modules.length === 0) return course
  return next
}
