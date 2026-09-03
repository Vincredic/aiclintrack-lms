import type { CourseCatalog, CourseModule, CourseVideo } from '../types/lms'
import { asRecord } from './json'
import { isVideoSourceType } from './videoSource'

function parseVideo(value: unknown, index: number, moduleId: string): CourseVideo {
  const record = asRecord(value)
  if (!record) {
    throw new Error(`Invalid video at ${moduleId}[${index}]`)
  }

  const id = typeof record.id === 'string' ? record.id.trim() : ''
  const title = typeof record.title === 'string' ? record.title.trim() : ''
  const sourceUrlOrId =
    typeof record.sourceUrlOrId === 'string' ? record.sourceUrlOrId.trim() : ''

  if (!id || !title || !sourceUrlOrId || !isVideoSourceType(record.sourceType)) {
    throw new Error(`Video ${id || index} in ${moduleId} is missing required fields`)
  }

  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === 'string')
    : undefined

  return {
    id,
    title,
    description: typeof record.description === 'string' ? record.description : '',
    duration: typeof record.duration === 'string' ? record.duration : '',
    category: typeof record.category === 'string' ? record.category : 'Lesson',
    sourceType: record.sourceType,
    sourceUrlOrId,
    thumbnailUrl: typeof record.thumbnailUrl === 'string' ? record.thumbnailUrl : '',
    tags,
  }
}

function parseModule(value: unknown, index: number): CourseModule {
  const record = asRecord(value)
  if (!record) throw new Error(`Invalid module at index ${index}`)

  const id = typeof record.id === 'string' ? record.id.trim() : `module-${index + 1}`
  const title = typeof record.title === 'string' ? record.title.trim() : `Module ${index + 1}`
  const videos = Array.isArray(record.videos)
    ? record.videos.map((video, videoIndex) => parseVideo(video, videoIndex, id))
    : []

  if (videos.length === 0) {
    throw new Error(`Module "${title}" has no videos`)
  }

  return {
    id,
    title,
    summary: typeof record.summary === 'string' ? record.summary : undefined,
    videos,
  }
}

export function parseCourseCatalog(payload: unknown): CourseCatalog {
  const root = asRecord(payload)
  const record = asRecord(root?.course) ?? root
  if (!record) throw new Error('courses.json must be a course object')

  const modules = Array.isArray(record.modules)
    ? record.modules.map(parseModule)
    : []

  if (modules.length === 0) {
    throw new Error('courses.json does not contain any modules')
  }

  return {
    id: typeof record.id === 'string' ? record.id : 'course',
    title: typeof record.title === 'string' ? record.title : 'Video course',
    subtitle: typeof record.subtitle === 'string' ? record.subtitle : undefined,
    description: typeof record.description === 'string' ? record.description : '',
    modules,
  }
}

export function flattenVideos(course: CourseCatalog): CourseVideo[] {
  return course.modules.flatMap((module) => module.videos)
}

export function videoMatchesQuery(video: CourseVideo, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [
    video.title,
    video.description,
    video.category,
    ...(video.tags ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
}

export function adjacentVideoIds(
  videos: CourseVideo[],
  currentId: string,
): { previousId: string | null; nextId: string | null } {
  const index = videos.findIndex((video) => video.id === currentId)
  if (index < 0) return { previousId: null, nextId: null }
  return {
    previousId: videos[index - 1]?.id ?? null,
    nextId: videos[index + 1]?.id ?? null,
  }
}
